// K-AV-8: ตัวตรวจแบบ pure สำหรับจอ OBS + สปอนเซอร์ (เทสด้วย vitest · ใช้ฝั่ง server เสมอ)

export const OBS_THEMES = ["DARK", "TRANSPARENT", "GOLD", "CYAN"] as const;
export type ObsTheme = (typeof OBS_THEMES)[number];
export const DEFAULT_THEME: ObsTheme = "DARK";

export const SPONSOR_TIERS = ["GOLD", "SILVER", "BRONZE", "PARTNER"] as const;
export type SponsorTier = (typeof SPONSOR_TIERS)[number];
export const TIER_LABEL: Record<SponsorTier, string> = { GOLD: "Gold", SILVER: "Silver", BRONZE: "Bronze", PARTNER: "Partner" };

export const OBS_KINDS = ["bracket", "now", "ticker", "sponsors"] as const;
export type ObsKind = (typeof OBS_KINDS)[number];
export const KIND_LABEL: Record<ObsKind, string> = { bracket: "สาย", now: "แมตช์ตอนนี้", ticker: "ผลล่าสุด", sponsors: "สปอนเซอร์" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** uuid รูปแบบมาตรฐาน (ตัวพิมพ์เล็ก/ใหญ่) · อย่างอื่น = false (กันส่งค่าแปลกเข้า query) */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function isObsTheme(v: unknown): v is ObsTheme {
  return typeof v === "string" && (OBS_THEMES as readonly string[]).includes(v);
}

/** ธีม: ค่าใน DB (jsonb string) หรือ ?theme= — ไม่รู้จัก/ว่าง = DARK */
export function parseTheme(v: unknown): ObsTheme {
  return isObsTheme(v) ? v : DEFAULT_THEME;
}

export function isObsKind(v: unknown): v is ObsKind {
  return typeof v === "string" && (OBS_KINDS as readonly string[]).includes(v);
}

export function isSponsorTier(v: unknown): v is SponsorTier {
  return typeof v === "string" && (SPONSOR_TIERS as readonly string[]).includes(v);
}

/** URL https เท่านั้น · ไม่มีช่องว่าง/อักขระอันตราย · ยาว ≤ 2000 · คืน URL ที่ normalize แล้ว หรือ null */
export function httpsUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (s.length === 0 || s.length > 2000 || /[\s"<>]/.test(s)) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" || !u.hostname) return null;
  return u.toString();
}

export type SponsorInput = { name: string; logo_url: string; link_url: string | null; tier: SponsorTier; sort_order: number };

/** ตรวจฟอร์มสปอนเซอร์กับ allowlist · คืน error ไทยข้อแรกที่พบ */
export function validateSponsorInput(raw: { name?: unknown; logo_url?: unknown; link_url?: unknown; tier?: unknown; sort_order?: unknown }): { ok: true; v: SponsorInput } | { ok: false; message: string } {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 1 || name.length > 80) return { ok: false, message: "ชื่อสปอนเซอร์ต้องยาว 1–80 ตัวอักษร" };
  const logo_url = httpsUrl(raw.logo_url);
  if (!logo_url) return { ok: false, message: "ลิงก์โลโก้ต้องเป็น https เท่านั้น" };
  const linkRaw = typeof raw.link_url === "string" ? raw.link_url.trim() : "";
  let link_url: string | null = null;
  if (linkRaw) {
    link_url = httpsUrl(linkRaw);
    if (!link_url) return { ok: false, message: "ลิงก์เว็บไซต์ต้องเป็น https เท่านั้น" };
  }
  const tier = typeof raw.tier === "string" && raw.tier ? raw.tier : "PARTNER";
  if (!isSponsorTier(tier)) return { ok: false, message: "ระดับสปอนเซอร์ไม่รองรับ" };
  const so = raw.sort_order === undefined || raw.sort_order === "" || raw.sort_order === null ? 0 : Number(raw.sort_order);
  if (!Number.isInteger(so) || so < 0 || so > 999) return { ok: false, message: "ลำดับต้องเป็นจำนวนเต็ม 0–999" };
  return { ok: true, v: { name, logo_url, link_url, tier, sort_order: so } };
}
