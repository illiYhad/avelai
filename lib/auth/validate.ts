// ตัวตรวจแบบ pure (เทสด้วย vitest) — ใช้ฝั่ง server เสมอ อย่าพึ่ง client อย่างเดียว

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** ตรวจ username ตามใบ K-AV-1: 3–20 ตัว [a-z0-9_] · ห้ามขึ้นต้น player_ (สงวนให้ trigger ตั้งชื่ออัตโนมัติ) */
export function validateUsername(input: string): string | null {
  if (!USERNAME_RE.test(input)) {
    return "username ต้องยาว 3–20 ตัว ใช้ได้เฉพาะ a-z 0-9 และ _";
  }
  if (input.startsWith("player_")) {
    return "username ขึ้นต้นด้วย player_ ไม่ได้ (สงวนไว้ให้ระบบ)";
  }
  return null;
}

/** avatar_url: ว่าง หรือ URL แบบ https เท่านั้น */
export function validateAvatarUrl(input: string): string | null {
  if (input === "") return null;
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return "avatar_url ต้องเป็นลิงก์ https เท่านั้น";
    return null;
  } catch {
    return "avatar_url ไม่ใช่ลิงก์ที่ถูกต้อง";
  }
}

/** กัน open redirect: รับเฉพาะ path ภายในที่ขึ้นต้น / และไม่ขึ้นต้น // หรือ /\ · ไม่ผ่าน = fallback */
export function safeNext(next: unknown, fallback = "/me"): string {
  if (typeof next !== "string" || next === "") return fallback;
  // เบราว์เซอร์ตัด \t \n \r ใน URL เอง — ตัดก่อนตรวจ กัน "/\t/evil.com" กลายเป็น "//evil.com"
  const cleaned = next.replace(/[\t\n\r]/g, "");
  if (!cleaned.startsWith("/")) return fallback;
  if (cleaned.startsWith("//") || cleaned.startsWith("/\\")) return fallback;
  return cleaned;
}
