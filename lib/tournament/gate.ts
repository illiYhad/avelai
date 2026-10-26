// K-AV-3 ข้อ 7: จุดเกี่ยว Karma — T7 (K-AV-7) จะเติมตรรกะจริง · ตอนนี้อนุญาตทุกกรณี (ห้ามเดา Karma ใน T3)
import type { EntryType } from "@/lib/tournament/state";

export type RegistrationGate = { allowed: true } | { allowed: false; reason: string };

export function getRegistrationGate(_userIds: string[], _entryType: EntryType): RegistrationGate {
  // TODO(K-AV-7): ตรวจ Karma ของสมาชิกทีม (userIds) ตามประเภทค่าเข้า
  return { allowed: true };
}
