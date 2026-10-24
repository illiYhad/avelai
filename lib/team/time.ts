// K-AV-H4: เวลานัดซ้อมใช้ Asia/Bangkok (UTC+7 · ไม่มี DST) ชัดเจนทั้งตอนรับค่า เก็บ และแสดง
// ต้นเหตุเดิม: <input type="datetime-local"> ส่ง "2026-10-25T20:00" (ไม่มีโซน) → server (Vercel = UTC)
// ตีความเป็น 20:00Z → เก็บผิด → browser ไทยแสดง 03:00 (+7) · ไม่ขึ้นกับ TZ ของ server/เครื่องผู้ใช้อีกต่อไป

export const BANGKOK_TZ = "Asia/Bangkok";
const BANGKOK_OFFSET = "+07:00";

const LOCAL_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/;
const ZONED_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/** รับ "YYYY-MM-DDTHH:mm" (เวลาไทย) หรือสตริงที่มีโซนกำกับ → Date · รูปแบบอื่น/วันที่ไม่มีจริง = null */
export function parseBangkokLocal(input: string): Date | null {
  const s = input.trim();
  const m = LOCAL_RE.exec(s);
  let d: Date;
  if (m) d = new Date(`${m[1]}T${m[2]}:${m[3] ?? "00"}${BANGKOK_OFFSET}`);
  else if (ZONED_RE.test(s)) d = new Date(s);
  else return null;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatBangkokDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { timeZone: BANGKOK_TZ });
}

export function formatBangkokTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", { timeZone: BANGKOK_TZ, hour: "2-digit", minute: "2-digit" });
}
