// K-AV-6: กติกาข้อพิพาท + โทษ (pure) — เปิดได้จาก LIVE|PAUSED|AWAITING_RESULT · ผลชี้ขาดต้องสอดคล้อง best_of
// Karma: ใบนี้แค่คืนค่า delta (สเปกหมวด 7: WARNING −5 · SUSPENSION −20 · dispute เท็จ −10) ให้ T7 เขียน karma_events — ห้ามเขียน karma ใน T6
import { validateScore } from "@/lib/match/report";

export const DISPUTE_OPENABLE = ["LIVE", "PAUSED", "AWAITING_RESULT"] as const;
export const DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
export const MAX_REASON_LENGTH = 1000;

export function canOpenDispute(matchStatus: string): string | null {
  return (DISPUTE_OPENABLE as readonly string[]).includes(matchStatus) ? null : `เปิดข้อพิพาทได้เฉพาะเมื่อแมตช์กำลังแข่ง/พัก/รอผล (ตอนนี้ ${matchStatus}) (422)`;
}

export const PENALTY_TYPES = ["WARNING", "SUSPENSION", "BAN", "KARMA"] as const;
export type PenaltyType = (typeof PENALTY_TYPES)[number];

/** delta Karma ตามสเปกหมวด 7 — ส่งต่อให้ T7 · FALSE_DISPUTE = เปิดข้อพิพาทเท็จ */
export const KARMA_DELTA = { WARNING: -5, SUSPENSION: -20, FALSE_DISPUTE: -10 } as const;
export type KarmaReason = keyof typeof KARMA_DELTA;
export function karmaDeltaFor(reason: KarmaReason): number {
  return KARMA_DELTA[reason];
}

export type Resolution =
  | { kind: "UPHOLD"; winnerTeamId: string; scoreA?: number; scoreB?: number }   // ตั้งผลใหม่ตามคำชี้ขาด (ADMIN_DECISION)
  | { kind: "REJECT" };                                                           // ข้อพิพาทไม่มีมูล — แมตช์กลับไปสถานะก่อนหน้า

/** ตรวจคำชี้ขาด: ผู้ชนะต้องอยู่ในแมตช์ · ถ้าให้คะแนนต้องสอดคล้อง best_of */
export function validateResolution(r: Resolution, m: { bestOf: number; teamA: string; teamB: string }): string | null {
  if (r.kind === "REJECT") return null;
  if (![m.teamA, m.teamB].includes(r.winnerTeamId)) return "ผู้ชนะต้องเป็นทีมในแมตช์นี้";
  if (r.scoreA !== undefined || r.scoreB !== undefined) {
    return validateScore(m, r.winnerTeamId, r.scoreA ?? -1, r.scoreB ?? -1);
  }
  return null;
}

/** โทษ SUSPENSION ต้องมีวันสิ้นสุดในอนาคต · BAN ไม่มีวันสิ้นสุด · KARMA ต้องมีค่าติดลบ */
export function validatePenalty(p: { type: string; until?: string | null; value?: number | null }, now: Date): string | null {
  if (!(PENALTY_TYPES as readonly string[]).includes(p.type)) return "ประเภทโทษไม่ถูกต้อง";
  if (p.type === "SUSPENSION") {
    if (!p.until || Number.isNaN(new Date(p.until).getTime())) return "ต้องระบุวันสิ้นสุดการระงับ";
    if (new Date(p.until).getTime() <= now.getTime()) return "วันสิ้นสุดต้องอยู่ในอนาคต";
  }
  if (p.type === "KARMA" && (p.value === undefined || p.value === null || !Number.isInteger(p.value) || p.value >= 0)) return "โทษ Karma ต้องเป็นค่าติดลบ";
  return null;
}
