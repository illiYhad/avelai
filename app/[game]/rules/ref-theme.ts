// K-AV-RULES.2: ธีมหน้า /dota2/rules ตามต้นแบบ — ไฟล์เดียวที่มีรหัสสี hex ได้
// ต้นแบบ: D:\Balehm_Studio\02_Products\AVELAi\01_Spec\REF_ultimate_solo_อัปเดต_2026-11-07.html
// ส่งเข้าหน้าเป็น CSS variable ที่ตัวห่อหน้า แล้วคลาส Tailwind อ่าน var(--ref-*)
import type { CSSProperties } from "react";

export const REF = {
  // :16–30 tailwind.config brand
  dark: "#0A0A0F",
  card: "#111827",
  border: "#1f2937",
  cyan: "#00D4FF",
  gold: "#C9A84C",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  amber: "#f59e0b",
  emerald: "#10b981",
  rose: "#f43f5e",
  // Tailwind slate/สีอื่นที่ต้นแบบใช้ในคลาส (slate-300/400/500/700/800/900/950 · cyan-400 · pink-300/400 · emerald-300/400 · rose-300/400 · blue-400 · amber-400)
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  slate950: "#020617",
  cyan400: "#22d3ee",
  pink300: "#f9a8d4",
  pink400: "#f472b6",
  emerald300: "#6ee7b7",
  emerald400: "#34d399",
  rose300: "#fda4af",
  rose400: "#fb7185",
  blue400: "#60a5fa",
  amber400: "#fbbf24",
  // :55–60 glow
  glowCyan: "0 0 20px #00D4FF26",
  glowGold: "0 0 20px #C9A84C26",
  // สีกราฟ
  radarSwissFill: "#00D4FF40", // :636 rgba(0,212,255,0.25)
  radarQueueFill: "#C9A84C40", // :644 rgba(201,168,76,0.25)
  roleColors: ["#00D4FF", "#3b82f6", "#10b981", "#C9A84C", "#f59e0b"], // :687
  scoreOutcome: "#00D4FF", // :726
  scoreKp: "#3b82f6", // :731
  scoreRole: "#C9A84C", // :736
  penaltyColors: ["#f59e0b", "#f43f5e", "#e11d48", "#9f1239"], // :777
  axisText: "#94a3b8", // :608 Chart.defaults.color
} as const;

/** CSS variable ของหน้า (ตั้งที่ตัวห่อ <main>) */
export const REF_VARS = {
  "--ref-dark": REF.dark,
  "--ref-text": "#f3f4f6", // :38 body color
  "--ref-card": REF.card,
  "--ref-border": REF.border,
  "--ref-cyan": REF.cyan,
  "--ref-gold": REF.gold,
  "--ref-blue": REF.blue,
  "--ref-pink": REF.pink,
  "--ref-amber": REF.amber,
  "--ref-emerald": REF.emerald,
  "--ref-rose": REF.rose,
  "--ref-s300": REF.slate300,
  "--ref-s400": REF.slate400,
  "--ref-s500": REF.slate500,
  "--ref-s700": REF.slate700,
  "--ref-s800": REF.slate800,
  "--ref-s900": REF.slate900,
  "--ref-s950": REF.slate950,
  "--ref-cyan400": REF.cyan400,
  "--ref-pink300": REF.pink300,
  "--ref-pink400": REF.pink400,
  "--ref-em300": REF.emerald300,
  "--ref-em400": REF.emerald400,
  "--ref-rose300": REF.rose300,
  "--ref-rose400": REF.rose400,
  "--ref-blue400": REF.blue400,
  "--ref-amber400": REF.amber400,
  "--ref-glow-cyan": REF.glowCyan,
  "--ref-glow-gold": REF.glowGold,
  // ค่าโปร่งแสงที่ต้นแบบใช้ (เช่น bg-brand-cyan/10 · border-brand-gold/30)
  "--ref-cyan-10": "#00D4FF1A",
  "--ref-cyan-30": "#00D4FF4D",
  "--ref-cyan-50": "#00D4FF80",
  "--ref-gold-10": "#C9A84C1A",
  "--ref-gold-30": "#C9A84C4D",
  "--ref-gold-50": "#C9A84C80",
  "--ref-card-80": "#111827CC",
  "--ref-dark-90": "#0A0A0FE6",
  "--ref-s800-80": "#1e293bCC",
  "--ref-s800-60": "#1e293b99",
  "--ref-em-950": "#022c2266",
  "--ref-em-900": "#064e3b66",
  "--ref-em-900-20": "#064e3b33",
  "--ref-em-40": "#10b98166",
  "--ref-rose-950": "#4c051966",
  "--ref-rose-900": "#88133766",
  "--ref-rose-900-20": "#88133733",
  "--ref-rose-40": "#f43f5e66",
  "--ref-cyan-950": "#083344",
  "--ref-cyan-800": "#155e75",
  "--ref-pink-950": "#500724",
  "--ref-pink-800": "#9d174d",
} as unknown as CSSProperties;
