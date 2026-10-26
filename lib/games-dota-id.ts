// K-AV-D1: แปลงสิ่งที่ผู้ใช้กรอกเป็น Dota 2 account id (Steam32) — pure ไม่ยิงเครือข่าย
// รับ: Steam32 (5–10 หลัก) · SteamID64 (17 หลัก ขึ้นต้น 7656119) · ลิงก์ dotabuff.com/players/<id> หรือ opendota.com/players/<id>
// อย่างอื่น / 0 / เกิน 32-bit → null

const STEAM64_BASE = BigInt("76561197960265728");
const MAX_U32 = BigInt("4294967295");
const PROFILE_LINK = /^(?:https?:\/\/)?(?:www\.)?(?:dotabuff\.com|opendota\.com)\/players\/(\d+)\/?(?:[?#].*)?$/i;

function inRange(n: bigint): string | null {
  return n > BigInt(0) && n <= MAX_U32 ? n.toString() : null;
}

export function parseDotaAccountId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (!v) return null;

  const link = PROFILE_LINK.exec(v);
  const digits = link ? link[1] : /^\d+$/.test(v) ? v : null;
  if (!digits) return null;

  if (digits.length === 17 && digits.startsWith("7656119")) return inRange(BigInt(digits) - STEAM64_BASE);
  if (digits.length >= 5 && digits.length <= 10) return inRange(BigInt(digits));
  return null;
}
