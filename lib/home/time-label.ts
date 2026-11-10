// K-AV-HOME.1: ป้ายเวลาของการ์ด "ทัวร์นาเมนต์สำหรับคุณ" (pure · เวลาไทย Asia/Bangkok = UTC+7 ไม่มี DST)
// ไม่ใช้ Intl เพื่อให้ผลเหมือนกันทุกเครื่อง (server/เทส)

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const pad = (n: number) => String(n).padStart(2, "0");

/** วันที่ตามเวลาไทย (เลขวันนับจาก epoch) + ชั่วโมง:นาที */
function bkk(ms: number) {
  const d = new Date(ms + BKK_OFFSET_MS);
  return {
    dayIndex: Math.floor((ms + BKK_OFFSET_MS) / DAY_MS),
    hhmm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
  };
}

export function tournamentTimeLabel(status: string, startAt: string | null, now: number): string {
  if (status === "RUNNING" || status === "CHECK_IN") return "ตอนนี้";
  if (!startAt) return "ยังไม่กำหนดวัน";
  const start = Date.parse(startAt);
  if (Number.isNaN(start)) return "ยังไม่กำหนดวัน";

  const diff = start - now;
  if (diff > 0 && diff <= 60 * 60 * 1000) return `อีก ${Math.max(1, Math.ceil(diff / 60000))} นาที`;

  const s = bkk(start);
  const n = bkk(now);
  if (s.dayIndex === n.dayIndex) return `วันนี้ ${s.hhmm}`;
  if (s.dayIndex === n.dayIndex + 1) return `พรุ่งนี้ ${s.hhmm}`;
  return `${s.day} ${TH_MONTHS[s.month]} ${s.hhmm}`;
}
