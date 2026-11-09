// K-AV-TOUR.1: Timeline 4 จุดของทัวร์ (pure · รับ now จากผู้เรียก · ไม่อ่านนาฬิกาเอง)
// เปิดรับสมัคร → ปิดรับสมัคร → เปิดเช็กอิน (start_at − check_in_minutes) → เริ่มแข่ง

export type TimelineKey = "reg_open" | "reg_close" | "check_in" | "start";
export type TimelineState = "past" | "current" | "upcoming" | "unset";

export interface TimelineInput {
  reg_open_at: string | null;
  reg_close_at: string | null;
  check_in_minutes: number | null;
  start_at: string | null;
}

export interface TimelinePoint {
  key: TimelineKey;
  label: string;
  at: string | null;
  state: TimelineState;
}

export const TIMELINE_LABEL: Record<TimelineKey, string> = {
  reg_open: "เปิดรับสมัคร",
  reg_close: "ปิดรับสมัคร",
  check_in: "เปิดเช็กอิน",
  start: "เริ่มแข่ง",
};

export const TIMELINE_UNSET = "ยังไม่กำหนด";

const ms = (iso: string | null): number | null => {
  if (!iso) return null;
  const v = Date.parse(iso);
  return Number.isNaN(v) ? null : v;
};

/** เวลาเปิดเช็กอิน = start_at − check_in_minutes · ขาดค่าใดค่าหนึ่ง = null */
export function checkInOpensAt(startAt: string | null, minutes: number | null): string | null {
  const s = ms(startAt);
  if (s === null || minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  return new Date(s - minutes * 60_000).toISOString();
}

/**
 * past = ถึงแล้ว (เวลา ≤ now) แต่ไม่ใช่จุดล่าสุดที่ถึง
 * current = จุดล่าสุดที่ถึงแล้ว (จุดถัดไปยังไม่ถึง) · เวลาเท่ากันหลายจุด = จุดที่อยู่ท้ายสุดในลำดับ
 * upcoming = ยังไม่ถึง · unset = ค่า null
 */
export function buildTimeline(t: TimelineInput, now: Date | number): TimelinePoint[] {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const raw: { key: TimelineKey; at: string | null }[] = [
    { key: "reg_open", at: t.reg_open_at },
    { key: "reg_close", at: t.reg_close_at },
    { key: "check_in", at: checkInOpensAt(t.start_at, t.check_in_minutes) },
    { key: "start", at: t.start_at },
  ];
  let currentIdx = -1;
  let currentMs = -Infinity;
  raw.forEach((p, i) => {
    const v = ms(p.at);
    if (v !== null && v <= nowMs && v >= currentMs) {
      currentMs = v;
      currentIdx = i;
    }
  });
  return raw.map((p, i) => {
    const v = ms(p.at);
    let state: TimelineState;
    if (v === null) state = "unset";
    else if (i === currentIdx) state = "current";
    else if (v <= nowMs) state = "past";
    else state = "upcoming";
    return { key: p.key, label: TIMELINE_LABEL[p.key], at: p.at, state };
  });
}

/** เวลาไทยแบบสั้นสำหรับจุดบน Timeline */
export function fmtBangkok(iso: string | null): string {
  if (!iso || ms(iso) === null) return TIMELINE_UNSET;
  return new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}
