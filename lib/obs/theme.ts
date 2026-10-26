// K-AV-8: ธีมจอ OBS (pure) — สี/ฟอนต์ตามแบรนด์: Void Black #0B0E14 · Gold #C9A84C · Cyan #00D4FF · Orbitron/JetBrains Mono/Inter
import type { ObsTheme, SponsorTier } from "./validate";

export const BRAND = { void: "#0B0E14", gold: "#C9A84C", cyan: "#00D4FF", white: "#FFFFFF" } as const;

export type ThemeVars = {
  /** พื้นหลังทั้งหน้า (transparent = ให้ OBS ซ้อนบนภาพ) */
  pageBg: string;
  /** พื้นหลังการ์ด/แถบ */
  cardBg: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
};

export const THEME_VARS: Record<ObsTheme, ThemeVars> = {
  DARK: { pageBg: "transparent", cardBg: "rgba(11, 14, 20, 0.92)", text: BRAND.white, muted: "rgba(255,255,255,0.6)", accent: BRAND.cyan, border: "rgba(255,255,255,0.14)" },
  TRANSPARENT: { pageBg: "transparent", cardBg: "rgba(11, 14, 20, 0.55)", text: BRAND.white, muted: "rgba(255,255,255,0.7)", accent: BRAND.cyan, border: "rgba(255,255,255,0.25)" },
  GOLD: { pageBg: "transparent", cardBg: "rgba(11, 14, 20, 0.92)", text: BRAND.white, muted: "rgba(201,168,76,0.7)", accent: BRAND.gold, border: "rgba(201,168,76,0.45)" },
  CYAN: { pageBg: "transparent", cardBg: "rgba(0, 20, 28, 0.9)", text: BRAND.white, muted: "rgba(0,212,255,0.65)", accent: BRAND.cyan, border: "rgba(0,212,255,0.45)" },
};

export const THEME_LABEL: Record<ObsTheme, string> = { DARK: "มืด (Void Black)", TRANSPARENT: "โปร่งใส", GOLD: "ทอง", CYAN: "ฟ้า Cyan" };

/** style ของ root ของจอ (ตัวแปร CSS) — ใช้กับ inline style */
export function themeStyle(theme: ObsTheme): Record<`--obs-${string}`, string> {
  const v = THEME_VARS[theme];
  return { "--obs-page-bg": v.pageBg, "--obs-card-bg": v.cardBg, "--obs-text": v.text, "--obs-muted": v.muted, "--obs-accent": v.accent, "--obs-border": v.border };
}

export const OBS_FONT_DISPLAY = "'Orbitron', 'Inter', system-ui, sans-serif";
export const OBS_FONT_BODY = "'Inter', system-ui, sans-serif";
export const OBS_FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";
export const OBS_FONTS_HREF = "https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap";

// ---------------------------------------------------------------------------
// K-AV-UX2-OBS: เลย์เอาต์ตามคัมภีร์ (balehm-design-rules §2 ฐาน 8 · §10 จอถ่ายทอด 1920×1080)
// ---------------------------------------------------------------------------

/** ขอบปลอดภัย: ข้อมูลสำคัญห่างขอบจอ ≥ 64px (กัน OBS ตัดขอบ/overscan) */
export const OBS_SAFE = 64;

/** สเกลระยะห่างฐาน 8 (4 ใช้ได้เฉพาะส่วนย่อย) — margin/padding/gap ทุกค่าในจอ OBS ต้องมาจากตรงนี้ */
export const SPACE_SCALE = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;
export const S = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, safe: OBS_SAFE } as const;

/** กล่องสปอนเซอร์: ขนาดตายตัวต่อ Tier — ทุกกล่องใน Tier เดียวกันเท่ากัน (โลโก้ object-fit: contain ข้างใน) */
export const SPONSOR_BOX: Record<SponsorTier, { w: number; h: number }> = {
  GOLD: { w: 384, h: 216 },
  SILVER: { w: 256, h: 144 },
  BRONZE: { w: 224, h: 128 },
  PARTNER: { w: 192, h: 112 },
};
/** Tier 1 แถวบน · ที่เหลือแถวล่าง */
export const SPONSOR_ROWS: SponsorTier[][] = [["GOLD"], ["SILVER", "BRONZE", "PARTNER"]];

/** ป้ายล่าง (lower third): พื้นทึบ 85–90% ต่อธีม */
export const LOWER_THIRD_BG: Record<ObsTheme, string> = {
  DARK: "rgba(11, 14, 20, 0.88)",
  TRANSPARENT: "rgba(11, 14, 20, 0.85)",
  GOLD: "rgba(11, 14, 20, 0.88)",
  CYAN: "rgba(0, 20, 28, 0.88)",
};
/** แถบสีหมวด 6px ซ้ายสุด · LIVE = สี "สด/ผิดพลาด" บนพื้นมืด (§1) · สถานะอื่น = สีเน้นของธีม */
export const LOWER_THIRD_STRIPE = 6;
export const STATUS_STRIPE: Record<string, string> = { LIVE: "#F87171" };
export function stripeColor(status: string): string {
  return STATUS_STRIPE[status] ?? "var(--obs-accent)";
}

/** ตัวแปร CSS เลย์เอาต์ (แยกจาก themeStyle เพื่อไม่เปลี่ยนชุดสีเดิมของ T8) */
export function obsLayoutVars(theme: ObsTheme): Record<`--obs-${string}`, string> {
  return {
    "--obs-safe": `${OBS_SAFE}px`,
    "--obs-s-xxs": `${S.xxs}px`, "--obs-s-xs": `${S.xs}px`, "--obs-s-sm": `${S.sm}px`, "--obs-s-md": `${S.md}px`,
    "--obs-s-lg": `${S.lg}px`, "--obs-s-xl": `${S.xl}px`, "--obs-s-xxl": `${S.xxl}px`,
    "--obs-lt-bg": LOWER_THIRD_BG[theme],
  };
}

/** จอ 1920×1080 ไม่เลื่อน: สายแข่งยาวเกิน → ตัดที่ระดับรอบ/แถว (แสดงรอบล่าสุด + บอกจำนวนที่ซ่อน) */
export const BRACKET_MAX_ROUNDS = 5;
export const BRACKET_MAX_ROWS = 7;
export function clipBracket<T>(rounds: number[], rowsOf: (round: number) => T[]): { rounds: { round: number; rows: T[]; hidden: number }[]; hiddenRounds: number } {
  const shown = rounds.slice(-BRACKET_MAX_ROUNDS);
  return {
    hiddenRounds: rounds.length - shown.length,
    rounds: shown.map((round) => {
      const all = rowsOf(round);
      return { round, rows: all.slice(0, BRACKET_MAX_ROWS), hidden: Math.max(0, all.length - BRACKET_MAX_ROWS) };
    }),
  };
}
