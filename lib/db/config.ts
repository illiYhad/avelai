// อ่านค่า env แบบ env-safe (รูปแบบเดียวกับเว็บ BTS): ไม่มีค่า = คืน null ไม่ล้มทั้งแอป
// ไฟล์นี้เป็น pure function เพื่อให้ vitest เทสได้ — ตัวสร้าง client จริงอยู่ใน admin.ts / client.ts

export type DbConfig = { url: string; key: string };
type Env = Record<string, string | undefined>;

/** config ฝั่ง admin (service role) — ใช้ได้เฉพาะผ่าน lib/db/admin.ts เท่านั้น */
export function readAdminConfig(env: Env = process.env): DbConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** config ฝั่งผู้ใช้ (anon key) */
export function readClientConfig(env: Env = process.env): DbConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}
