import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-STEAMLOGIN.2: ล็อกอิน Steam ครั้งแรก "ถามก่อนสร้างบัญชี" — ไม่ยิง Steam/Supabase จริง (ทุกอย่างผ่าน mock)

type Row = { user_id: string; external_id: string; status: string; verified_via: string | null };

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  admin: true,
  rows: [] as { user_id: string; external_id: string; status: string; verified_via: string | null }[],
  created: [] as string[],
  deleted: [] as string[],
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpcError: null as { message: string } | null,
  suspended: false,
  otpSends: [] as unknown[],
  otpSendError: null as { message: string } | null,
  verifyCalls: [] as Record<string, unknown>[],
  otpUser: null as { id: string } | null,
  jar: new Map<string, string>(),
  redirects: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/suspension", () => ({ isUserSuspended: async () => h.suspended }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { h.redirects.push(to); throw new Error(`REDIRECT:${to}`); },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name)! } : undefined),
    set: (name: string, value: string, opts?: { maxAge?: number }) => {
      if (value === "" || opts?.maxAge === 0) h.jar.delete(name);
      else h.jar.set(name, value);
    },
  }),
}));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: {
      getUser: async () => ({ data: { user: h.user } }),
      signInWithOtp: async (a: unknown) => { h.otpSends.push(a); return { data: {}, error: h.otpSendError }; },
      verifyOtp: async (a: Record<string, unknown>) => {
        h.verifyCalls.push(a);
        if (a.type === "magiclink") return { data: { user: null }, error: null }; // ทางตั้ง session ของบัญชีใหม่ (signIn)
        return h.otpUser ? { data: { user: h.otpUser }, error: null } : { data: { user: null }, error: { message: "Token has expired or is invalid" } };
      },
    },
  }),
}));
vi.mock("@/lib/db/admin", () => ({ getAdminDb: () => (h.admin ? adminDb() : null) }));

function adminDb() {
  const q = (filters: Record<string, string>) => ({
    eq(col: string, v: string) { return q({ ...filters, [col]: v }); },
    async maybeSingle() {
      const row = h.rows.find((r) => Object.entries(filters).every(([k, v]) => k === "game" || (r as unknown as Record<string, unknown>)[k] === v));
      return { data: row ?? null, error: null };
    },
  });
  return {
    from: () => ({ select: () => q({}) }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ fn, args });
      if (!h.rpcError) h.rows.push({ user_id: String(args.p_user_id), external_id: String(args.p_account_id), status: "VERIFIED", verified_via: "STEAM_OPENID" });
      return { error: h.rpcError };
    },
    auth: {
      admin: {
        createUser: async ({ email }: { email: string }) => { const id = `new-${h.created.length + 1}`; h.created.push(email); return { data: { user: { id, email } }, error: null }; },
        deleteUser: async (id: string) => { h.deleted.push(id); return { data: {}, error: null }; },
        getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@x` } }, error: null }),
        generateLink: async () => ({ data: { properties: { hashed_token: "HASHED" } }, error: null }),
      },
    },
  };
}

import type { SteamLoginDeps } from "@/lib/game-accounts/steam";
import {
  cookieValue, createFromPending, linkPendingToUser, pendingSecret, readPending, signPending,
  CHOOSE_MESSAGES, OTP_BAD_CODE_MESSAGE, OTP_SENT_COOKIE, OTP_SENT_MESSAGE, OTP_WAIT_MESSAGE, PENDING_COOKIE, PENDING_TTL_SEC,
  type LinkPendingDeps, type Pending,
} from "@/lib/game-accounts/steam-pending";
import { newPlayerAction, sendCodeAction, verifyCodeAction, type ChooseState } from "@/app/login/steam/choose/actions";

const SECRET = "test-only-pending-secret-0123456789abcdef"; // ค่าเทสเท่านั้น ไม่ใช่ secret จริง
const STEAM64 = "76561197960287930"; // → account_id 22202
const ACCOUNT = "22202";
const NOW = new Date("2026-11-05T12:00:00Z");
const verified = (user_id: string, external_id = ACCOUNT): Row => ({ user_id, external_id, status: "VERIFIED", verified_via: "STEAM_OPENID" });
const PENDING: Pending = { steam64: STEAM64, accountId: ACCOUNT, exp: 0 };
const init: ChooseState = { ok: false, message: "" };
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
/** เรียก action ที่จบด้วย redirect() — คืนปลายทาง หรือ state ถ้าไม่ redirect */
const run = async (p: Promise<ChooseState>): Promise<ChooseState | string> => {
  try { return await p; } catch (e) { const m = /^REDIRECT:(.*)$/.exec((e as Error).message); if (m) return m[1]; throw e; }
};

beforeEach(() => {
  h.user = null; h.admin = true; h.rows = []; h.created = []; h.deleted = []; h.rpcCalls = []; h.rpcError = null; h.suspended = false;
  h.otpSends = []; h.otpSendError = null; h.verifyCalls = []; h.otpUser = null; h.jar = new Map(); h.redirects = [];
  vi.stubEnv("STEAM_PENDING_SECRET", SECRET);
});

describe("cookie pending: ลายเซ็น · อายุ · secret", () => {
  it("ออกแล้วอ่านกลับได้ · รูปแบบ v1.<steam64>.<exp>.<nonce>.<hmac> · อายุ 10 นาที", () => {
    const v = signPending(STEAM64, SECRET, NOW);
    expect(v).toMatch(/^v1\.76561197960287930\.\d{10}\.[0-9a-f]{32}\.[0-9a-f]{64}$/);
    const exp = Math.floor(NOW.getTime() / 1000) + 600;
    expect(readPending(v, SECRET, NOW)).toEqual({ steam64: STEAM64, accountId: ACCOUNT, exp });
    expect(PENDING_TTL_SEC).toBe(600);
    // nonce สุ่มทุกครั้ง → ค่าไม่ซ้ำ
    expect(signPending(STEAM64, SECRET, NOW)).not.toBe(v);
  });

  it("ลายเซ็นผิด → ปฏิเสธ: แก้ Steam ID · แก้เวลาหมดอายุ · แก้ nonce · แก้ลายเซ็น · ใช้ secret คนละตัว", () => {
    const v = signPending(STEAM64, SECRET, NOW);
    const [ver, id, exp, nonce, sig] = v.split(".");
    expect(readPending([ver, "76561197960287931", exp, nonce, sig].join("."), SECRET, NOW)).toBeNull();
    expect(readPending([ver, id, String(Number(exp) + 1), nonce, sig].join("."), SECRET, NOW)).toBeNull();
    expect(readPending([ver, id, exp, "0".repeat(32), sig].join("."), SECRET, NOW)).toBeNull();
    expect(readPending([ver, id, exp, nonce, "0".repeat(64)].join("."), SECRET, NOW)).toBeNull();
    expect(readPending(v, "another-secret-another-secret-another-00", NOW)).toBeNull();
  });

  it("หมดอายุ → ปฏิเสธ (ครบ 10 นาทีพอดีก็ไม่ผ่าน) · ก่อนหมดอายุ 1 วินาทียังผ่าน", () => {
    const v = signPending(STEAM64, SECRET, NOW);
    expect(readPending(v, SECRET, new Date(NOW.getTime() + 599_000))).not.toBeNull();
    expect(readPending(v, SECRET, new Date(NOW.getTime() + 600_000))).toBeNull();
    expect(readPending(v, SECRET, new Date(NOW.getTime() + 3_600_000))).toBeNull();
    // ลายเซ็นถูกแต่อายุยาวเกินที่ระบบออกให้ (ออกจากนาฬิกาอนาคต) → ปฏิเสธ
    expect(readPending(signPending(STEAM64, SECRET, new Date(NOW.getTime() + 60_000)), SECRET, NOW)).toBeNull();
  });

  it("ไม่มี secret → ปฏิเสธทุกค่า · รูปแบบผิด → ปฏิเสธ", () => {
    const v = signPending(STEAM64, SECRET, NOW);
    expect(readPending(v, null, NOW)).toBeNull();
    for (const bad of [null, undefined, "", "x", "v1.1.2.3.4", `v2${v.slice(2)}`, `${v}00`, v.toUpperCase()]) {
      expect(readPending(bad, SECRET, NOW)).toBeNull();
    }
  });

  it("pendingSecret: ไม่มี · ว่าง · สั้นกว่า 32 = null (fail closed) · ไม่มีค่าสำรอง", () => {
    expect(pendingSecret({})).toBeNull();
    expect(pendingSecret({ STEAM_PENDING_SECRET: "" })).toBeNull();
    expect(pendingSecret({ STEAM_PENDING_SECRET: "   " })).toBeNull();
    expect(pendingSecret({ STEAM_PENDING_SECRET: "a".repeat(31) })).toBeNull();
    expect(pendingSecret({ STEAM_PENDING_SECRET: "a".repeat(32) })).toBe("a".repeat(32));
    expect(pendingSecret({ NODE_ENV: "development" })).toBeNull(); // dev ก็ไม่มีข้อยกเว้น
    expect(cookieValue(`a=1; ${PENDING_COOKIE}=abc.def; b=2`, PENDING_COOKIE)).toBe("abc.def");
    expect(cookieValue("a=1", PENDING_COOKIE)).toBeNull();
  });
});

describe("ทาง ก. createFromPending (ผู้เล่นใหม่)", () => {
  const deps = (over: Partial<SteamLoginDeps> = {}): SteamLoginDeps => ({
    findVerifiedUserId: async (acc) => h.rows.find((r) => r.external_id === acc && r.status === "VERIFIED")?.user_id ?? null,
    createUser: async (email) => { h.created.push(email); return `new-${h.created.length}`; },
    linkSteam: async (userId, accountId) => { h.rpcCalls.push({ fn: "link", args: { userId, accountId } }); return { error: h.rpcError }; },
    deleteUser: async (id) => { h.deleted.push(id); },
    isSuspended: async () => h.suspended,
    signIn: async () => true,
    ...over,
  });

  it("สร้าง 1 บัญชี (อีเมลภายในสุ่ม) → ผูก Steam ก่อนตั้ง session → เข้าได้", async () => {
    const order: string[] = [];
    const r = await createFromPending({
      pending: PENDING,
      deps: deps({
        linkSteam: async (u, a) => { order.push(`link:${u}:${a}`); return { error: null }; },
        signIn: async (u) => { order.push(`signin:${u}`); return true; },
      }),
    });
    expect(r).toEqual({ ok: true, userId: "new-1" });
    expect(h.created).toHaveLength(1);
    expect(h.created[0]).toMatch(/^steam-[0-9a-f-]{36}@steam\.avelai\.org$/);
    expect(h.created[0]).not.toContain(STEAM64);
    expect(order).toEqual(["link:new-1:22202", "signin:new-1"]);
    expect(h.deleted).toEqual([]);
  });

  it("cookie ใช้ไม่ได้ (null) → expired · ไม่มี admin → unavailable · ไม่สร้างบัญชี", async () => {
    expect(await createFromPending({ pending: null, deps: deps() })).toEqual({ ok: false, error: "expired" });
    expect(await createFromPending({ pending: PENDING, deps: null })).toEqual({ ok: false, error: "unavailable" });
    expect(h.created).toEqual([]);
  });

  it("Steam ID ถูกผูกไปแล้ว (ใช้ cookie ซ้ำหลังสำเร็จ หรือมีคนผูกระหว่างรอ) → taken · ไม่สร้าง ไม่เข้าบัญชีนั้นให้", async () => {
    h.rows = [verified("u-other")];
    const signed: string[] = [];
    const r = await createFromPending({ pending: PENDING, deps: deps({ signIn: async (u) => { signed.push(u); return true; } }) });
    expect(r).toEqual({ ok: false, error: "taken" });
    expect(h.created).toEqual([]);
    expect(signed).toEqual([]);
  });

  it("ผูกไม่สำเร็จ → ลบเฉพาะบัญชีที่เพิ่งสร้าง · ไม่ตั้ง session", async () => {
    h.rpcError = { message: "boom" };
    const signed: string[] = [];
    const r = await createFromPending({ pending: PENDING, deps: deps({ signIn: async (u) => { signed.push(u); return true; } }) });
    expect(r).toEqual({ ok: false, error: "failed" });
    expect(h.deleted).toEqual(["new-1"]);
    expect(signed).toEqual([]);
  });

  it("STEAM_ALREADY_LINKED (กดพร้อมกัน) → ลบบัญชีใหม่ · taken · ไม่เข้าบัญชีของอีกฝั่ง", async () => {
    h.rpcError = { message: "STEAM_ALREADY_LINKED" };
    const signed: string[] = [];
    const r = await createFromPending({ pending: PENDING, deps: deps({ signIn: async (u) => { signed.push(u); return true; } }) });
    expect(r).toEqual({ ok: false, error: "taken" });
    expect(h.deleted).toEqual(["new-1"]);
    expect(signed).toEqual([]);
  });

  it("อ่านฐานข้อมูลไม่ได้ · createUser ล้ม · signIn ล้ม → failed", async () => {
    expect(await createFromPending({ pending: PENDING, deps: deps({ findVerifiedUserId: async () => undefined }) })).toEqual({ ok: false, error: "failed" });
    expect(await createFromPending({ pending: PENDING, deps: deps({ createUser: async () => null }) })).toEqual({ ok: false, error: "failed" });
    expect(await createFromPending({ pending: PENDING, deps: deps({ signIn: async () => false }) })).toEqual({ ok: false, error: "failed" });
  });
});

describe("ทาง ข. linkPendingToUser (ผูกเข้าบัญชีเดิม)", () => {
  const deps = (over: Partial<LinkPendingDeps> = {}): LinkPendingDeps => ({
    findVerifiedUserId: async (acc) => h.rows.find((r) => r.external_id === acc && r.status === "VERIFIED")?.user_id ?? null,
    findUserVerifiedSteam: async (u) => h.rows.find((r) => r.user_id === u && r.status === "VERIFIED")?.external_id ?? null,
    linkSteam: async (userId, accountId) => { h.rpcCalls.push({ fn: "link", args: { userId, accountId } }); return { error: h.rpcError }; },
    isSuspended: async () => h.suspended,
    ...over,
  });

  it("บัญชีเดิมยังไม่ผูก Steam → ผูก 1 ครั้งด้วย userId ที่ส่งเข้ามา", async () => {
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps() })).toEqual({ ok: true, userId: "u-me" });
    expect(h.rpcCalls).toEqual([{ fn: "link", args: { userId: "u-me", accountId: ACCOUNT } }]);
  });

  it("Q4: บัญชีเดิมผูก Steam อื่นไว้แล้ว → other_steam · ไม่เขียนอะไร (ห้ามทับ)", async () => {
    h.rows = [verified("u-me", "99999")];
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps() })).toEqual({ ok: false, error: "other_steam" });
    expect(h.rpcCalls).toEqual([]);
  });

  it("Steam ID นี้ถูกผูกกับบัญชีอื่นไปแล้ว → taken · ไม่เขียนอะไร (ห้ามย้าย)", async () => {
    h.rows = [verified("u-other")];
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps() })).toEqual({ ok: false, error: "taken" });
    expect(h.rpcCalls).toEqual([]);
  });

  it("ชนตอนเขียน (STEAM_ALREADY_LINKED จาก RPC) → taken · ล้มอย่างอื่น → failed", async () => {
    h.rpcError = { message: "STEAM_ALREADY_LINKED" };
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps() })).toEqual({ ok: false, error: "taken" });
    h.rpcError = { message: "boom" };
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps() })).toEqual({ ok: false, error: "failed" });
  });

  it("ผูกกับบัญชีนี้อยู่แล้ว → สำเร็จโดยไม่เขียนซ้ำ", async () => {
    h.rows = [verified("u-me")];
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps() })).toEqual({ ok: true, userId: "u-me" });
    expect(h.rpcCalls).toEqual([]);
  });

  it("ระงับ · cookie ใช้ไม่ได้ · ไม่มี admin · อ่านฐานข้อมูลไม่ได้ → ปฏิเสธ ไม่เขียนอะไร", async () => {
    h.suspended = true;
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps() })).toEqual({ ok: false, error: "suspended" });
    h.suspended = false;
    expect(await linkPendingToUser({ pending: null, userId: "u-me", deps: deps() })).toEqual({ ok: false, error: "expired" });
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: null })).toEqual({ ok: false, error: "unavailable" });
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps({ findUserVerifiedSteam: async () => undefined }) })).toEqual({ ok: false, error: "failed" });
    expect(await linkPendingToUser({ pending: PENDING, userId: "u-me", deps: deps({ findVerifiedUserId: async () => undefined }) })).toEqual({ ok: false, error: "failed" });
    expect(h.rpcCalls).toEqual([]);
  });
});

describe("action ของหน้า /login/steam/choose", () => {
  const setPending = (now: Date = new Date()) => h.jar.set(PENDING_COOKIE, signPending(STEAM64, SECRET, now));

  it("ส่งรหัส: เรียก signInWithOtp ด้วย shouldCreateUser:false · ตั้ง cookie กันกดซ้ำ", async () => {
    setPending();
    const r = await sendCodeAction(init, form({ email: " Me@Example.com " }));
    expect(h.otpSends).toEqual([{ email: "me@example.com", options: { shouldCreateUser: false } }]);
    expect(r).toEqual({ ok: true, message: OTP_SENT_MESSAGE, step: "code", email: "me@example.com" });
    expect(h.jar.has(OTP_SENT_COOKIE)).toBe(true);
  });

  it("Q3: อีเมลไม่มีในระบบ (Supabase ตอบ error) ได้ผลลัพธ์เหมือนกรณีมีทุกตัวอักษร", async () => {
    setPending();
    const exists = await sendCodeAction(init, form({ email: "me@example.com" }));
    h.jar.delete(OTP_SENT_COOKIE);
    h.otpSendError = { message: "Signups not allowed for otp" };
    const missing = await sendCodeAction(init, form({ email: "me@example.com" }));
    expect(missing).toEqual(exists);
    expect(missing.message).toBe("ถ้ามีบัญชีนี้ รหัสจะถูกส่งไปที่อีเมล");
    expect(h.created).toEqual([]);
  });

  it("กดส่งซ้ำภายใน 60 วินาที → ให้รอ · ไม่เรียก Supabase อีก", async () => {
    setPending();
    await sendCodeAction(init, form({ email: "me@example.com" }));
    const again = await sendCodeAction(init, form({ email: "me@example.com" }));
    expect(again.message).toBe(OTP_WAIT_MESSAGE);
    expect(h.otpSends).toHaveLength(1);
  });

  it("ไม่มี cookie · หมดอายุ · ลายเซ็นผิด · ไม่มี secret → ทุก action ปฏิเสธ ไม่เรียก Supabase ไม่สร้างบัญชี", async () => {
    const cases: (() => void)[] = [
      () => h.jar.clear(),
      () => setPending(new Date(Date.now() - 601_000)),
      () => h.jar.set(PENDING_COOKIE, signPending(STEAM64, "another-secret-another-secret-another-00")),
      () => { setPending(); vi.stubEnv("STEAM_PENDING_SECRET", ""); },
    ];
    for (const arrange of cases) {
      vi.stubEnv("STEAM_PENDING_SECRET", SECRET);
      arrange();
      h.otpUser = { id: "u-me" };
      expect((await sendCodeAction(init, form({ email: "me@example.com" }))).message).toBe(CHOOSE_MESSAGES.expired);
      expect((await verifyCodeAction(init, form({ email: "me@example.com", code: "123456" }))).message).toBe(CHOOSE_MESSAGES.expired);
      expect(await run(newPlayerAction(init, form({})))).toMatchObject({ ok: false, message: CHOOSE_MESSAGES.expired });
    }
    expect(h.otpSends).toEqual([]);
    expect(h.verifyCalls).toEqual([]);
    expect(h.created).toEqual([]);
    expect(h.rpcCalls).toEqual([]);
    expect(h.redirects).toEqual([]);
  });

  it("ยืนยันรหัส: รหัสไม่ใช่เลข 6 หลัก → ไม่เรียก verifyOtp · รหัสผิด → ข้อความเดียว ไม่ผูก", async () => {
    setPending();
    for (const bad of ["", "12345", "1234567", "abcdef", "12 456"]) {
      expect((await verifyCodeAction(init, form({ email: "me@example.com", code: bad }))).message).toBe(OTP_BAD_CODE_MESSAGE);
    }
    expect(h.verifyCalls).toEqual([]);
    h.otpUser = null;
    expect((await verifyCodeAction(init, form({ email: "me@example.com", code: "123456" }))).message).toBe(OTP_BAD_CODE_MESSAGE);
    expect(h.verifyCalls).toEqual([{ email: "me@example.com", token: "123456", type: "email" }]);
    expect(h.rpcCalls).toEqual([]);
    expect(h.jar.has(PENDING_COOKIE)).toBe(true); // พิมพ์รหัสผิดยังลองใหม่ได้ภายในอายุเดิม
  });

  it("ยืนยันรหัสผ่าน → ผูก Steam จาก cookie เข้า user ของ session (ไม่ใช่จากฟอร์ม) → ลบ cookie → /me", async () => {
    setPending();
    h.otpUser = { id: "u-me" };
    const out = await run(verifyCodeAction(init, form({ email: "me@example.com", code: "123456", user_id: "u-attacker", steam64: "76561197960287999" })));
    expect(out).toBe("/me?linked=steam");
    expect(h.rpcCalls).toEqual([{ fn: "link_steam_verified", args: { p_user_id: "u-me", p_account_id: ACCOUNT } }]);
    expect(h.jar.has(PENDING_COOKIE)).toBe(false);
    expect(h.created).toEqual([]);
    // ใช้ซ้ำ: cookie ถูกลบแล้ว → ปฏิเสธ
    expect((await verifyCodeAction(init, form({ email: "me@example.com", code: "123456" }))).message).toBe(CHOOSE_MESSAGES.expired);
    expect(h.rpcCalls).toHaveLength(1);
  });

  it("Q4 และ Steam ถูกผูกไปแล้ว ผ่าน action → ปฏิเสธ ไม่เรียก RPC · ลบ cookie", async () => {
    setPending();
    h.otpUser = { id: "u-me" };
    h.rows = [verified("u-me", "99999")];
    expect(await run(verifyCodeAction(init, form({ email: "me@example.com", code: "123456" })))).toMatchObject({ ok: false, message: CHOOSE_MESSAGES.other_steam });
    setPending();
    h.rows = [verified("u-other")];
    expect(await run(verifyCodeAction(init, form({ email: "me@example.com", code: "123456" })))).toMatchObject({ ok: false, message: CHOOSE_MESSAGES.taken });
    expect(h.rpcCalls).toEqual([]);
    expect(h.jar.has(PENDING_COOKIE)).toBe(false);
    expect(h.redirects).toEqual([]);
  });

  it("ผู้เล่นใหม่ → createUser + rpc link + ตั้ง session → ลบ cookie → /me · ใช้ cookie เดิมซ้ำ (แม้ยังไม่หมดอายุ) → taken ไม่สร้างบัญชีที่สอง", async () => {
    setPending();
    const saved = h.jar.get(PENDING_COOKIE)!;
    expect(await run(newPlayerAction(init, form({})))).toBe("/me");
    expect(h.created).toHaveLength(1);
    expect(h.rpcCalls).toEqual([{ fn: "link_steam_verified", args: { p_user_id: "new-1", p_account_id: ACCOUNT } }]);
    expect(h.verifyCalls).toEqual([{ token_hash: "HASHED", type: "magiclink" }]);
    expect(h.jar.has(PENDING_COOKIE)).toBe(false);

    // ผู้โจมตีเก็บค่า cookie ไว้แล้วส่งซ้ำ: Steam ID ถูกผูกแล้ว → ปฏิเสธ
    h.jar.set(PENDING_COOKIE, saved);
    expect(await run(newPlayerAction(init, form({})))).toMatchObject({ ok: false, message: CHOOSE_MESSAGES.taken });
    expect(h.created).toHaveLength(1);
    expect(h.jar.has(PENDING_COOKIE)).toBe(false);
  });

  it("ไม่มี admin → unavailable · ไม่สร้างบัญชี", async () => {
    setPending();
    h.admin = false;
    expect(await run(newPlayerAction(init, form({})))).toMatchObject({ ok: false, message: CHOOSE_MESSAGES.unavailable });
    expect(h.created).toEqual([]);
  });
});
