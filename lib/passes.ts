// K-AV-3: Weekly Pass (pure) — ราคา 380 บาท · อายุ 28 วัน · เงินรางวัลรายสัปดาห์ 75% ของยอดที่ยืนยันแล้ว (แสดงเท่านั้น ไม่ settle)

export const PASS_PRICE_THB = 380;
export const PASS_DAYS = 28;
export const PRIZE_POOL_RATIO = 0.75;

export type PassRow = { game: string; starts_at: string; ends_at: string };

export function passEndsAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + PASS_DAYS * 24 * 60 * 60 * 1000);
}

/** มี pass ของเกมนั้นที่ยังไม่หมดอายุ (starts_at ≤ now < ends_at) */
export function hasActivePass(passes: PassRow[], game: string, now: Date = new Date()): boolean {
  const t = now.getTime();
  return passes.some((p) => p.game === game && new Date(p.starts_at).getTime() <= t && t < new Date(p.ends_at).getTime());
}

/** 75% ของผลรวม ปัดลงเป็นสตางค์ · ไม่เกินผลรวม · ยอดติดลบ/ไม่ใช่ตัวเลขถูกข้าม */
export function weeklyPrizePool(verifiedPassAmountsThb: number[]): number {
  const satang = verifiedPassAmountsThb
    .filter((a) => Number.isFinite(a) && a > 0)
    .reduce((s, a) => s + Math.round(a * 100), 0);
  return Math.min(satang, Math.floor(satang * PRIZE_POOL_RATIO)) / 100;
}
