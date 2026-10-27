import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// K-AV-LINK: ผูก Steam (ยืนยันจริง) + MLBB (กรอกเอง) — ไม่ยิง Steam/DB จริง

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  suspended: false,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpcError: null as { message: string } | null,
  admin: true,
  upserts: [] as Record<string, unknown>[],
  upsertError: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/suspension", () => ({ isUserSuspended: async () => h.suspended }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: () => ({ upsert: async (row: Record<string, unknown>) => { h.upserts.push(row); return { error: h.upsertError }; } }),
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  getAdminDb: () => (h.admin ? { rpc: async (fn: string, args: Record<string, unknown>) => { h.rpcCalls.push({ fn, args }); return { error: h.rpcError }; } } : null),
}));

import {
  buildStartUrl, parseClaimedId, toDotaAccountId, checkReturnParams, verifyAssertion, processSteamReturn, resolveSiteUrl,
  STEAM_OPENID_ENDPOINT,
} from "@/lib/game-accounts/steam";
import { parseMlbb } from "@/lib/game-accounts/mlbb";
import { needsLogin } from "@/lib/auth/protected-paths";
import { GET as startGET } from "@/app/link/steam/start/route";
import { GET as returnGET } from "@/app/link/steam/return/route";
import { linkMlbb } from "@/app/me/mlbb-actions";

const SITE = "https://avelai.example";
const STEAM64 = "76561197960287930"; // → account_id 22202
const goodParams = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OPENID_ENDPOINT,
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM64}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM64}`,
    "openid.return_to": `${SITE}/link/steam/return`,
    "openid.response_nonce": "2026-10-27T00:00:00Zabc",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "x",
    ...over,
  });
const steamSays = (text: string, ok = true) => (async () => ({ ok, text: async () => text })) as unknown as typeof fetch;

beforeEach(() => {
  h.user = { id: "session-user" }; h.suspended = false; h.rpcCalls = []; h.rpcError = null; h.admin = true; h.upserts = []; h.upsertError = null;
  vi.stubEnv("SITE_URL", SITE);
});

describe("steam.ts (pure)", () => {
  it("แปลง SteamID64 → Dota account_id", () => {
    expect(toDotaAccountId(STEAM64)).toBe("22202");
    expect(toDotaAccountId("76561197960265728")).toBeNull(); // = 0
    expect(toDotaAccountId("12345")).toBeNull();
  });
  it("claimed_id ปลอม/โดเมนอื่น/ไม่ใช่ SteamID64 → ปฏิเสธ", () => {
    expect(parseClaimedId(`https://steamcommunity.com/openid/id/${STEAM64}`)).toBe(STEAM64);
    expect(parseClaimedId(`https://evil.com/openid/id/${STEAM64}`)).toBeNull();
    expect(parseClaimedId(`http://steamcommunity.com/openid/id/${STEAM64}`)).toBeNull();
    expect(parseClaimedId(`https://steamcommunity.com/openid/id/${STEAM64}/x`)).toBeNull();
    expect(parseClaimedId("https://steamcommunity.com/openid/id/123")).toBeNull();
    expect(parseClaimedId(null)).toBeNull();
  });
  it("start URL: SITE_URL เป็น return_to/realm · identifier_select", () => {
    const u = new URL(buildStartUrl(SITE));
    expect(u.origin + u.pathname).toBe(STEAM_OPENID_ENDPOINT);
    expect(u.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(u.searchParams.get("openid.return_to")).toBe(`${SITE}/link/steam/return`);
    expect(u.searchParams.get("openid.realm")).toBe(SITE);
    expect(u.searchParams.get("openid.claimed_id")).toMatch(/identifier_select$/);
  });
  it("checkReturnParams: return_to / op_endpoint / mode / signed ผิด → false", () => {
    expect(checkReturnParams(goodParams(), SITE)).toBe(true);
    expect(checkReturnParams(goodParams({ "openid.return_to": "https://evil.com/link/steam/return" }), SITE)).toBe(false);
    expect(checkReturnParams(goodParams({ "openid.op_endpoint": "https://evil.com/openid/login" }), SITE)).toBe(false);
    expect(checkReturnParams(goodParams({ "openid.mode": "cancel" }), SITE)).toBe(false);
    expect(checkReturnParams(goodParams({ "openid.signed": "signed,op_endpoint,return_to" }), SITE)).toBe(false); // claimed_id ไม่ถูกเซ็น
  });
  it("verifyAssertion: ไม่มี is_valid:true → ปฏิเสธ · ส่งเฉพาะ openid.* · mode = check_authentication", async () => {
    expect(await verifyAssertion(goodParams(), steamSays("ns:x\nis_valid:false\n"))).toBe(false);
    expect(await verifyAssertion(goodParams(), steamSays("is_valid:true\n", false))).toBe(false);
    expect(await verifyAssertion(goodParams(), (async () => { throw new Error("net"); }) as unknown as typeof fetch)).toBe(false);
    let sent = "";
    const spy = (async (_u: string, init: RequestInit) => { sent = String(init.body); return { ok: true, text: async () => "ns:x\nis_valid:true\n" }; }) as unknown as typeof fetch;
    expect(await verifyAssertion(goodParams({ evil: "1" }), spy)).toBe(true);
    const body = new URLSearchParams(sent);
    expect(body.get("openid.mode")).toBe("check_authentication");
    expect(body.has("evil")).toBe(false);
  });
  it("SITE_URL ก่อนเสมอ · production ไม่มี = null", () => {
    expect(resolveSiteUrl({ SITE_URL: "https://a.example/" }, "https://x/y")).toBe("https://a.example");
    expect(resolveSiteUrl({ NODE_ENV: "production" }, "https://x/y")).toBeNull();
    expect(resolveSiteUrl({ NODE_ENV: "development" }, "http://localhost:3000/y")).toBe("http://localhost:3000");
  });
  it("processSteamReturn: สำเร็จ → rpc ด้วย uid ที่ส่งมา + account_id · ระงับ/ไม่มี admin/ซ้ำ → error code", async () => {
    const rpc = async (fn: string, args: Record<string, unknown>) => { h.rpcCalls.push({ fn, args }); return { error: h.rpcError }; };
    const base = { params: goodParams(), siteUrl: SITE, userId: "u1", suspended: false, admin: { rpc }, fetchFn: steamSays("is_valid:true") };
    expect(await processSteamReturn(base)).toBe("/me?linked=steam");
    expect(h.rpcCalls).toEqual([{ fn: "link_steam_verified", args: { p_user_id: "u1", p_account_id: "22202" } }]);
    expect(await processSteamReturn({ ...base, suspended: true })).toBe("/me?link_error=suspended");
    expect(await processSteamReturn({ ...base, admin: null })).toBe("/me?link_error=unavailable");
    h.rpcError = { message: "STEAM_ALREADY_LINKED" };
    expect(await processSteamReturn(base)).toBe("/me?link_error=already");
    h.rpcError = { message: "boom" };
    expect(await processSteamReturn(base)).toBe("/me?link_error=failed");
  });
});

describe("route /link/steam/return", () => {
  const call = (qs: URLSearchParams) => returnGET(new Request(`${SITE}/link/steam/return?${qs.toString()}`));
  it("ไม่ล็อกอิน → /login · ไม่แตะ rpc", async () => {
    h.user = null;
    const res = await call(goodParams());
    expect(res.headers.get("location")).toContain("/login?next=");
    expect(h.rpcCalls).toEqual([]);
  });
  it("return_to ไม่ตรง → error · ไม่เรียก rpc", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:true"));
    const res = await call(goodParams({ "openid.return_to": "https://evil.com/link/steam/return" }));
    expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=invalid`);
    expect(h.rpcCalls).toEqual([]);
  });
  it("Steam ตอบ is_valid:false → ไม่เรียก rpc", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:false"));
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=invalid`);
    expect(h.rpcCalls).toEqual([]);
  });
  it("ผ่าน → rpc ด้วย uid จาก session (ไม่ใช่จาก query)", async () => {
    vi.stubGlobal("fetch", steamSays("ns:x\nis_valid:true\n"));
    const res = await call(goodParams({ user_id: "attacker", p_user_id: "attacker" }));
    expect(res.headers.get("location")).toBe(`${SITE}/me?linked=steam`);
    expect(h.rpcCalls).toEqual([{ fn: "link_steam_verified", args: { p_user_id: "session-user", p_account_id: "22202" } }]);
  });
  it("ไม่มี service role (getAdminDb = null) → 'ยังไม่เปิดใช้งาน'", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:true"));
    h.admin = false;
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=unavailable`);
  });
});

describe("route /link/steam/start", () => {
  it("ไม่ล็อกอิน → /login · ล็อกอิน → redirect ไป Steam", async () => {
    h.user = null;
    expect((await startGET(new Request(`${SITE}/link/steam/start`))).headers.get("location")).toContain("/login?next=");
    h.user = { id: "u" };
    expect((await startGET(new Request(`${SITE}/link/steam/start`))).headers.get("location")).toMatch(/^https:\/\/steamcommunity\.com\/openid\/login\?/);
  });
});

describe("MLBB", () => {
  it("parseMlbb: ค่าผิด → ข้อความไทย", () => {
    expect(parseMlbb("123", "2001")).toMatchObject({ ok: false, message: expect.stringContaining("MLBB ID") });
    expect(parseMlbb("123456789", "12")).toMatchObject({ ok: false, message: expect.stringContaining("Server ID") });
    expect(parseMlbb("12345678901234", "2001")).toMatchObject({ ok: false });
    expect(parseMlbb(" 123456789 ", " 2001 ")).toEqual({ ok: true, id: "123456789", zone: "2001" });
  });
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  it("linkMlbb ค่าผิด → ไม่ upsert", async () => {
    const r = await linkMlbb({ ok: false, message: "" }, fd({ mlbb_id: "abc", zone_id: "2001" }));
    expect(r.ok).toBe(false);
    expect(h.upserts).toEqual([]);
  });
  it("linkMlbb ถูก → upsert status UNVERIFIED เสมอ (ส่ง status=VERIFIED มาก็ไม่มีผล)", async () => {
    const r = await linkMlbb({ ok: false, message: "" }, fd({ mlbb_id: "123456789", zone_id: "2001", status: "VERIFIED", user_id: "attacker" }));
    expect(r.ok).toBe(true);
    expect(h.upserts).toEqual([{ user_id: "session-user", game: "MLBB", external_id: "123456789", zone_id: "2001", status: "UNVERIFIED" }]);
  });
  it("ไม่ล็อกอิน / ถูกระงับ → ไม่ upsert", async () => {
    h.user = null;
    expect((await linkMlbb({ ok: false, message: "" }, fd({ mlbb_id: "123456789", zone_id: "2001" }))).ok).toBe(false);
    h.user = { id: "u" }; h.suspended = true;
    expect((await linkMlbb({ ok: false, message: "" }, fd({ mlbb_id: "123456789", zone_id: "2001" }))).ok).toBe(false);
    expect(h.upserts).toEqual([]);
  });
});

describe("protected-paths + SQL 213", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/213_game_accounts_mlbb_steam.sql"), "utf8").replace(/\r\n/g, "\n");
  const code = sql.slice(0, sql.indexOf("\nCOMMIT;")).replace(/--.*$/gm, "");
  it("/link ต้องล็อกอิน", () => {
    expect(needsLogin("/link/steam/start")).toBe(true);
    expect(needsLogin("/link/steam/return")).toBe(true);
  });
  it("link_steam_verified: SECURITY DEFINER · search_path '' · REVOKE จาก authenticated · GRANT service_role เท่านั้น", () => {
    const fn = code.slice(code.indexOf("CREATE OR REPLACE FUNCTION public.link_steam_verified"));
    expect(fn).toContain("SECURITY DEFINER SET search_path = ''");
    expect(fn).toContain("REVOKE ALL ON FUNCTION public.link_steam_verified(uuid, text) FROM public, anon, authenticated;");
    expect(fn).toContain("GRANT EXECUTE ON FUNCTION public.link_steam_verified(uuid, text) TO service_role;");
    const grants = fn.match(/GRANT EXECUTE ON FUNCTION[^;]*;/g) ?? [];
    expect(grants).toHaveLength(1); // ไม่มี GRANT อื่น (authenticated/anon/public) ปนมา
    expect(fn).toContain("STEAM_ALREADY_LINKED");
  });
  it("ห่อ BEGIN/COMMIT · CHECK game รับ MLBB · zone_id · external_id 12 หลัก · ไม่แก้ policy ของ 130", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(code).toContain("CHECK (game IN ('DOTA2', 'MLBB'))");
    expect(code).toContain("zone_id ~ '^[0-9]{3,6}$'");
    expect(code).toContain("external_id ~ '^[0-9]{1,12}$'");
    expect(code).not.toMatch(/CREATE POLICY|DROP POLICY/);
  });
  it("ไม่มีความลับ/อีเมลจริงในไฟล์ SQL และโค้ดผูกบัญชี", () => {
    for (const f of ["lib/game-accounts/steam.ts", "app/link/steam/return/route.ts", "app/link/steam/start/route.ts"]) {
      const t = readFileSync(join(process.cwd(), f), "utf8");
      expect(t).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{20,}|[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });
});
