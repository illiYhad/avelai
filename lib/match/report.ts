// K-AV-5: ประเมินรายงานผลสองฝั่ง (pure) — ผลต้องมีหลักฐาน + ผู้ยืนยันเสมอ
// CONFIRMED = สองฝั่งตรงกัน · MISMATCH = ไม่ตรง (ไปผู้ตัดสิน) · WAITING = ยังขาดฝั่ง · AUTO_CONFIRM = เปิด auto_confirm และฝั่งเดียวส่ง(มีหลักฐาน)เกินเวลา

export type Report = {
  teamId: string;
  winnerTeamId: string;
  scoreA: number;
  scoreB: number;
  evidenceCount: number;
  createdAt: string;
};
export type ReportConfig = { bestOf: number; teamA: string; teamB: string; autoConfirm: boolean; autoConfirmMinutes: number };
export type Evaluation =
  | { kind: "WAITING"; reason: string }
  | { kind: "MISMATCH"; reason: string }
  | { kind: "CONFIRMED"; winnerId: string; scoreA: number; scoreB: number }
  | { kind: "AUTO_CONFIRM"; winnerId: string; scoreA: number; scoreB: number };

/** คะแนนสมเหตุผล: ผู้ชนะได้ ceil(best_of/2) พอดี · ผู้แพ้น้อยกว่า · ไม่ติดลบ · ผู้ชนะต้องเป็น A หรือ B */
export function validateScore(cfg: Pick<ReportConfig, "bestOf" | "teamA" | "teamB">, winnerTeamId: string, scoreA: number, scoreB: number): string | null {
  const need = Math.ceil(cfg.bestOf / 2);
  if (![cfg.teamA, cfg.teamB].includes(winnerTeamId)) return "ผู้ชนะต้องเป็นทีมในแมตช์นี้";
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) return "คะแนนต้องเป็นจำนวนเต็มไม่ติดลบ";
  const win = winnerTeamId === cfg.teamA ? scoreA : scoreB;
  const lose = winnerTeamId === cfg.teamA ? scoreB : scoreA;
  if (win !== need) return `ผู้ชนะต้องได้ ${need} เกม (Best of ${cfg.bestOf})`;
  if (lose >= need) return `ผู้แพ้ต้องได้น้อยกว่า ${need} เกม`;
  return null;
}

const sameResult = (a: Report, b: Report) => a.winnerTeamId === b.winnerTeamId && a.scoreA === b.scoreA && a.scoreB === b.scoreB;

export function evaluateReports(reportA: Report | null, reportB: Report | null, cfg: ReportConfig, now: Date): Evaluation {
  const reports = [reportA, reportB].filter((r): r is Report => !!r);
  for (const r of reports) {
    if (r.evidenceCount < 1) return { kind: "WAITING", reason: "รายงานที่ไม่มีหลักฐานไม่นับ" };
    const err = validateScore(cfg, r.winnerTeamId, r.scoreA, r.scoreB);
    if (err) return { kind: "MISMATCH", reason: `คะแนนที่ส่งเป็นไปไม่ได้: ${err}` };
  }
  if (reportA && reportB) {
    return sameResult(reportA, reportB)
      ? { kind: "CONFIRMED", winnerId: reportA.winnerTeamId, scoreA: reportA.scoreA, scoreB: reportA.scoreB }
      : { kind: "MISMATCH", reason: "สองฝั่งรายงานผลไม่ตรงกัน — รอผู้ตัดสิน" };
  }
  const one = reports[0];
  if (!one) return { kind: "WAITING", reason: "ยังไม่มีทีมส่งผล" };
  if (cfg.autoConfirm && cfg.autoConfirmMinutes > 0) {
    const deadline = new Date(one.createdAt).getTime() + cfg.autoConfirmMinutes * 60_000;
    if (now.getTime() >= deadline) return { kind: "AUTO_CONFIRM", winnerId: one.winnerTeamId, scoreA: one.scoreA, scoreB: one.scoreB };
    return { kind: "WAITING", reason: `รออีกฝั่งส่งผล (ยืนยันอัตโนมัติเมื่อครบ ${cfg.autoConfirmMinutes} นาที)` };
  }
  return { kind: "WAITING", reason: "รออีกฝั่งส่งผล" };
}
