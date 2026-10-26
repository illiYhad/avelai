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

export function readyDeadline(now: Date, readyCheckMinutes: number): Date {
  return new Date(now.getTime() + readyCheckMinutes * 60_000);
}
