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

/** SITE_URL ก่อนเสมอ (กัน host header poisoning) · ไม่มี = dev เท่านั้นที่ใช้ origin ของ request · production ไม่มี = null (ปิดฟีเจอร์) */
export function resolveSiteUrl(env: Record<string, string | undefined>, requestUrl: string): string | null {
  const configured = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (env.NODE_ENV === "production") return null;
  try { return new URL(requestUrl).origin; } catch { return null; }
}

/** return_to ที่เซ็นโดย Steam · state สุ่มอยู่ในนี้ จึงถูกป้องกันการแก้ */
export function returnToWithState(siteUrl: string, state: string): string {
  return `${siteUrl}${RETURN_PATH}?state=${state}`;
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

export function buildStartUrl(siteUrl: string, state: string): string {
  const p = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.claimed_id": IDENTIFIER_SELECT,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.return_to": returnToWithState(siteUrl, state),
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
export function checkReturnParams(p: Map<string, string>, siteUrl: string, state: string | null, now: Date = new Date()): boolean {
  if (!state) return false;
  if (p.get("openid.ns") !== OPENID_NS) return false;
  if (p.get("openid.mode") !== "id_res") return false;
  if (p.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) return false;
  if (p.get("openid.return_to") !== returnToWithState(siteUrl, state)) return false;
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
