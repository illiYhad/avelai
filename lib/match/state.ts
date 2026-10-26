// K-AV-5: state machine ของแมตช์ (pure · ตรงกับ trigger tournament_matches_guard_status ใน 160_match_flow.sql)
// SCHEDULED → READY_CHECK → LIVE ⇄ PAUSED → AWAITING_RESULT → COMPLETED · terminal: COMPLETED · WALKOVER · BYE · CANCELLED
// DISPUTED ได้จาก LIVE/PAUSED/AWAITING_RESULT เท่านั้น (T6: หัวหน้าทีมเปิดได้เมื่อมี dispute OPEN · 170 นิยาม trigger ใหม่) · WALKOVER จาก READY_CHECK (ทีมเดียวพร้อม + เกินเวลา) หรือผู้ตัดสินสั่ง

export const MATCH_STATUSES = ["SCHEDULED", "READY_CHECK", "LIVE", "PAUSED", "AWAITING_RESULT", "DISPUTED", "COMPLETED", "WALKOVER", "BYE", "CANCELLED"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  SCHEDULED: ["READY_CHECK", "LIVE", "WALKOVER", "CANCELLED"],
  READY_CHECK: ["LIVE", "WALKOVER", "CANCELLED"],
  LIVE: ["PAUSED", "AWAITING_RESULT", "DISPUTED", "COMPLETED", "CANCELLED"],
  PAUSED: ["LIVE", "AWAITING_RESULT", "DISPUTED", "COMPLETED", "CANCELLED"],
  AWAITING_RESULT: ["COMPLETED", "DISPUTED", "CANCELLED"],
  DISPUTED: ["COMPLETED", "AWAITING_RESULT", "CANCELLED"], // K-AV-6: REJECT ข้อพิพาท → กลับไปรอผล (staff เท่านั้น ตาม trigger 170)
  COMPLETED: [],
  WALKOVER: [],
  BYE: [],
  CANCELLED: [],
};
/** transition ที่ "หัวหน้าทีม" ทำเองได้ (ที่เหลือ = ผู้ตัดสิน/ผู้จัด/ADMIN) — trigger ฝั่ง DB บังคับซ้ำ */
export const LEADER_TRANSITIONS: readonly `${MatchStatus}>${MatchStatus}`[] = [
  "SCHEDULED>READY_CHECK", "READY_CHECK>LIVE", "LIVE>AWAITING_RESULT", "PAUSED>AWAITING_RESULT", "AWAITING_RESULT>COMPLETED", "READY_CHECK>WALKOVER",
];
export const TERMINAL: readonly MatchStatus[] = ["COMPLETED", "WALKOVER", "BYE", "CANCELLED"];

export function isMatchStatus(v: unknown): v is MatchStatus {
  return typeof v === "string" && (MATCH_STATUSES as readonly string[]).includes(v);
}
export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  return MATCH_TRANSITIONS[from].includes(to);
}
export const isTerminal = (s: MatchStatus) => TERMINAL.includes(s);

/** ข้อความ 422 ภาษาไทยเมื่อข้ามขั้น */
export function transitionError(from: MatchStatus, to: MatchStatus): string {
  return `เปลี่ยนสถานะแมตช์จาก ${MATCH_LABEL[from]} ไป ${MATCH_LABEL[to]} ไม่ได้ (422)`;
}

export const MATCH_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "รอเริ่ม", READY_CHECK: "เช็กความพร้อม", LIVE: "กำลังแข่ง", PAUSED: "พัก", AWAITING_RESULT: "รอผล",
  DISPUTED: "มีข้อพิพาท", COMPLETED: "จบแล้ว", WALKOVER: "ชนะบาย (อีกฝ่ายไม่มา)", BYE: "ผ่านอัตโนมัติ", CANCELLED: "ยกเลิก",
};

export const OUTCOMES = ["NORMAL", "FORFEIT", "WALKOVER", "ADMIN_DECISION"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const RESULT_SOURCES = ["PLAYER_REPORT", "REFEREE", "WALKOVER", "BYE", "ADMIN_DECISION"] as const;
