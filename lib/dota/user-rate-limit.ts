// K-AV-D2: เพดานเรียก OpenDota ต่อผู้ใช้ (กันกดรัว) — pure function แบบ lib/liquipedia/rateLimit.ts
// ⚠ ตัวนับอยู่ในหน่วยความจำของแต่ละอินสแตนซ์ serverless → ไม่เข้มงวดข้ามอินสแตนซ์ (รู้และยอมรับในเฟสนี้)

export const DOTA_USER_LIMIT = 20;
export const MINUTE_MS = 60 * 1000;

/** บันทึกเวลาเรียกต่อผู้ใช้ (ใช้ร่วมกันใน route ของ /api/games/dota2/*) */
export const dotaRequestLog = new Map<string, number[]>();

/** true = ให้เรียกได้ (และนับครั้งนี้) · false = เกินเพดานในหน้าต่าง 1 นาที */
export function allowRequest(
  log: Map<string, number[]>,
  userId: string,
  nowMs: number,
  limit: number = DOTA_USER_LIMIT,
  windowMs: number = MINUTE_MS,
): boolean {
  const recent = (log.get(userId) ?? []).filter((t) => t > nowMs - windowMs && t <= nowMs);
  if (recent.length >= limit) {
    log.set(userId, recent);
    return false;
  }
  recent.push(nowMs);
  log.set(userId, recent);
  return true;
}
