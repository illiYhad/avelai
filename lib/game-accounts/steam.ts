// K-AV-LINK: Steam OpenID 2.0 (ผูกบัญชี ไม่ใช่ล็อกอิน) — pure · ยิงเครือข่ายผ่าน fetchFn ที่ฉีดเข้ามา (เทสได้)
// ลำดับความปลอดภัย: (0) ห้ามมีพารามิเตอร์ openid.* ซ้ำ (parser differential: Steam เช็กค่าหนึ่ง เราอ่านอีกค่า) · ทุกขั้นใช้ map ค่าเดียวกัน
//   (1) return_to (มี state สุ่มผูก cookie+session) / op_endpoint / ns / mode ถูกต้อง · identity = claimed_id · nonce ไม่เก่า
//   (2) ฟิลด์สำคัญอยู่ใน openid.signed (3) ให้ Steam ตรวจลายเซ็น (check_authentication → is_valid:true)
//   (4) claimed_id ตรง regex SteamID64 เท่านั้น

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = `${OPENID_NS}/identifier_select`;
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;
const STEAM64_BASE = BigInt("76561197960265728");
const REQUIRED_SIGNED = ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce"];
const NONCE_MAX_AGE_MS = 5 * 60 * 1000;
export const STATE_COOKIE = "steam_link_state";
export const STATE_COOKIE_PATH = "/link/steam";

export const RETURN_PATH = "/link/steam/return";

// K-AV-STEAMLOGIN: ล็อกอิน/สร้างบัญชีด้วย Steam (ไม่ต้องมี session ก่อน) · ใช้ชุดตรวจเดียวกับการผูก แต่ return path และ cookie แยกกัน
export const LOGIN_RETURN_PATH = "/auth/steam/return";
export const LOGIN_STATE_COOKIE = "steam_login_state";
export const LOGIN_STATE_COOKIE_PATH = "/auth/steam";
export const STEAM_LOGIN_EMAIL_DOMAIN = "steam.avelai.org";

/** SITE_URL ก่อนเสมอ (กัน host header poisoning) · ไม่มี = dev เท่านั้นที่ใช้ origin ของ request · production ไม่มี = null (ปิดฟีเจอร์) */
export function resolveSiteUrl(env: Record<string, string | undefined>, requestUrl: string): string | null {
  const configured = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (env.NODE_ENV === "production") return null;
  try { return new URL(requestUrl).origin; } catch { return null; }
}

/** return_to ที่เซ็นโดย Steam · state สุ่มอยู่ในนี้ จึงถูกป้องกันการแก้ */
export function returnToWithState(siteUrl: string, state: string, returnPath: string = RETURN_PATH): string {
  return `${siteUrl}${returnPath}?state=${state}`;
}

/** ค่า cookie = `<state>.<userId>` — ผูกกับ session ผู้ใช้ที่เริ่มกระบวนการ */
export function stateCookieValue(state: string, userId: string): string {
  return `${state}.${userId}`;
}

/** อ่าน state จาก header Cookie · ต้องเป็นของ userId นี้ · รูปแบบ/ผู้ใช้ไม่ตรง = null */
export function readStateCookie(cookieHeader: string | null | undefined, userId: string): string | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== STATE_COOKIE) continue;
    const m = /^([0-9a-f]{32})\.([0-9a-fA-F-]{36})$/.exec(rest.join("="));
    return m && m[2] === userId ? m[1] : null;
  }
  return null;
}

/** รวมพารามิเตอร์ openid.* เป็น map ค่าเดียว · มีคีย์ซ้ำ = null (ปฏิเสธทั้งคำขอ) */
export function singleValued(params: URLSearchParams): Map<string, string> | null {
  const out = new Map<string, string>();
  for (const k of new Set(params.keys())) {
    if (!k.startsWith("openid.")) continue;
    const all = params.getAll(k);
    if (all.length !== 1) return null;
    out.set(k, all[0]);
  }
  return out;
}

export function buildStartUrl(siteUrl: string, state: string, returnPath: string = RETURN_PATH): string {
  const p = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.claimed_id": IDENTIFIER_SELECT,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.return_to": returnToWithState(siteUrl, state, returnPath),
    "openid.realm": siteUrl,
  });
  return `${STEAM_OPENID_ENDPOINT}?${p.toString()}`;
}

/** claimed_id → SteamID64 (17 หลัก ขึ้นต้น 7656119) · อย่างอื่น = null */
export function parseClaimedId(claimed: string | null | undefined): string | null {
  const m = typeof claimed === "string" ? CLAIMED_ID.exec(claimed) : null;
  return m ? m[1] : null;
}

/** SteamID64 → Dota account_id (Steam32) · ต้อง > 0 และไม่เกิน 10 หลัก */
export function toDotaAccountId(steamId64: string): string | null {
  if (!/^\d{17}$/.test(steamId64)) return null;
  const id = BigInt(steamId64) - STEAM64_BASE;
  if (id <= BigInt(0)) return null;
  const s = id.toString();
  return s.length <= 10 ? s : null;
}

/** response_nonce ขึ้นต้นด้วยเวลา ISO (YYYY-MM-DDThh:mm:ssZ) · เก่ากว่า 5 นาที/อนาคตเกิน 5 นาที/รูปแบบผิด = false */
export function nonceFresh(nonce: string | undefined, now: Date = new Date()): boolean {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/.exec(nonce ?? "");
  const t = m ? Date.parse(m[1]) : NaN;
  return Number.isFinite(t) && Math.abs(now.getTime() - t) <= NONCE_MAX_AGE_MS;
}

/** เช็กพารามิเตอร์ที่ Steam ส่งกลับ ก่อนถาม Steam · รับ map ค่าเดียวจาก singleValued() */
export function checkReturnParams(p: Map<string, string>, siteUrl: string, state: string | null, now: Date = new Date(), returnPath: string = RETURN_PATH): boolean {
  if (!state) return false;
  if (p.get("openid.ns") !== OPENID_NS) return false;
  if (p.get("openid.mode") !== "id_res") return false;
  if (p.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) return false;
  if (p.get("openid.return_to") !== returnToWithState(siteUrl, state, returnPath)) return false;
  const claimed = p.get("openid.claimed_id");
  if (!claimed || p.get("openid.identity") !== claimed) return false;
  if (!nonceFresh(p.get("openid.response_nonce"), now)) return false;
  const signed = (p.get("openid.signed") ?? "").split(",");
  return REQUIRED_SIGNED.every((f) => signed.includes(f));
}

/** ให้ Steam ตรวจลายเซ็นฝั่ง server · ส่งเฉพาะพารามิเตอร์ openid.* · ต้องได้ is_valid:true เท่านั้น */
export async function verifyAssertion(p: Map<string, string>, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const body = new URLSearchParams();
  for (const [k, v] of p) body.set(k, v);
  body.set("openid.mode", "check_authentication");
  try {
    const res = await fetchFn(STEAM_OPENID_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
    if (!res.ok) return false;
    return /^is_valid:true\s*$/m.test(await res.text());
  } catch {
    return false;
  }
}

export type SteamLinkError = "invalid" | "already" | "unavailable" | "suspended" | "failed";
export type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }> };

/** ขั้นตอนหลังกลับจาก Steam → path ปลายทางใน /me · userId ต้องมาจาก session ฝั่ง server เท่านั้น */
export async function processSteamReturn(a: {
  params: URLSearchParams; siteUrl: string; userId: string; suspended: boolean; admin: RpcClient | null;
  expectedState: string | null; // state จาก cookie ของผู้ใช้คนนี้ (readStateCookie) · null = ไม่เคยเริ่ม/ไม่ใช่ของคนนี้
  fetchFn?: typeof fetch; now?: Date;
}): Promise<string> {
  const fail = (e: SteamLinkError) => `/me?link_error=${e}`;
  if (a.suspended) return fail("suspended");
  const p = singleValued(a.params);
  if (!p || !checkReturnParams(p, a.siteUrl, a.expectedState, a.now)) return fail("invalid");
  const steam64 = parseClaimedId(p.get("openid.claimed_id"));
  if (!steam64) return fail("invalid");
  if (!(await verifyAssertion(p, a.fetchFn))) return fail("invalid");
  const accountId = toDotaAccountId(steam64);
  if (!accountId) return fail("invalid");
  if (!a.admin) return fail("unavailable");
  const { error } = await a.admin.rpc("link_steam_verified", { p_user_id: a.userId, p_account_id: accountId });
  if (error) return fail((error.message ?? "").includes("STEAM_ALREADY_LINKED") ? "already" : "failed");
  return "/me?linked=steam";
}

export const LINK_MESSAGES = {
  linked: { steam: "ผูกบัญชี Steam และยืนยันแล้ว" },
  errors: {
    invalid: "ยืนยันกับ Steam ไม่ผ่าน กรุณาลองใหม่",
    already: "บัญชี Steam นี้ผูกกับบัญชีอื่นแล้ว",
    unavailable: "ฟีเจอร์ยังไม่เปิดใช้งาน",
    suspended: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถผูกบัญชีได้",
    failed: "ผูกบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  } satisfies Record<SteamLinkError, string>,
};

// ============================================================================
// K-AV-STEAMLOGIN: ล็อกอิน/สร้างบัญชีด้วย Steam — pure · DB/Auth ทั้งหมดฉีดผ่าน deps (เทสได้ ไม่ยิงจริง)
// ลำดับหลัง Steam ตรวจผ่าน (ตามใบ): (1) มี session อยู่แล้ว → route ส่งไป /link/steam/start (ไม่ถึงฟังก์ชันนี้)
//   (2) เจอแถว DOTA2+account_id+VERIFIED+STEAM_OPENID → เข้าบัญชีนั้น (3) ไม่เจอ → สร้างบัญชี แล้ว link_steam_verified ก่อนตั้ง session
//   (4) สร้างได้แต่ผูกไม่ได้ → ลบเฉพาะบัญชีที่เพิ่งสร้าง · STEAM_ALREADY_LINKED (กดพร้อมกัน) → กลับไป (2) · อย่างอื่น = ไม่ให้เข้า
// ============================================================================

export type SteamLoginError = "invalid" | "suspended" | "unavailable" | "failed";

/** cookie ล็อกอิน = `<state>.<next>` · next ต้องผ่าน safeNext ของผู้เรียกก่อนเก็บ
 *  (ไม่ encode เอง — NextResponse.cookies.set ทำ percent-encoding ให้ทั้งค่า · readLoginStateCookie ถอดกลับครั้งเดียว) */
export function loginStateCookieValue(state: string, next: string): string {
  return `${state}.${next}`;
}

/** อ่าน cookie ล็อกอิน · รูปแบบผิด = null · next ที่ได้ยังเป็นค่าดิบ ผู้เรียกต้องผ่าน safeNext อีกครั้ง */
export function readLoginStateCookie(cookieHeader: string | null | undefined): { state: string; next: string } | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== LOGIN_STATE_COOKIE) continue;
    const m = /^([0-9a-f]{32})\.(.*)$/.exec(rest.join("="));
    if (!m) return null;
    try { return { state: m[1], next: decodeURIComponent(m[2]) }; } catch { return null; }
  }
  return null;
}

/** อีเมลภายในของบัญชีที่สร้างจาก Steam · ไม่ใช่อีเมลจริง ห้ามส่งเมล/แสดงในโปรไฟล์ */
export function steamLoginEmail(steamId64: string): string {
  return `steam-${steamId64}@${STEAM_LOGIN_EMAIL_DOMAIN}`;
}

/** ชุดตรวจเดียวกับการผูก (singleValued → checkReturnParams → parseClaimedId → verifyAssertion → toDotaAccountId) · ไม่แตะ DB
 *  ผ่าน = { steam64, accountId } · ไม่ผ่านข้อใดข้อหนึ่ง = null */
export async function verifySteamLoginReturn(a: {
  params: URLSearchParams; siteUrl: string; expectedState: string | null; fetchFn?: typeof fetch; now?: Date;
}): Promise<{ steam64: string; accountId: string } | null> {
  const p = singleValued(a.params);
  if (!p || !checkReturnParams(p, a.siteUrl, a.expectedState, a.now, LOGIN_RETURN_PATH)) return null;
  const steam64 = parseClaimedId(p.get("openid.claimed_id"));
  if (!steam64) return null;
  if (!(await verifyAssertion(p, a.fetchFn))) return null;
  const accountId = toDotaAccountId(steam64);
  if (!accountId) return null;
  return { steam64, accountId };
}

export type SteamLoginDeps = {
  /** แถว game_accounts: DOTA2 + external_id + VERIFIED + STEAM_OPENID → user_id · ไม่เจอ = null · อ่านไม่ได้ = undefined */
  findVerifiedUserId: (accountId: string) => Promise<string | null | undefined>;
  /** auth.admin.createUser (email_confirm · ไม่มีรหัสผ่าน · ไม่ส่งเมล) → user id · ล้ม = null */
  createUser: (email: string) => Promise<string | null>;
  /** rpc link_steam_verified (service role) */
  linkSteam: (userId: string, accountId: string) => Promise<{ error: { message?: string } | null }>;
  /** auth.admin.deleteUser — ใช้เฉพาะกับบัญชีที่เพิ่งสร้างในคำขอนี้ */
  deleteUser: (userId: string) => Promise<void>;
  /** users.suspended_until > now (fail closed) */
  isSuspended: (userId: string) => Promise<boolean>;
  /** ตั้ง session ให้ userId (getUserById → generateLink magiclink → verifyOtp) · ล้ม = false */
  signIn: (userId: string) => Promise<boolean>;
};

/** ตรรกะล็อกอินหลัง Steam ตรวจผ่านแล้ว · deps = null แปลว่าไม่มี admin (ปิดฟีเจอร์) */
export async function processSteamLogin(a: {
  params: URLSearchParams; siteUrl: string; expectedState: string | null; deps: SteamLoginDeps | null;
  fetchFn?: typeof fetch; now?: Date;
}): Promise<{ ok: true; userId: string } | { ok: false; error: SteamLoginError }> {
  const fail = (error: SteamLoginError) => ({ ok: false as const, error });
  const verified = await verifySteamLoginReturn(a);
  if (!verified) return fail("invalid");
  const d = a.deps;
  if (!d) return fail("unavailable");

  const enter = async (userId: string) => {
    if (await d.isSuspended(userId)) return fail("suspended");
    return (await d.signIn(userId)) ? { ok: true as const, userId } : fail("failed");
  };

  // (2) Steam ที่ผูกแล้ว → เข้าบัญชีเดิม ไม่สร้างใหม่
  const existing = await d.findVerifiedUserId(verified.accountId);
  if (existing === undefined) return fail("failed");
  if (existing) return enter(existing);

  // (3) Steam ใหม่ → สร้างบัญชี แล้วผูกก่อนตั้ง session
  const created = await d.createUser(steamLoginEmail(verified.steam64));
  if (!created) return fail("failed");
  const { error } = await d.linkSteam(created, verified.accountId);
  if (error) {
    // (4) ผูกไม่สำเร็จ → ลบเฉพาะบัญชีที่เพิ่งสร้าง · ชนกับคนที่กดพร้อมกัน → กลับไป (2)
    await d.deleteUser(created);
    if ((error.message ?? "").includes("STEAM_ALREADY_LINKED")) {
      const winner = await d.findVerifiedUserId(verified.accountId);
      return winner ? enter(winner) : fail("failed");
    }
    return fail("failed");
  }
  return enter(created);
}

export const LOGIN_MESSAGES: Record<SteamLoginError, string> = {
  invalid: "ยืนยันกับ Steam ไม่ผ่าน กรุณาลองใหม่",
  suspended: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถเข้าสู่ระบบได้",
  unavailable: "ล็อกอินด้วย Steam ยังไม่เปิดใช้งาน ใช้อีเมลหรือ Google แทนได้",
  failed: "เข้าสู่ระบบด้วย Steam ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

/** รหัส error จาก query ต้องอยู่ในรายการคงที่เท่านั้น · อย่างอื่น = null (ไม่สะท้อนข้อความดิบ) */
export function steamLoginMessage(code: unknown): string | null {
  // Object.hasOwn: กัน "toString"/"constructor" หลุดผ่าน prototype
  return typeof code === "string" && Object.hasOwn(LOGIN_MESSAGES, code) ? LOGIN_MESSAGES[code as SteamLoginError] : null;
}
