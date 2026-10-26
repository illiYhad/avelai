// K-AV-5: ตัดสิน walkover ตอนเช็กความพร้อม (pure) — ทีมเดียวพร้อม + เกินเวลา → ทีมที่พร้อมชนะ
// ทั้งสองไม่พร้อม/ยังไม่เริ่มเช็ก → ไม่ตัดสินเอง (สเปกไม่ระบุ → ผู้ตัดสินตัดสิน)

export type ReadyCheckState = {
  status: string;
  teamA: string | null;
  teamB: string | null;
  checkInA: string | null;
  checkInB: string | null;
  forfeitDeadlineAt: string | null;
};

export type WalkoverDecision = { kind: "NONE"; reason: string } | { kind: "WALKOVER"; winnerId: string; loserId: string };

export function resolveReadyCheck(m: ReadyCheckState, now: Date): WalkoverDecision {
  if (m.status !== "READY_CHECK") return { kind: "NONE", reason: "ไม่ได้อยู่ในช่วงเช็กความพร้อม" };
  if (!m.forfeitDeadlineAt || now.getTime() < new Date(m.forfeitDeadlineAt).getTime()) return { kind: "NONE", reason: "ยังไม่หมดเวลา" };
  if (!m.teamA || !m.teamB) return { kind: "NONE", reason: "ทีมยังไม่ครบ" };
  const a = !!m.checkInA, b = !!m.checkInB;
  if (a && !b) return { kind: "WALKOVER", winnerId: m.teamA, loserId: m.teamB };
  if (b && !a) return { kind: "WALKOVER", winnerId: m.teamB, loserId: m.teamA };
  if (a && b) return { kind: "NONE", reason: "ทั้งสองทีมพร้อมแล้ว" };
  return { kind: "NONE", reason: "ทั้งสองทีมไม่พร้อม — รอผู้ตัดสินตัดสิน" };
}

/** หัวหน้าทีมเริ่มเช็กความพร้อมได้ก่อนเวลานัดไม่เกินกี่นาที (ตรงกับ window_min ใน trigger 160) */
export const READY_WINDOW_MINUTES = 30;

/** เริ่มเช็กความพร้อมได้ไหม: ต้องมีเวลานัด และ now ≥ เวลานัด − 30 นาที · คืนข้อความไทยเมื่อไม่ได้ */
export function canStartReadyCheck(scheduledAt: string | null, now: Date): string | null {
  if (!scheduledAt) return "ผู้จัดยังไม่กำหนดเวลาแข่ง — เช็กความพร้อมยังเปิดไม่ได้";
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return "เวลานัดไม่ถูกต้อง";
  if (now.getTime() < t - READY_WINDOW_MINUTES * 60_000) return `เช็กความพร้อมเปิดก่อนเวลานัด ${READY_WINDOW_MINUTES} นาที`;
  return null;
}

/** deadline = max(now, เวลานัด) + นาที (ตรงกับ trigger) */
export function readyDeadline(now: Date, readyCheckMinutes: number, scheduledAt?: string | null): Date {
  const base = scheduledAt ? Math.max(now.getTime(), new Date(scheduledAt).getTime()) : now.getTime();
  return new Date(base + readyCheckMinutes * 60_000);
}
