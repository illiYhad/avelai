// K-AV-POLISH เฟส 2/3: สีที่ต้องเป็นค่าใน JS (recharts · style inline · SVG) รวมไว้ที่เดียว
// ค่าทั้งหมดชี้ token ใน app/globals.css ผ่าน CSS variable — ยกเว้น POSITION_COLORS ที่เป็น hex
// (ข้อยกเว้นที่จดในใบตอบ: สีตำแหน่ง Pos 1–5 ต้องเป็น hex เพราะบางหน้าต่อท้าย alpha เช่น `${color}40`)

/** สีฝั่ง: Radiant/ทีม A = ฟ้า · Dire/ทีม B = ทอง */
export const TEAM_COLORS = {
  radiant: "var(--color-radiant)",
  dire: "var(--color-dire)",
} as const;

/** สีกราฟกลาง (recharts ใช้เป็น stroke/fill ได้ตรง ๆ) */
export const CHART_COLORS = {
  cyan: "var(--color-cyan)",
  gold: "var(--color-gold)",
  win: "var(--color-win)",
  lose: "var(--color-lose)",
  warn: "var(--color-warn)",
  ink: "var(--color-ink)",
  muted: "var(--color-ink-muted)",
  grid: "rgba(255, 255, 255, 0.08)",
  cursor: "rgba(0, 212, 255, 0.08)",
  panel: "var(--color-panel)",
} as const;

/** สีประจำตำแหน่ง Dota 2 (Pos 1–5) — ใช้ร่วมกันทุกหน้า */
export const POSITION_COLORS: Record<string, string> = {
  "Pos 1": "#E8384F",
  "Pos 2": "#2E9BFF",
  "Pos 3": "#39FF6A",
  "Pos 4": "#D63CE8",
  "Pos 5": "#C8CDD4",
};
export const POSITION_FALLBACK = "#C8CDD4";

/** สีฝั่งแบบ hex — ใช้เฉพาะที่ต้องต่อท้าย alpha (`${c}40`) เช่น ProfileCard · ที่อื่นใช้ TEAM_COLORS */
export const TEAM_HEX = { radiant: "#00D4FF", dire: "#C9A84C" } as const;
