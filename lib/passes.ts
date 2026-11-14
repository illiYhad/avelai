// K-AV-3 → K-AV-PASS.2: Arena Pass รอบเดือนปฏิทิน (pure) — ราคา 380 บาท / เดือน · เงินรางวัลรายสัปดาห์ 75% ของยอดที่ยืนยันแล้ว (แสดงเท่านั้น ไม่ settle)
// มติซอง 026: Pass เดือน M ใช้ได้วันที่ 1 00:00:00 – วันสุดท้าย 23:59:59 เวลาไทย · ซื้อของเดือน M ได้ถึงวันที่ 1 ของเดือน M+1 23:59:59 ICT
// เวลาไทย = UTC+7 คงที่ (ตรงกับตัวกันฐานใน 218) · ไม่ใช้ setMonth

export const PASS_PRICE_THB = 380;
export const PRIZE_POOL_RATIO = 0.75;
export const PASS_PERIOD_LABEL = "ใช้ได้ 1–สิ้นเดือน (เวลาไทย)";

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export type PassRow = { game: string; starts_at: string; ends_at: string };

/** "YYYY-MM-01" ของปี/เดือน (monthIndex 0–11 · เกินช่วงได้ Date.UTC เลื่อนปีให้) */
function monthKey(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function parsePassMonth(passMonth: string): { y: number; m: number } | null {
  const r = /^(\d{4})-(0[1-9]|1[0-2])-01$/.exec(passMonth);
  return r ? { y: Number(r[1]), m: Number(r[2]) - 1 } : null;
}

/** รูปแบบ pass_month ถูกต้อง = "YYYY-MM-01" */
export function isPassMonth(v: unknown): v is string {
  return typeof v === "string" && parsePassMonth(v) !== null;
}

/** เดือนของ Pass (วันที่ 1) ที่เวลา at ตกอยู่ ตามเวลาไทย */
export function passMonthOf(at: Date): string {
  const ict = new Date(at.getTime() + ICT_OFFSET_MS);
  return monthKey(ict.getUTCFullYear(), ict.getUTCMonth());
}

/** ช่วงใช้ได้ของ Pass เดือนนั้น: startsAt = วันที่ 1 00:00 ICT · endsAt = วันที่ 1 เดือนถัดไป 00:00 ICT (exclusive) */
export function passMonthWindow(passMonth: string): { startsAt: Date; endsAt: Date } {
  const p = parsePassMonth(passMonth);
  if (!p) throw new Error(`pass_month ไม่ถูกต้อง: ${passMonth}`);
  return {
    startsAt: new Date(Date.UTC(p.y, p.m, 1) - ICT_OFFSET_MS),
    endsAt: new Date(Date.UTC(p.y, p.m + 1, 1) - ICT_OFFSET_MS),
  };
}

/** เดือนที่ซื้อได้ตอนนี้: วันที่ 1 (ICT) = [เดือนก่อน, เดือนนี้] · วันอื่น = [เดือนนี้] */
export function purchasableMonths(now: Date = new Date()): string[] {
  const ict = new Date(now.getTime() + ICT_OFFSET_MS);
  const y = ict.getUTCFullYear();
  const m = ict.getUTCMonth();
  const current = monthKey(y, m);
  return ict.getUTCDate() === 1 ? [monthKey(y, m - 1), current] : [current];
}

/** "พฤศจิกายน 2569" (พ.ศ.) */
export function passMonthLabel(passMonth: string): string {
  const p = parsePassMonth(passMonth);
  return p ? `${THAI_MONTHS[p.m]} ${p.y + 543}` : passMonth;
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
