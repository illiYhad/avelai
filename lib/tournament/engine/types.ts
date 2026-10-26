// K-AV-4: ชนิดข้อมูลเอนจินสาย (pure · ไม่มีสุ่ม/เวลา) — ไม่ import ของเดิมใต้ lib/tournament/*.ts

export type BracketKind = "WB" | "LB" | "GF";
/** PENDING = รอทีมจากสล็อตก่อน · READY = ครบสองทีมแข่งได้ · BYE = ผ่านอัตโนมัติ (ไม่คิด ELO) · DONE = มีผลแล้ว · VOID = ไม่ใช้ (GF reset ที่ไม่เกิด) */
export type SlotStatus = "PENDING" | "READY" | "BYE" | "DONE" | "VOID";
export type Side = "A" | "B";

export type SlotLink = { to: string; side: Side };
export type SlotSource = { from: string; take: "winner" | "loser" };

export type Slot = {
  /** `${bracket}-${round}-${position}` · คงที่ต่อโครงสร้าง */
  key: string;
  bracket: BracketKind;
  round: number;
  position: number;
  teamA: string | null;
  teamB: string | null;
  winnerTo: SlotLink | null;
  loserTo: SlotLink | null;
  /** ฝั่ง A/B มาจากสล็อตไหน (null = ทีมตั้งต้นรอบแรก) */
  sourceA: SlotSource | null;
  sourceB: SlotSource | null;
  isGrandFinalReset: boolean;
  winnerId: string | null;
  status: SlotStatus;
};

export const slotKey = (bracket: BracketKind, round: number, position: number) => `${bracket}-${round}-${position}`;

export function nextPow2(n: number): number {
  let s = 1;
  while (s < n) s *= 2;
  return s;
}

export function log2int(n: number): number {
  let k = 0;
  while (1 << k < n) k++;
  return k;
}
