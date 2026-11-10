// K-AV-HOME.1: ป้ายเวลาของการ์ด "ทัวร์นาเมนต์สำหรับคุณ" (pure · เวลาไทย Asia/Bangkok = UTC+7 ไม่มี DST)
// ไม่ใช้ Intl เพื่อให้ผลเหมือนกันทุกเครื่อง (server/เทส)
// K-AV-I18N.0b: ข้อความจากพจนานุกรม (dict(locale).home.time) · th = แบบเดิม · en = "Now" · "Nov 12, 04:15" · เขตเวลาเดิม
import { dict, defaultLocale, type Locale } from "@/lib/i18n";

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** K-AV-I18N.0b: แทน {ชื่อ} ในข้อความพจนานุกรม (ใช้ทั้งหน้า Home) */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

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

export function tournamentTimeLabel(status: string, startAt: string | null, now: number, locale: Locale = defaultLocale): string {
  const t = dict(locale).home.time;
  if (status === "RUNNING" || status === "CHECK_IN") return t.now;
  if (!startAt) return t.tbd;
  const start = Date.parse(startAt);
  if (Number.isNaN(start)) return t.tbd;

  const diff = start - now;
  if (diff > 0 && diff <= 60 * 60 * 1000) return fill(t.inMinutes, { n: Math.max(1, Math.ceil(diff / 60000)) });

  const s = bkk(start);
  const n = bkk(now);
  if (s.dayIndex === n.dayIndex) return fill(t.today, { time: s.hhmm });
  if (s.dayIndex === n.dayIndex + 1) return fill(t.tomorrow, { time: s.hhmm });
  return locale === "en" ? `${EN_MONTHS[s.month]} ${s.day}, ${s.hhmm}` : `${s.day} ${TH_MONTHS[s.month]} ${s.hhmm}`;
}
