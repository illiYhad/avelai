// K-AV-TOUR.1: นาฬิกานับถอยหลังหัวทัวร์ (pure)

export type CountdownView =
  | { kind: "countdown"; text: string }
  | { kind: "soon" }
  | { kind: "live" }
  | { kind: "unset" }
  | { kind: "none" };

export const COUNTDOWN_PREFIX = "เริ่มใน";
export const COUNTDOWN_SOON = "กำลังจะเริ่ม";
export const COUNTDOWN_LIVE = "กำลังแข่ง";
export const COUNTDOWN_UNSET = "ยังไม่กำหนดเวลาเริ่ม";

const pad = (n: number) => String(n).padStart(2, "0");

/** เวลาปัจจุบันของ server ตอน render (แยกเป็นฟังก์ชันให้หน้าเรียก · เทสแทนได้) */
export function serverNowMs(): number {
  return Date.now();
}

/** มิลลิวินาทีที่เหลือ → "hh:mm:ss" (ชั่วโมงไม่ตัดที่ 24 · ≤0 = "00:00:00" · ปัดเศษวินาทีขึ้น) */
export function formatHms(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "00:00:00";
  const total = Math.ceil(remainingMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const DAY_UNIT = "วัน";
const DAY_SECONDS = 86_400;

/** K-AV-TOUR.1a (อลิส 2.1): เหลือ ≥ 24 ชม. → "X วัน HH:MM:SS" · < 24 ชม. → formatHms เดิม · ปัดวินาทีขึ้นเหมือน formatHms */
export function formatCountdown(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return formatHms(remainingMs);
  const total = Math.ceil(remainingMs / 1000);
  if (total < DAY_SECONDS) return formatHms(remainingMs);
  const days = Math.floor(total / DAY_SECONDS);
  return `${days} ${DAY_UNIT} ${formatHms((total % DAY_SECONDS) * 1000)}`;
}

/** REGISTRATION/CHECK_IN = นับถอยหลัง (≤0 = กำลังจะเริ่ม) · RUNNING = กำลังแข่ง · อื่น ๆ = ป้ายสถานะอย่างเดียว */
export function countdownView(status: string, startAt: string | null, now: number): CountdownView {
  if (status === "RUNNING") return { kind: "live" };
  if (status !== "REGISTRATION" && status !== "CHECK_IN") return { kind: "none" };
  const start = startAt ? Date.parse(startAt) : NaN;
  if (Number.isNaN(start)) return { kind: "unset" };
  const left = start - now;
  if (left <= 0) return { kind: "soon" };
  return { kind: "countdown", text: formatCountdown(left) };
}
