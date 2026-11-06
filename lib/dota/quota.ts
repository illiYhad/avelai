// K-AV-QUOTA.1: กันโควตารายวันของ OpenDota — ใช้ตัวนับของ OpenDota เอง (header X-Rate-Limit-Remaining-Day)
// จึงตรงกันทุกเซิร์ฟเวอร์ ไม่ต้องมีตาราง/บริการเพิ่ม · ในหน่วยความจำเก็บแค่ "โหมดประหยัดถึงเมื่อไร"
// เซิร์ฟเวอร์ที่เพิ่งเปิดยังไม่รู้สถานะ เสียอย่างมาก 1 คำขอก็อ่าน header ได้
// ไฟล์นี้ไม่เรียกเครือข่าย (เทสได้) · เวลาทุกตัวรับจากผู้เรียก

export const DEFAULT_DAY_RESERVE = 600; // ใช้ไป 2,400 จาก 3,000 ต่อวัน แล้วเข้าโหมดประหยัด
export const SAVER_MS = 15 * 60 * 1000; // โหมดประหยัดครั้งละ 15 นาที แล้วให้คำขอถัดไปไปอ่าน header ใหม่
export const MAX_DATE_SKEW_MS = 120 * 1000; // header จากแคชของ Next ติด Date เก่ามา → ใช้เฉพาะคำตอบสด

let lowUntil = 0;

/** ค่าเผื่อรายวัน · OPENDOTA_DAY_RESERVE ต้องเป็นจำนวนเต็มไม่ติดลบ · ไม่มีหรืออ่านไม่ได้ = 600 */
export function dayReserve(env: Record<string, string | undefined> = process.env): number {
  const raw = env.OPENDOTA_DAY_RESERVE?.trim();
  return raw && /^\d+$/.test(raw) ? Number(raw) : DEFAULT_DAY_RESERVE;
}

type HeaderLike = { get(name: string): string | null } | null | undefined;

/** อ่าน header ของคำตอบ OpenDota · ไม่มี header โควตา · ไม่มี Date · Date ห่างเกิน 120 วินาที = ไม่เปลี่ยนสถานะ */
export function noteQuotaHeaders(headers: HeaderLike, nowMs: number): void {
  if (!headers || typeof headers.get !== "function") return;
  const remainingRaw = headers.get("x-rate-limit-remaining-day");
  if (remainingRaw === null || !/^\s*-?\d+\s*$/.test(remainingRaw)) return;
  const dateMs = Date.parse(headers.get("date") ?? "");
  if (!Number.isFinite(dateMs) || Math.abs(nowMs - dateMs) > MAX_DATE_SKEW_MS) return;
  lowUntil = Number(remainingRaw) <= dayReserve() ? nowMs + SAVER_MS : 0;
}

/** OpenDota ตอบ 429 = โควตาหมดแน่นอน → โหมดประหยัด 15 นาที */
export function noteQuotaExceeded(nowMs: number): void {
  lowUntil = nowMs + SAVER_MS;
}

/** อยู่ในโหมดประหยัดหรือไม่ · หมดเวลาแล้ว = false (คำขอถัดไปจะไปอ่าน header ใหม่) */
export function quotaLow(nowMs: number): boolean {
  return nowMs < lowUntil;
}

/** export ไว้ให้เทสล้างสถานะ — ไม่ได้ใช้ในโค้ดหน้าเว็บ */
export function resetQuotaState(): void {
  lowUntil = 0;
}
