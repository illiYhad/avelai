import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-STEAMLOGIN: ล็อกอิน/สร้างบัญชีด้วย Steam — ไม่ยิง Steam/DB จริง (ทุกอย่างผ่าน mock)

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  admin: true,
  rows: [] as { user_id: string; status: string; verified_via: string | null }[],
  created: [] as string[],
  deleted: [] as string[],
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpcError: null as { message: string } | null,
  suspended: false,
  verifyOtpCalls: [] as { token_hash: string; type: string }[],
  verifyOtpError: null as { message: string } | null,
  generateLinkError: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/suspension", () => ({ isUserSuspended: async () => h.suspended }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: {
      getUser: async () => ({ data: { user: h.user } }),
      verifyOtp: async (a: { token_hash: string; type: string }) => { h.verifyOtpCalls.push(a); return { error: h.verifyOtpError }; },
    },
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  getAdminDb: () => (h.admin ? adminDb() : null),
}));

function adminDb() {
  // from("game_accounts").select().eq()… .maybeSingle() → กรองจาก h.rows แบบง่าย
  const q = (filters: Record<string, string>) => ({
    eq(col: string, v: string) { filters[col] = v; return q(filters); },
    async maybeSingle() {
      const row = h.rows.find((r) =>
        (filters.status === undefined || r.status === filters.status) &&
        (filters.verified_via === undefined || r.verified_via === filters.verified_via));
      return { data: row ? { user_id: row.user_id } : null, error: null };
    },
  });
  return {
    from: () => ({ select: () => q({}) }),
    rpc: async (fn: string, args: Record<string, unknown>) => { h.rpcCalls.push({ fn, args }); return { error: h.rpcError }; },
    auth: {
      admin: {
        createUser: async ({ email }: { email: string }) => { const id = `new-${h.created.length + 1}`; h.created.push(email); return { data: { user: { id, email } }, error: null }; },
        deleteUser: async (id: string) => { h.deleted.push(id); return { data: {}, error: null }; },
        getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@x` } }, error: null }),
        generateLink: async () => ({ data: { properties: { hashed_token: "HASHED" } }, error: h.generateLinkError }),
      },
    },
  };
}

import {
  buildStartUrl, checkReturnParams, returnToWithState, singleValued, processSteamLogin, readLoginStateCookie, loginStateCookieValue,
  steamLoginEmail, isSteamLoginEmail, steamLoginMessage, verifySteamLoginReturn, LOGIN_RETURN_PATH, LOGIN_STATE_COOKIE, RETURN_PATH, STEAM_OPENID_ENDPOINT,
  type SteamLoginDeps,
} from "@/lib/game-accounts/steam";
import { GET as startGET } from "@/app/auth/steam/start/route";
import { GET as returnGET } from "@/app/auth/steam/return/route";
import { GET as linkStartGET } from "@/app/link/steam/start/route";

const SITE = "https://avelai.example";
const STEAM64 = "76561197960287930"; // → account_id 22202
const STATE = "0123456789abcdef0123456789abcdef";
// K-AV-STEAMLOGIN.1: อีเมลภายในเป็น UUID สุ่ม · ต้องไม่มี steam64 ปนอยู่
const STEAM_EMAIL_RE = /^steam-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@steam\.avelai\.org$/;
const expectCreatedRandom = (created: string[]) => {
  expect(created).toHaveLength(1);
  expect(created[0]).toMatch(STEAM_EMAIL_RE);
  expect(created[0]).not.toContain(STEAM64);
};
const nowNonce = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const goodParams = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OPENID_ENDPOINT,
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM64}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM64}`,
    "openid.return_to": returnToWithState(SITE, STATE, LOGIN_RETURN_PATH),
    "openid.response_nonce": `${nowNonce()}abc`,
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "x",
    ...over,
  });
const steamSays = (body: string) => (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
const cookieHeader = (next = "/me") => `${LOGIN_STATE_COOKIE}=${loginStateCookieValue(STATE, next)}`;

function deps(over: Partial<SteamLoginDeps> = {}): SteamLoginDeps {
  const a = adminDb();
  return {
    findVerifiedUserId: async () => { const r = await a.from().select().eq("status", "VERIFIED").eq("verified_via", "STEAM_OPENID").maybeSingle(); return r.data?.user_id ?? null; },
    createUser: async (email) => (await a.auth.admin.createUser({ email })).data.user.id,
    linkSteam: async (userId, accountId) => a.rpc("link_steam_verified", { p_user_id: userId, p_account_id: accountId }),
    deleteUser: async (id) => { await a.auth.admin.deleteUser(id); },
    isSuspended: async () => h.suspended,
    signIn: async () => true,
    ...over,
  };
}

beforeEach(() => {
  h.user = null; h.admin = true; h.rows = []; h.created = []; h.deleted = []; h.rpcCalls = []; h.rpcError = null;
  h.suspended = false; h.verifyOtpCalls = []; h.verifyOtpError = null; h.generateLinkError = null;
  vi.stubEnv("SITE_URL", SITE);
  vi.stubGlobal("fetch", steamSays("is_valid:true"));
});

describe("return path แยกจากการผูก · ของเดิมไม่เปลี่ยน", () => {
  it("ค่าเริ่มต้นยังเป็น /link/steam/return · ล็อกอินใช้ /auth/steam/return", () => {
    expect(returnToWithState(SITE, STATE)).toBe(`${SITE}${RETURN_PATH}?state=${STATE}`);
    expect(returnToWithState(SITE, STATE, LOGIN_RETURN_PATH)).toBe(`${SITE}/auth/steam/return?state=${STATE}`);
    expect(new URL(buildStartUrl(SITE, STATE)).searchParams.get("openid.return_to")).toBe(`${SITE}${RETURN_PATH}?state=${STATE}`);
    expect(new URL(buildStartUrl(SITE, STATE, LOGIN_RETURN_PATH)).searchParams.get("openid.return_to")).toBe(`${SITE}${LOGIN_RETURN_PATH}?state=${STATE}`);
  });
  it("checkReturnParams: return_to ของทางล็อกอินใช้กับทางผูกไม่ได้ และกลับกัน", () => {
    const p = singleValued(goodParams())!;
    expect(checkReturnParams(p, SITE, STATE, new Date(), LOGIN_RETURN_PATH)).toBe(true);
    expect(checkReturnParams(p, SITE, STATE)).toBe(false);
  });
  it("cookie ล็อกอิน: อ่านกลับได้ · รูปแบบผิด = null", () => {
    expect(readLoginStateCookie(cookieHeader("/dota2/me?x=1"))).toEqual({ state: STATE, next: "/dota2/me?x=1" });
    expect(readLoginStateCookie(`${LOGIN_STATE_COOKIE}=zzz`)).toBeNull();
    expect(readLoginStateCookie(`steam_link_state=${STATE}.u`)).toBeNull();
    expect(readLoginStateCookie(null)).toBeNull();
  });
  it("อีเมลภายใน (K-AV-STEAMLOGIN.1: UUID สุ่ม · ไม่มี SteamID · เรียกสองครั้งไม่ซ้ำ) + ข้อความ error จากรายการคงที่เท่านั้น", () => {
    const a = steamLoginEmail();
    const b = steamLoginEmail();
    expect(a).toMatch(STEAM_EMAIL_RE);
    expect(b).toMatch(STEAM_EMAIL_RE);
    expect(a).not.toBe(b);
    expect(a).not.toContain(STEAM64);
    expect(a).not.toContain("22202");
    expect(isSteamLoginEmail(a)).toBe(true);
    expect(isSteamLoginEmail("STEAM-X@STEAM.AVELAI.ORG")).toBe(true);
    expect(isSteamLoginEmail("kolt@gmail.com")).toBe(false);
    expect(isSteamLoginEmail("x@steam.avelai.org.evil.com")).toBe(false);
    expect(isSteamLoginEmail(null)).toBe(false);
    expect(isSteamLoginEmail(undefined)).toBe(false);
    expect(steamLoginMessage("invalid")).toMatch(/Steam/);
    expect(steamLoginMessage("suspended")).toMatch(/ระงับ/);
    expect(steamLoginMessage("<script>alert(1)</script>")).toBeNull();
    expect(steamLoginMessage("toString")).toBeNull();
    expect(steamLoginMessage(undefined)).toBeNull();
  });
});

describe("processSteamLogin", () => {
  const base = () => ({ params: goodParams(), siteUrl: SITE, expectedState: STATE, fetchFn: steamSays("is_valid:true") });

  it("ลายเซ็น/nonce/state ไม่ผ่าน หรือไม่มี cookie → invalid · ไม่สร้างบัญชี ไม่ตั้ง session", async () => {
    const calls: string[] = [];
    const d = deps({ createUser: async () => { calls.push("create"); return "x"; }, signIn: async () => { calls.push("signin"); return true; } });
    expect(await processSteamLogin({ ...base(), deps: d, expectedState: null })).toEqual({ ok: false, error: "invalid" });
    expect(await processSteamLogin({ ...base(), deps: d, expectedState: "f".repeat(32) })).toEqual({ ok: false, error: "invalid" });
    expect(await processSteamLogin({ ...base(), deps: d, fetchFn: steamSays("is_valid:false") })).toEqual({ ok: false, error: "invalid" });
    expect(await processSteamLogin({ ...base(), deps: d, params: goodParams({ "openid.response_nonce": "2020-01-01T00:00:00Zold" }) })).toEqual({ ok: false, error: "invalid" });
    expect(await processSteamLogin({ ...base(), deps: d, params: goodParams({ "openid.return_to": `${SITE}${RETURN_PATH}?state=${STATE}` }) })).toEqual({ ok: false, error: "invalid" });
    expect(calls).toEqual([]);
    expect(await verifySteamLoginReturn({ ...base() })).toEqual({ steam64: STEAM64, accountId: "22202" });
  });

  it("ไม่มี admin → unavailable", async () => {
    expect(await processSteamLogin({ ...base(), deps: null })).toEqual({ ok: false, error: "unavailable" });
  });

  it("Steam ที่ผูกแล้ว (VERIFIED+STEAM_OPENID) → เข้าบัญชีเดิม · ไม่เรียก createUser", async () => {
    h.rows = [{ user_id: "u-old", status: "VERIFIED", verified_via: "STEAM_OPENID" }];
    const signed: string[] = [];
    const r = await processSteamLogin({ ...base(), deps: deps({ signIn: async (id) => { signed.push(id); return true; } }) });
    expect(r).toEqual({ ok: true, userId: "u-old" });
    expect(h.created).toEqual([]);
    expect(h.rpcCalls).toEqual([]);
    expect(signed).toEqual(["u-old"]);
  });

  it("แถว UNVERIFIED ไม่นับว่าผูกแล้ว → สร้างบัญชีใหม่", async () => {
    h.rows = [{ user_id: "u-fake", status: "UNVERIFIED", verified_via: null }];
    const r = await processSteamLogin({ ...base(), deps: deps() });
    expect(r).toEqual({ ok: true, userId: "new-1" });
    expectCreatedRandom(h.created);
  });

  it("Steam ใหม่ → สร้าง 1 บัญชี + ผูก VERIFIED ก่อนตั้ง session + เข้าได้", async () => {
    const order: string[] = [];
    const d = deps({
      linkSteam: async (userId, accountId) => { order.push(`link:${userId}:${accountId}`); return { error: null }; },
      signIn: async (id) => { order.push(`signin:${id}`); return true; },
    });
    expect(await processSteamLogin({ ...base(), deps: d })).toEqual({ ok: true, userId: "new-1" });
    expect(h.created).toHaveLength(1);
    expect(order).toEqual(["link:new-1:22202", "signin:new-1"]);
    expect(h.deleted).toEqual([]);
  });

  it("ผูกไม่สำเร็จ → ลบบัญชีที่เพิ่งสร้าง · ไม่ตั้ง session", async () => {
    h.rpcError = { message: "boom" };
    const signed: string[] = [];
    const r = await processSteamLogin({ ...base(), deps: deps({ signIn: async (id) => { signed.push(id); return true; } }) });
    expect(r).toEqual({ ok: false, error: "failed" });
    expect(h.deleted).toEqual(["new-1"]);
    expect(signed).toEqual([]);
  });

  it("STEAM_ALREADY_LINKED (กดพร้อมกัน) → ลบบัญชีใหม่ แล้วเข้าบัญชีที่ผูกอยู่ · ไม่เกิดบัญชีซ้ำ", async () => {
    h.rpcError = { message: "STEAM_ALREADY_LINKED" };
    let lookups = 0;
    const d = deps({
      findVerifiedUserId: async () => (++lookups === 1 ? null : "u-winner"), // รอบแรกยังไม่เจอ · หลัง rpc ชน เจอผู้ชนะ
      linkSteam: async () => { h.rows = [{ user_id: "u-winner", status: "VERIFIED", verified_via: "STEAM_OPENID" }]; return { error: h.rpcError }; },
    });
    expect(await processSteamLogin({ ...base(), deps: d })).toEqual({ ok: true, userId: "u-winner" });
    expect(h.created).toHaveLength(1);
    expect(h.deleted).toEqual(["new-1"]);
    expect(lookups).toBe(2);
  });

  it("บัญชีถูกระงับ → suspended · ไม่ตั้ง session", async () => {
    h.rows = [{ user_id: "u-bad", status: "VERIFIED", verified_via: "STEAM_OPENID" }];
    h.suspended = true;
    const signed: string[] = [];
    const r = await processSteamLogin({ ...base(), deps: deps({ signIn: async (id) => { signed.push(id); return true; } }) });
    expect(r).toEqual({ ok: false, error: "suspended" });
    expect(signed).toEqual([]);
  });

  it("signIn ล้ม → failed", async () => {
    h.rows = [{ user_id: "u-old", status: "VERIFIED", verified_via: "STEAM_OPENID" }];
    expect(await processSteamLogin({ ...base(), deps: deps({ signIn: async () => false }) })).toEqual({ ok: false, error: "failed" });
  });
});

describe("route /auth/steam/start", () => {
  it("ไม่ล็อกอิน → ไป Steam พร้อม return_to /auth/steam/return + cookie state (HttpOnly · Lax · path /auth/steam · 600s)", async () => {
    const res = await startGET(new Request(`${SITE}/auth/steam/start?next=%2Fdota2%2Fme`));
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe(STEAM_OPENID_ENDPOINT);
    const rt = new URL(loc.searchParams.get("openid.return_to")!);
    expect(rt.pathname).toBe("/auth/steam/return");
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^steam_login_state=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/Path=\/auth\/steam/);
    expect(setCookie).toMatch(/Max-Age=600/);
    const parsed = readLoginStateCookie(setCookie.split(";")[0]);
    expect(parsed!.state).toBe(rt.searchParams.get("state"));
    expect(parsed!.next).toBe("/dota2/me");
  });
  it("next ลิงก์นอกเว็บถูกตัดเป็น /me", async () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
      const res = await startGET(new Request(`${SITE}/auth/steam/start?next=${encodeURIComponent(bad)}`));
      expect(readLoginStateCookie(res.headers.get("set-cookie")!.split(";")[0])!.next).toBe("/me");
    }
  });
  it("มี session อยู่แล้ว → /link/steam/start (ไม่ตั้ง cookie ล็อกอิน)", async () => {
    h.user = { id: "u1" };
    const res = await startGET(new Request(`${SITE}/auth/steam/start`));
    expect(res.headers.get("location")).toBe(`${SITE}/link/steam/start`);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("ไม่มี SITE_URL บน production → unavailable", async () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await startGET(new Request(`${SITE}/auth/steam/start`));
    expect(res.headers.get("location")).toContain("/login?steam_error=unavailable");
  });
});

describe("route /auth/steam/return", () => {
  const call = (qs: URLSearchParams, cookie: string | null = cookieHeader()) =>
    returnGET(new Request(`${SITE}/auth/steam/return?${qs.toString()}`, { headers: cookie ? { cookie } : {} }));
  const cleared = (res: Response) => expect(res.headers.get("set-cookie")).toMatch(/^steam_login_state=;.*Max-Age=0/);

  it("มี session อยู่แล้ว → /link/steam/start · ไม่แตะ admin", async () => {
    h.user = { id: "u1" };
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/link/steam/start`);
    expect(h.created).toEqual([]);
    expect(h.verifyOtpCalls).toEqual([]);
    cleared(res);
  });
  it("ไม่มี cookie → invalid · ไม่สร้างบัญชี ไม่ตั้ง session · cookie ถูกลบ", async () => {
    const res = await call(goodParams(), null);
    expect(res.headers.get("location")).toBe(`${SITE}/login?steam_error=invalid`);
    expect(h.created).toEqual([]);
    expect(h.verifyOtpCalls).toEqual([]);
    cleared(res);
  });
  it("Steam ตอบ is_valid:false → invalid", async () => {
    vi.stubGlobal("fetch", steamSays("is_valid:false"));
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/login?steam_error=invalid`);
    expect(h.created).toEqual([]);
  });
  it("Steam ใหม่ → createUser(email_confirm) → rpc link → generateLink → verifyOtp(hashed_token, magiclink) → ไป next จาก cookie", async () => {
    const res = await call(goodParams(), cookieHeader("/dota2/me"));
    expect(res.headers.get("location")).toBe(`${SITE}/dota2/me`);
    expectCreatedRandom(h.created);
    expect(h.rpcCalls).toEqual([{ fn: "link_steam_verified", args: { p_user_id: "new-1", p_account_id: "22202" } }]);
    expect(h.verifyOtpCalls).toEqual([{ token_hash: "HASHED", type: "magiclink" }]);
    cleared(res);
  });
  it("Steam ที่ผูกแล้ว → ไม่ createUser · verifyOtp ของบัญชีเดิม", async () => {
    h.rows = [{ user_id: "u-old", status: "VERIFIED", verified_via: "STEAM_OPENID" }];
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/me`);
    expect(h.created).toEqual([]);
    expect(h.verifyOtpCalls).toHaveLength(1);
  });
  it("next ในคุกกี้เป็นลิงก์นอกเว็บ → ไป /me", async () => {
    const res = await call(goodParams(), `${LOGIN_STATE_COOKIE}=${STATE}.${encodeURIComponent("https://evil.com")}`);
    expect(res.headers.get("location")).toBe(`${SITE}/me`);
  });
  it("ผูกไม่สำเร็จ → ลบบัญชีใหม่ · ไม่ verifyOtp · failed", async () => {
    h.rpcError = { message: "boom" };
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/login?steam_error=failed`);
    expect(h.deleted).toEqual(["new-1"]);
    expect(h.verifyOtpCalls).toEqual([]);
  });
  it("ระงับ → suspended · ไม่ verifyOtp", async () => {
    h.rows = [{ user_id: "u-bad", status: "VERIFIED", verified_via: "STEAM_OPENID" }];
    h.suspended = true;
    const res = await call(goodParams());
    expect(res.headers.get("location")).toBe(`${SITE}/login?steam_error=suspended`);
    expect(h.verifyOtpCalls).toEqual([]);
  });
  it("generateLink / verifyOtp ล้ม → failed ไม่ให้เข้า", async () => {
    h.rows = [{ user_id: "u-old", status: "VERIFIED", verified_via: "STEAM_OPENID" }];
    h.generateLinkError = { message: "x" };
    expect((await call(goodParams())).headers.get("location")).toBe(`${SITE}/login?steam_error=failed`);
    h.generateLinkError = null; h.verifyOtpError = { message: "x" };
    expect((await call(goodParams())).headers.get("location")).toBe(`${SITE}/login?steam_error=failed`);
  });
  it("ไม่มี admin → unavailable", async () => {
    h.admin = false;
    expect((await call(goodParams())).headers.get("location")).toBe(`${SITE}/login?steam_error=unavailable`);
  });
});

describe("ทางผูกเดิมไม่เปลี่ยน", () => {
  it("/link/steam/start ยังใช้ return_to /link/steam/return และ cookie steam_link_state", async () => {
    h.user = { id: "11111111-2222-3333-4444-555555555555" };
    const res = await linkStartGET(new Request(`${SITE}/link/steam/start`));
    const rt = new URL(new URL(res.headers.get("location")!).searchParams.get("openid.return_to")!);
    expect(rt.pathname).toBe("/link/steam/return");
    expect(res.headers.get("set-cookie")).toMatch(/^steam_link_state=/);
  });
});
