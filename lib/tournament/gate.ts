// K-AV-7: จุดเกี่ยว Karma ตอนลงทะเบียน (แทนตัวคืน allowed:true ชั่วคราวจาก K-AV-3)
// รับ "สถานะ Karma" ของสมาชิกทุกคน (จาก RPC public.karma_states ใน SQL 180) → ปฏิเสธถ้ามีคนไม่ผ่าน (บอกชื่อ/รหัส + เหตุผล)
import type { EntryType } from "@/lib/tournament/state";
import { karmaGateReason } from "@/lib/karma/karma";

export type RegistrationGate = { allowed: true } | { allowed: false; reason: string };
export type MemberKarma = { userId: string; username?: string | null; score: number; blockedUntil: Date | string | null };

export function getRegistrationGate(members: MemberKarma[], entryType: EntryType, now: Date = new Date()): RegistrationGate {
  for (const m of members) {
    const why = karmaGateReason(m, entryType, now);
    if (why) return { allowed: false, reason: `สมาชิก ${m.username ?? m.userId}: ${why}` };
  }
  return { allowed: true };
}
