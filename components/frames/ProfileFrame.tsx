import type { ReactNode } from "react";
import { resolveFrame, type FrameId, type FrameSize } from "@/lib/frames/catalog";

// K-AV-R3C.1: กรอบโปรไฟล์ 8 แบบ · SVG ในไฟล์ (ไม่โหลดรูปภายนอก) · สี CI ทอง #C9A84C · ฟ้า #00D4FF · แบบเรียบก่อนบอร์ดดีไซน์อลิส
const GOLD = "#C9A84C";
const CYAN = "#00D4FF";

const ART: Record<FrameId, ReactNode> = {
  frame_rookie: <circle cx="50" cy="50" r="46" fill="none" stroke="#6B7280" strokeWidth="3" />,
  frame_ticket: <circle cx="50" cy="50" r="46" fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="6 4" />,
  frame_hud_cyan: (
    <>
      <circle cx="50" cy="50" r="46" fill="none" stroke={CYAN} strokeWidth="3" />
      <path d="M50 1v8M50 91v8M1 50h8M91 50h8" stroke={CYAN} strokeWidth="3" />
    </>
  ),
  frame_pass: (
    <>
      <circle cx="50" cy="50" r="47" fill="none" stroke={GOLD} strokeWidth="2" />
      <circle cx="50" cy="50" r="42" fill="none" stroke={GOLD} strokeWidth="2" />
    </>
  ),
  frame_mvp: (
    <>
      <circle cx="50" cy="50" r="45" fill="none" stroke={GOLD} strokeWidth="4" />
      <path d="M50 0l3.5 7 7.5 1-5.5 5 1.5 7.5L50 17l-7 3.5 1.5-7.5-5.5-5 7.5-1z" fill={GOLD} />
    </>
  ),
  frame_champion: (
    <>
      <circle cx="50" cy="52" r="44" fill="none" stroke={GOLD} strokeWidth="6" />
      <path d="M34 12l6-10 10 8 10-8 6 10z" fill={GOLD} />
    </>
  ),
  frame_pioneer: (
    <>
      <circle cx="50" cy="50" r="47" fill="none" stroke={CYAN} strokeWidth="2" />
      <circle cx="50" cy="50" r="42" fill="none" stroke={GOLD} strokeWidth="3" />
      {[0, 90, 180, 270].map((a) => <circle key={a} cx={50 + 47 * Math.cos((a * Math.PI) / 180)} cy={50 + 47 * Math.sin((a * Math.PI) / 180)} r="3" fill={CYAN} />)}
    </>
  ),
  frame_architect: (
    <>
      <circle cx="50" cy="50" r="45" fill="none" stroke={GOLD} strokeWidth="5" />
      <circle cx="50" cy="50" r="48.5" fill="none" stroke={CYAN} strokeWidth="1" opacity="0.8" />
      {[0, 90, 180, 270].map((a) => <rect key={a} x="46" y="-1" width="8" height="8" fill={GOLD} transform={`rotate(${a + 45} 50 50) rotate(45 50 3)`} />)}
    </>
  ),
};

export default function ProfileFrame({ itemId, size = 40, children }: { itemId?: string | null; size?: FrameSize; children?: ReactNode }) {
  const id = resolveFrame(itemId);
  const inset = Math.max(2, Math.round(size * 0.1));
  return (
    <span data-frame={id} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className="absolute overflow-hidden rounded-full bg-surface-2" style={{ inset }}>{children}</span>
      <svg aria-hidden viewBox="0 0 100 100" width={size} height={size} className="pointer-events-none absolute inset-0 overflow-visible">{ART[id]}</svg>
    </span>
  );
}
