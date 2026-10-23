// เพดานเรียก Liquipedia API: 60 ครั้ง/ชั่วโมง ทั้งระบบ (K-AV-R เฟส 3 ข้อ 13)
// pure function — เทสด้วย vitest · ฝั่งเรียกจริงนับจากตาราง liquipedia_requests

export const LIQUIPEDIA_HOURLY_LIMIT = 60;
export const HOUR_MS = 60 * 60 * 1000;

/** นับ timestamp (ms) ที่อยู่ในหน้าต่าง 1 ชั่วโมงก่อน now */
export function countInWindow(timestampsMs: number[], nowMs: number): number {
  const cutoff = nowMs - HOUR_MS;
  return timestampsMs.filter((t) => t > cutoff && t <= nowMs).length;
}

export function canFetch(requestCountLastHour: number): boolean {
  return requestCountLastHour < LIQUIPEDIA_HOURLY_LIMIT;
}

// User-Agent ตามกติกา Liquipedia API: ระบุชื่อแอป เวอร์ชัน และช่องทางติดต่อ
export const LIQUIPEDIA_USER_AGENT =
  "AVELAi-TeamScout/1.0 (https://github.com/illiYhad/avelai; contact: repo owner)";

export const LIQUIPEDIA_MLBB_API = "https://liquipedia.net/mobilelegends/api.php";
