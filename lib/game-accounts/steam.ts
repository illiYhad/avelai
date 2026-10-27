// K-AV-LINK: Steam OpenID 2.0 (ผูกบัญชี ไม่ใช่ล็อกอิน) — pure · ยิงเครือข่ายผ่าน fetchFn ที่ฉีดเข้ามา (เทสได้)
// ลำดับความปลอดภัย: (1) return_to/op_endpoint/ns/mode ถูกต้อง (2) ฟิลด์สำคัญอยู่ใน openid.signed
//   (3) ให้ Steam ตรวจลายเซ็น (check_authentication → is_valid:true) (4) claimed_id ตรง regex SteamID64 เท่านั้น

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = `${OPENID_NS}/identifier_select`;
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;
const STEAM64_BASE = BigInt("76561197960265728");
const REQUIRED_SIGNED = ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce"];

export const RETURN_PATH = "/link/steam/return";

/** SITE_URL ก่อนเสมอ (กัน host header poisoning) · ไม่มี = dev เท่านั้นที่ใช้ origin ของ request · production ไม่มี = null (ปิดฟีเจอร์) */
export function resolveSiteUrl(env: Record<string, string | undefined>, requestUrl: string): string | null {
  const configured = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (env.NODE_ENV === "production") return null;
  try { return new URL(requestUrl).origin; } catch { return null; }
}

export function buildStartUrl(siteUrl: string): string {
  const p = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.claimed_id": IDENTIFIER_SELECT,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.return_to": `${siteUrl}${RETURN_PATH}`,
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

/** เช็กพารามิเตอร์ที่ Steam ส่งกลับ ก่อนถาม Steam */
export function checkReturnParams(params: URLSearchParams, siteUrl: string): boolean {
  if (params.get("openid.ns") !== OPENID_NS) return false;
  if (params.get("openid.mode") !== "id_res") return false;
  if (params.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) return false;
  const returnTo = params.get("openid.return_to") ?? "";
  if (returnTo !== `${siteUrl}${RETURN_PATH}`) return false;
  const signed = (params.get("openid.signed") ?? "").split(",");
  return REQUIRED_SIGNED.every((f) => signed.includes(f));
}

/** ให้ Steam ตรวจลายเซ็นฝั่ง server · ส่งเฉพาะพารามิเตอร์ openid.* · ต้องได้ is_valid:true เท่านั้น */
export async function verifyAssertion(params: URLSearchParams, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const body = new URLSearchParams();
  for (const [k, v] of params) if (k.startsWith("openid.")) body.set(k, v);
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
  params: URLSearchParams; siteUrl: string; userId: string; suspended: boolean; admin: RpcClient | null; fetchFn?: typeof fetch;
}): Promise<string> {
  const fail = (e: SteamLinkError) => `/me?link_error=${e}`;
  if (a.suspended) return fail("suspended");
  if (!checkReturnParams(a.params, a.siteUrl)) return fail("invalid");
  const steam64 = parseClaimedId(a.params.get("openid.claimed_id"));
  if (!steam64) return fail("invalid");
  if (!(await verifyAssertion(a.params, a.fetchFn))) return fail("invalid");
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
