// K-AV-7: Karma (pure) — สเปกหมวด 7: no-show/walkover ฝั่งตัวเอง −10 · dispute เท็จ −10 · WARNING −5 · SUSPENSION −20 · ฟื้น +2 ต่อแมตช์ COMPLETED ปกติ
// คะแนน: เริ่ม 100 · เดินตามเหตุการณ์ตามเวลา · clamp 0–100 ทุกก้าว (ตัดสินใจ: ไม่ใช้ clamp(100+SUM) ครั้งเดียว เพราะจะ "สะสมเกิน 100" จนโทษไม่มีผล — ดูใบตอบ)
// เกณฑ์: < 70 ลงได้เฉพาะ entry_type FREE · < 50 ห้ามลงทะเบียน 7 วัน นับจากเหตุการณ์ (ติดลบ) ล่าสุดที่ทำให้คะแนน < 50
// ตรรกะต้องตรงกับ public.karma_state() ใน SQL 180 — ไฟล์นี้เป็นตัวอ้างอิง (มีเทสต์)

export const KARMA_START = 100;
export const KARMA_MAX = 100;
export const KARMA_MIN = 0;
export const KARMA_RECOVER_PER_MATCH = 2;
export const KARMA_BLOCK_DAYS = 7;
export const KARMA_PAID_MIN = 70;   // ต่ำกว่านี้ลงได้เฉพาะ FREE
export const KARMA_BLOCK_BELOW = 50; // ต่ำกว่านี้ห้ามลงทะเบียน 7 วัน

export const KARMA_DELTAS = {
  MATCH_COMPLETED: 2,
  NO_SHOW: -10,
  FALSE_DISPUTE: -10,
  WARNING: -5,
  SUSPENSION: -20,
} as const;
export type KarmaReason = keyof typeof KARMA_DELTAS | "KARMA_PENALTY" | "ADMIN_ADJUST";
export type KarmaSource = "dispute" | "penalty" | "no_show" | "system";

export type KarmaEvent = { delta: number; createdAt: string | Date; revoked?: boolean }; // revoked = โทษต้นทางถูก ADMIN ยกเลิก → ไม่นับ (SQL: penalties.revoked_at)
export type KarmaState = { score: number; blockedUntil: Date | null };

export function clampKarma(n: number): number {
  return Math.min(KARMA_MAX, Math.max(KARMA_MIN, n));
}

/** คะแนน + วันปลดบล็อก (ถ้ามี) จากรายการเหตุการณ์ (เรียงตามเวลาเอง) */
export function karmaState(events: KarmaEvent[], now: Date): KarmaState {
  const sorted = events.filter((e) => !e.revoked).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let score = KARMA_START;
  let lastDrop: Date | null = null;
  for (const e of sorted) {
    score = clampKarma(score + e.delta);
    if (e.delta < 0 && score < KARMA_BLOCK_BELOW) lastDrop = new Date(e.createdAt);
  }
  const until = lastDrop ? new Date(lastDrop.getTime() + KARMA_BLOCK_DAYS * 86_400_000) : null;
  return { score, blockedUntil: until && until.getTime() > now.getTime() ? until : null };
}

export function karmaScore(events: KarmaEvent[]): number {
  return karmaState(events, new Date(0)).score;
}

/** ผู้ใช้คนเดียวลงทะเบียนได้ไหม (ตามคะแนน/บล็อก) · null = ผ่าน */
export function karmaGateReason(state: { score: number; blockedUntil: Date | string | null }, entryType: string, now: Date): string | null {
  if (state.blockedUntil && new Date(state.blockedUntil).getTime() > now.getTime()) {
    return `Karma ${state.score} < ${KARMA_BLOCK_BELOW} — ห้ามลงทะเบียนจนถึง ${new Date(state.blockedUntil).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;
  }
  if (state.score < KARMA_PAID_MIN && entryType !== "FREE") {
    return `Karma ${state.score} < ${KARMA_PAID_MIN} — ลงได้เฉพาะทัวร์ฟรี (FREE)`;
  }
  return null;
}
