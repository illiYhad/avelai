// K-AV-8: เพดานเรียก route OBS ต่อ IP (กันยิงรัว) — pure function แบบ lib/liquipedia/rateLimit.ts
// จอ OBS หนึ่งจอ poll ทุก 5 วิ = 12 ครั้ง/นาที · เปิด 4 จอ = 48 → เพดาน 120/นาที/IP เหลือเผื่อ
// ⚠ ตัวนับอยู่ในหน่วยความจำของแต่ละอินสแตนซ์ serverless → ไม่เข้มงวดข้ามอินสแตนซ์ (รู้และยอมรับ เหมือน D2)

export const OBS_IP_LIMIT = 120;
export const OBS_WINDOW_MS = 60 * 1000;
export const OBS_LOG_MAX_KEYS = 5000;

export const obsRequestLog = new Map<string, number[]>();

/** true = ให้เรียกได้ (และนับครั้งนี้) · false = เกินเพดานในหน้าต่าง */
export function allowObsRequest(
  log: Map<string, number[]>,
  key: string,
  nowMs: number,
  limit: number = OBS_IP_LIMIT,
  windowMs: number = OBS_WINDOW_MS,
): boolean {
  if (log.size >= OBS_LOG_MAX_KEYS && !log.has(key)) pruneLog(log, nowMs, windowMs);
  const recent = (log.get(key) ?? []).filter((t) => t > nowMs - windowMs && t <= nowMs);
  if (recent.length >= limit) {
    log.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  log.set(key, recent);
  return true;
}

/** ตัดคีย์ที่ไม่มีคำขอในหน้าต่างแล้ว (กัน map โตไม่หยุดจาก IP สุ่ม) */
export function pruneLog(log: Map<string, number[]>, nowMs: number, windowMs: number = OBS_WINDOW_MS): void {
  for (const [k, ts] of log) {
    if (!ts.some((t) => t > nowMs - windowMs && t <= nowMs)) log.delete(k);
  }
}

/** IP ของผู้เรียกจาก header (x-forwarded-for ตัวแรก) · ไม่มี = "unknown" · ตัดความยาวกันคีย์ยาวผิดปกติ */
export function clientKey(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  const ip = first || headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}
