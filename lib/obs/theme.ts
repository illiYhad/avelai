// K-AV-8: ธีมจอ OBS (pure) — สี/ฟอนต์ตามแบรนด์: Void Black #0B0E14 · Gold #C9A84C · Cyan #00D4FF · Orbitron/JetBrains Mono/Inter
import type { ObsTheme } from "./validate";

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
