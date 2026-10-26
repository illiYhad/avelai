// K-AV-3: state machine ของทัวร์นาเมนต์ (pure · ตรงกับ trigger ใน supabase/migrations/140_tournaments_registration.sql)
// DRAFT → REGISTRATION → CHECK_IN → SEEDING → RUNNING → COMPLETED · CANCELLED ได้จากสถานะก่อน RUNNING เท่านั้น

export const TOURNAMENT_STATUSES = ["DRAFT", "REGISTRATION", "CHECK_IN", "SEEDING", "RUNNING", "COMPLETED", "CANCELLED"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TRANSITIONS: Record<TournamentStatus, readonly TournamentStatus[]> = {
  DRAFT: ["REGISTRATION", "CANCELLED"],
  REGISTRATION: ["CHECK_IN", "CANCELLED"],
  CHECK_IN: ["SEEDING", "CANCELLED"],
  SEEDING: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isTournamentStatus(v: unknown): v is TournamentStatus {
  return typeof v === "string" && (TOURNAMENT_STATUSES as readonly string[]).includes(v);
}

export function canTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: TournamentStatus): readonly TournamentStatus[] {
  return TRANSITIONS[from];
}

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: "ร่าง",
  REGISTRATION: "เปิดรับสมัคร",
  CHECK_IN: "เช็กอิน",
  SEEDING: "จัดสาย",
  RUNNING: "กำลังแข่ง",
  COMPLETED: "จบแล้ว",
  CANCELLED: "ยกเลิก",
};

export const TOURNAMENT_FORMATS = ["SWISS", "SE", "DE"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export const FORMAT_LABEL: Record<TournamentFormat, string> = { SWISS: "Swiss", SE: "แพ้คัดออก", DE: "แพ้สองครั้งคัดออก" };

export const ENTRY_TYPES = ["FREE", "WEEKLY_PASS", "PAID"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];
export const ENTRY_LABEL: Record<EntryType, string> = { FREE: "ฟรี", WEEKLY_PASS: "ใช้ Weekly Pass", PAID: "จ่ายค่าเข้า" };

export const REGISTRATION_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "WITHDRAWN", "REJECTED"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export const REG_LABEL: Record<RegistrationStatus, string> = {
  PENDING_PAYMENT: "รอชำระ/ยืนยันสลิป",
  CONFIRMED: "ยืนยันแล้ว",
  CHECKED_IN: "เช็กอินแล้ว",
  WITHDRAWN: "ถอนตัว",
  REJECTED: "ถูกปฏิเสธ",
};

export const BEST_OF = [1, 3, 5, 7] as const;
