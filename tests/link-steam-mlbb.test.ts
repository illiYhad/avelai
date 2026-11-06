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
  singleValued, nonceFresh, readStateCookie, stateCookieValue, returnToWithState, STATE_COOKIE, STEAM_OPENID_ENDPOINT,
} from "@/lib/game-accounts/steam";
import { parseMlbb } from "@/lib/game-accounts/mlbb";
import { needsLogin } from "@/lib/auth/protected-paths";
import { safeNext } from "@/lib/auth/validate";
import { existsSync } from "node:fs";
import { GET as startGET } from "@/app/link/steam/start/route";
import { GET as returnGET } from "@/app/link/steam/return/route";
import { linkMlbb } from "@/app/me/mlbb-actions";

const SITE = "https://avelai.example";
const STEAM64 = "76561197960287930"; // → account_id 22202
const OTHER64 = "76561197960287931";
const STATE = "0123456789abcdef0123456789abcdef";
const UID = "11111111-2222-3333-4444-555555555555";
const OTHER_UID = "99999999-2222-3333-4444-555555555555";
const nowNonce = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const goodParams = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OPENID_ENDPOINT,
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM64}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM64}`,
    "openid.return_to": returnToWithState(SITE, STATE),
    "openid.response_nonce": `${nowNonce()}abc`,
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "x",
    ...over,
  });
const map = (p: URLSearchParams) => singleValued(p)!;
const cookieHeader = (uid = UID, state = STATE) => `other=1; ${STATE_COOKIE}=${stateCookieValue(state, uid)}`;
const steamSays = (text: string, ok = true) => (async () => ({ ok, text: async () => text })) as unknown as typeof fetch;

beforeEach(() => {
  h.user = { id: UID }; h.suspended = false; h.rpcCalls = []; h.rpcError = null; h.admin = true; h.upserts = []; h.upsertError = null;
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
  it("start URL: SITE_URL + state เป็น return_to · realm · identifier_select", () => {
    const u = new URL(buildStartUrl(SITE, STATE));
    expect(u.origin + u.pathname).toBe(STEAM_OPENID_ENDPOINT);
    expect(u.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(u.searchParams.get("openid.return_to")).toBe(`${SITE}/link/steam/return?state=${STATE}`);
    expect(u.searchParams.get("openid.realm")).toBe(SITE);
    expect(u.searchParams.get("openid.claimed_id")).toMatch(/identifier_select$/);
  });
  it("checkReturnParams: return_to / state / op_endpoint / mode / identity / signed ผิด → false", () => {
    expect(checkReturnParams(map(goodParams()), SITE, STATE)).toBe(true);
    expect(checkReturnParams(map(goodParams()), SITE, null)).toBe(false); // ไม่มี state ใน cookie
    expect(checkReturnParams(map(goodParams()), SITE, "f".repeat(32))).toBe(false); // state ไม่ตรง
    expect(checkReturnParams(map(goodParams({ "openid.return_to": `https://evil.com/link/steam/return?state=${STATE}` })), SITE, STATE)).toBe(false);
    expect(checkReturnParams(map(goodParams({ "openid.return_to": `${SITE}/link/steam/return` })), SITE, STATE)).toBe(false); // ไม่มี state
    expect(checkReturnParams(map(goodParams({ "openid.op_endpoint": "https://evil.com/openid/login" })), SITE, STATE)).toBe(false);
    expect(checkReturnParams(map(goodParams({ "openid.mode": "cancel" })), SITE, STATE)).toBe(false);
    expect(checkReturnParams(map(goodParams({ "openid.signed": "signed,op_endpoint,return_to" })), SITE, STATE)).toBe(false); // claimed_id ไม่ถูกเซ็น
    expect(checkReturnParams(map(goodParams({ "openid.identity": `https://steamcommunity.com/openid/id/${OTHER64}` })), SITE, STATE)).toBe(false); // identity ≠ claimed_id
  });
  it("พารามิเตอร์ openid.* ซ้ำ → singleValued = null (กัน parser differential)", () => {
    const dup = goodParams();
    dup.append("openid.claimed_id", `https://steamcommunity.com/openid/id/${OTHER64}`);
    expect(singleValued(dup)).toBeNull();
    expect(singleValued(goodParams())).not.toBeNull();
    // พารามิเตอร์ที่ไม่ใช่ openid.* ซ้ำได้ (ไม่เกี่ยวกับการเซ็น)
    const extra = goodParams(); extra.append("x", "1"); extra.append("x", "2");
    expect(singleValued(extra)).not.toBeNull();
  });
  it("nonce เก่า/อนาคตไกล/รูปแบบผิด → ไม่สด", () => {
    const now = new Date("2026-10-27T10:00:00Z");
    expect(nonceFresh("2026-10-27T09:58:00Zabc", now)).toBe(true);
    expect(nonceFresh("2026-10-27T09:50:00Zabc", now)).toBe(false);
    expect(nonceFresh("2026-10-27T10:20:00Zabc", now)).toBe(false);
    expect(nonceFresh("garbage", now)).toBe(false);
    expect(nonceFresh(undefined, now)).toBe(false);
  });
  it("readStateCookie: ต้องเป็นของ user นี้ · รูปแบบผิด/ของคนอื่น = null", () => {
    expect(readStateCookie(cookieHeader(), UID)).toBe(STATE);
    expect(readStateCookie(cookieHeader(OTHER_UID), UID)).toBeNull();
    expect(readStateCookie(`${STATE_COOKIE}=nonsense`, UID)).toBeNull();
    expect(readStateCookie("a=b", UID)).toBeNull();
    expect(readStateCookie(null, UID)).toBeNull();
  });
  it("verifyAssertion: ไม่มี is_valid:true → ปฏิเสธ · ส่งเฉพาะ openid.* · mode = check_authentication", async () => {
    expect(await verifyAssertion(map(goodParams()), steamSays("ns:x\nis_valid:false\n"))).toBe(false);
    expect(await verifyAssertion(map(goodParams()), steamSays("is_valid:true\n", false))).toBe(false);
    expect(await verifyAssertion(map(goodParams()), (async () => { throw new Error("net"); }) as unknown as typeof fetch)).toBe(false);
    let sent = "";
    const spy = (async (_u: string, init: RequestInit) => { sent = String(init.body); return { ok: true, text: async () => "ns:x\nis_valid:true\n" }; }) as unknown as typeof fetch;
    expect(await verifyAssertion(map(goodParams({ evil: "1" })), spy)).toBe(true);
    const body = new URLSearchParams(sent);
    expect(body.get("openid.mode")).toBe("check_authentication");
    expect(body.has("evil")).toBe(false); // singleValued เก็บเฉพาะ openid.*
  });
  it("SITE_URL ก่อนเสมอ · production ไม่มี = null", () => {
    expect(resolveSiteUrl({ SITE_URL: "https://a.example/" }, "https://x/y")).toBe("https://a.example");
    expect(resolveSiteUrl({ NODE_ENV: "production" }, "https://x/y")).toBeNull();
    expect(resolveSiteUrl({ NODE_ENV: "development" }, "http://localhost:3000/y")).toBe("http://localhost:3000");
  });
  it("processSteamReturn: สำเร็จ → rpc ด้วย uid ที่ส่งมา + account_id · ระงับ/ไม่มี admin/ซ้ำ → error code", async () => {
    const rpc = async (fn: string, args: Record<string, unknown>) => { h.rpcCalls.push({ fn, args }); return { error: h.rpcError }; };
    const base = { params: goodParams(), siteUrl: SITE, userId: "u1", suspended: false, admin: { rpc }, expectedState: STATE, fetchFn: steamSays("is_valid:true") };
    expect(await processSteamReturn(base)).toBe("/me?linked=steam");
    expect(h.rpcCalls).toEqual([{ fn: "link_steam_verified", args: { p_user_id: "u1", p_account_id: "22202" } }]);
    expect(await processSteamReturn({ ...base, suspended: true })).toBe("/me?link_error=suspended");
    h.rpcCalls = [];
    expect(await processSteamReturn({ ...base, expectedState: null })).toBe("/me?link_error=invalid"); // ไม่มี cookie state
    const dup = goodParams(); dup.append("openid.claimed_id", `https://steamcommunity.com/openid/id/${OTHER64}`);
    expect(await processSteamReturn({ ...base, params: dup })).toBe("/me?link_error=invalid"); // claimed_id ซ้ำ
    expect(await processSteamReturn({ ...base, params: goodParams({ "openid.response_nonce": "2020-01-01T00:00:00Zold" }) })).toBe("/me?link_error=invalid"); // nonce เก่า
    expect(h.rpcCalls).toEqual([]);
    expect(await processSteamReturn({ ...base, admin: null })).toBe("/me?link_error=unavailable");
    h.rpcError = { message: "STEAM_ALREADY_LINKED" };
    expect(await processSteamReturn(base)).toBe("/me?link_error=already");
    h.rpcError = { message: "boom" };
    expect(await processSteamReturn(base)).toBe("/me?link_error=failed");
  });
});

describe("route /link/steam/return", () => {
  const call = (qs: URLSearchParams, cookie: string | null = cookieHeader()) =>
    returnGET(new Request(`${SITE}/link/steam/return?${qs.toString()}`, { headers: cookie ? { cookie } : {} }));
  it("ไม่ล็อกอิน → /login · ไม่แตะ rpc", async () => {
    h.user = null;
    const res = await call(goodParams());
    expect(res.headers.get("location")).toContain("/login?next=");
    expect(h.rpcCalls).toEqual([]);
  });
  it("return_to ไม่ตรง → error · ไม่เรียก rpc", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:true"));
    const res = await call(goodParams({ "openid.return_to": `https://evil.com/link/steam/return?state=${STATE}` }));
    expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=invalid`);
    expect(h.rpcCalls).toEqual([]);
  });
  it("Steam ตอบ is_valid:false → ไม่เรียก rpc", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:false"));
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=invalid`);
    expect(h.rpcCalls).toEqual([]);
  });
  it("ผ่าน → rpc ด้วย uid จาก session (ไม่ใช่จาก query) · ลบ cookie state หลังใช้", async () => {
    vi.stubGlobal("fetch", steamSays("ns:x\nis_valid:true\n"));
    const res = await call(goodParams({ user_id: "attacker", p_user_id: "attacker" }));
    expect(res.headers.get("location")).toBe(`${SITE}/me?linked=steam`);
    expect(h.rpcCalls).toEqual([{ fn: "link_steam_verified", args: { p_user_id: UID, p_account_id: "22202" } }]);
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`${STATE_COOKIE}=;`));
  });
  it("CSRF: ไม่มี cookie state / cookie ของคนอื่น / state ไม่ตรง → ไม่เรียก rpc (ลิงก์ return ของผู้โจมตีใช้กับเหยื่อไม่ได้)", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:true"));
    for (const cookie of [null, cookieHeader(OTHER_UID), cookieHeader(UID, "f".repeat(32))]) {
      const res = await call(goodParams(), cookie);
      expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=invalid`);
    }
    expect(h.rpcCalls).toEqual([]);
  });
  it("openid.claimed_id ซ้ำใน URL → ไม่เรียก rpc", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:true"));
    const dup = goodParams(); dup.append("openid.claimed_id", `https://steamcommunity.com/openid/id/${OTHER64}`);
    const res = await call(dup);
    expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=invalid`);
    expect(h.rpcCalls).toEqual([]);
  });
  it("ไม่มี service role (getAdminDb = null) → 'ยังไม่เปิดใช้งาน'", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:true"));
    h.admin = false;
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/me?link_error=unavailable`);
  });
});

// K-AV-LINK.1: /me ไม่มีทางกรอกเลข Dota เองแล้ว (เหลือปุ่มผูก Steam + MLBB กรอกเอง)
describe("หน้า /me ไม่มีช่องกรอก Dota ID", () => {
  const root = join(__dirname, "..");
  it("ไม่มีฟอร์ม/ช่อง dota_id · ปุ่ม Steam อยู่ในแถบชวนผูกที่เดียว", () => {
    expect(existsSync(join(root, "app/me/DotaAccountForm.tsx"))).toBe(false);
    for (const f of ["app/me/page.tsx", "app/me/GameAccountsCard.tsx"]) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).not.toMatch(/dota_id|DotaAccountForm/);
    }
    // K-AV-STEAMLOGIN.4: ปุ่มผูก Steam เหลือปุ่มเดียวในแถบ SteamLinkBanner · การ์ดบัญชีเกมไม่มีปุ่มซ้ำแล้ว
    expect(readFileSync(join(root, "app/me/GameAccountsCard.tsx"), "utf8")).not.toContain('href="/link/steam/start"');
    expect(readFileSync(join(root, "app/me/SteamLinkBanner.tsx"), "utf8")).toContain('href="/link/steam/start"');
  });
});

describe("route /link/steam/start", () => {
  it("ไม่ล็อกอิน → /login (ไม่ตั้ง cookie)", async () => {
    h.user = null;
    const res = await startGET(new Request(`${SITE}/link/steam/start`));
    expect(res.headers.get("location")).toContain("/login?next=");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  // K-AV-LINK.1: ล็อกอินเสร็จต้องกลับมาเริ่ม Steam ต่อทันที · safeNext ยอมรับ path นี้แต่ยังกันลิงก์นอกเว็บ
  it("ไม่ล็อกอิน → next = /link/steam/start และ safeNext ยอมรับ · ลิงก์นอกเว็บยังถูกกัน", async () => {
    h.user = null;
    const loc = new URL((await startGET(new Request(`${SITE}/link/steam/start`))).headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/link/steam/start");
    expect(safeNext(loc.searchParams.get("next"))).toBe("/link/steam/start");
    for (const bad of ["//evil.com", "https://evil.com/link/steam/start", "/\\evil.com", "/\t/evil.com"]) {
      expect(safeNext(bad)).toBe("/me");
    }
  });
  it("ล็อกอิน → redirect ไป Steam · state สุ่มใน return_to ตรงกับ cookie (HttpOnly · SameSite=Lax · ผูก user id)", async () => {
    const res = await startGET(new Request(`${SITE}/link/steam/start`));
    const loc = res.headers.get("location")!;
    expect(loc).toMatch(/^https:\/\/steamcommunity\.com\/openid\/login\?/);
    const state = new URL(new URL(loc).searchParams.get("openid.return_to")!).searchParams.get("state")!;
    expect(state).toMatch(/^[0-9a-f]{32}$/);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain(`${STATE_COOKIE}=${state}.${UID}`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\/link\/steam/);
    // ต้องอ่านกลับได้ด้วย readStateCookie ของ user คนเดิม และของคนอื่นไม่ได้
    const pair = setCookie.split(";")[0];
    expect(readStateCookie(pair, UID)).toBe(state);
    expect(readStateCookie(pair, OTHER_UID)).toBeNull();
    // สุ่มใหม่ทุกครั้ง
    const again = await startGET(new Request(`${SITE}/link/steam/start`));
    expect(again.headers.get("set-cookie")).not.toBe(setCookie);
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
    expect(h.upserts).toEqual([{ user_id: UID, game: "MLBB", external_id: "123456789", zone_id: "2001", status: "UNVERIFIED" }]);
  });
  it("ไม่ล็อกอิน / ถูกระงับ → ไม่ upsert", async () => {
    h.user = null;
    expect((await linkMlbb({ ok: false, message: "" }, fd({ mlbb_id: "123456789", zone_id: "2001" }))).ok).toBe(false);
    h.user = { id: UID }; h.suspended = true;
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
  it("ไม่มีความลับ/อีเมลจริงในโค้ดผูกบัญชี", () => {
    for (const f of ["lib/game-accounts/steam.ts", "app/link/steam/return/route.ts", "app/link/steam/start/route.ts"]) {
      const t = readFileSync(join(process.cwd(), f), "utf8");
      expect(t).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{20,}|[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });
});
