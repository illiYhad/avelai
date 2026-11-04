import type { ReactNode } from "react";

// K-AV-POLISH เฟส 2: ชิปสถานะกลาง (ต่อยอด .hud-chip) — mono 12px · โทนตาม token
// StatusBadge ยังใช้สำหรับสถานะทัวร์/แมตช์ที่มีข้อความไทยคงที่ · Chip ใช้กับข้อความอิสระ (ชนะ/แพ้/เตือน/ป้ายข้อมูล)
export type ChipTone = "cyan" | "gold" | "win" | "lose" | "warn" | "muted";
const TONE: Record<ChipTone, string> = {
  cyan: "",
  gold: "hud-chip-gold",
  win: "hud-chip-win",
  lose: "hud-chip-lose",
  warn: "hud-chip-warn",
  muted: "hud-chip-muted",
};

export default function Chip({
  tone = "cyan",
  dot = false,
  className = "",
  children,
}: {
  tone?: ChipTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`hud-chip ${TONE[tone]} ${className}`}>
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
