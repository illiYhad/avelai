// K-AV-H8: ที่มาของ origin สำหรับลิงก์ล็อกอิน (magic link) และ metadataBase — ฟังก์ชัน pure ไม่อ่าน env/headers เอง
// production จริง (VERCEL_ENV=production) ต้องตั้ง SITE_URL เป็น https เสมอ ไม่งั้นปิดการส่งลิงก์ (fail-closed)
// Preview/dev ยัง fallback เป็น host ของ request ได้ — ห้ามใช้ NODE_ENV ตัดสิน เพราะ Preview ของ Vercel ก็เป็น NODE_ENV=production

export type SiteOriginInput = {
  siteUrl?: string | null;
  vercelEnv?: string | null;
  host?: string | null;
  proto?: string | null;
};

function parseUrl(raw: string | null | undefined): URL | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    return new URL(v);
  } catch {
    return null;
  }
}

/** origin สำหรับลิงก์ล็อกอิน · null = production ที่ยังไม่ตั้ง SITE_URL แบบ https (ห้ามส่งลิงก์) */
export function resolveSiteOrigin({ siteUrl, vercelEnv, host, proto }: SiteOriginInput): string | null {
  const url = parseUrl(siteUrl);
  if (url && url.protocol === "https:") return url.origin;
  if (vercelEnv === "production") return null;
  return `${proto || "http"}://${host || "localhost:3000"}`;
}

/** metadataBase จาก SITE_URL · ไม่ตั้ง/เพี้ยน/ไม่ใช่ http(s) = undefined (ไม่ทำ build พัง) */
export function metadataBaseFrom(siteUrl: string | null | undefined): URL | undefined {
  const url = parseUrl(siteUrl);
  return url && (url.protocol === "https:" || url.protocol === "http:") ? new URL(url.origin) : undefined;
}
