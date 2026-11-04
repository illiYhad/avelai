import type { ReactNode } from "react";

// K-AV-POLISH.2 เฟส 4: ชุดภาพกลางของ AVELAi — SVG/CSS ของเราเองทั้งหมด (ไม่มีภาพฮีโร่ โลโก้เกม หรือไฟล์จากเว็บนอก)
// ทุกชิ้นเป็น aria-hidden · pointer-events-none · วางซ้อนในกล่อง `relative overflow-hidden`
// การเคลื่อนไหวมีแค่แสงสแกน (.hud-scanline) ซึ่งปิดเมื่อ prefers-reduced-motion อยู่แล้วใน globals.css

export type ArtGame = "mlbb" | "dota2" | "none";
const ID = { mlbb: "av-pat-mlbb", dota2: "av-pat-dota2" } as const;

/** ลายประจำเกม — MLBB = ผลึกหกเหลี่ยม · Dota 2 = วงรูนสามเลน (นามธรรม ไม่ลอกของใคร) */
export function GamePattern({ game, className = "" }: { game: ArtGame; className?: string }) {
  if (game === "none") return null;
  const id = ID[game];
  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        {game === "mlbb" ? (
          <pattern id={id} width="56" height="64" patternUnits="userSpaceOnUse">
            <path d="M28 2 52 16v32L28 62 4 48V16Z" fill="none" stroke="var(--color-cyan)" strokeOpacity="0.18" />
            <path d="M28 14 40 21v14l-12 7-12-7V21Z" fill="var(--color-cyan)" fillOpacity="0.05" stroke="var(--color-gold)" strokeOpacity="0.12" />
            <circle cx="28" cy="32" r="1.5" fill="var(--color-gold)" fillOpacity="0.35" />
          </pattern>
        ) : (
          <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-gold)" strokeOpacity="0.14" strokeDasharray="6 10" />
            <circle cx="36" cy="36" r="14" fill="none" stroke="var(--color-cyan)" strokeOpacity="0.16" />
            <path d="M8 64 64 8M8 36h56M36 8v56" stroke="var(--color-cyan)" strokeOpacity="0.07" />
            <path d="M36 22 48 36 36 50 24 36Z" fill="var(--color-gold)" fillOpacity="0.06" />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** พื้นฮีโร่: แสงทอง/ฟ้า + เส้นกริด + ลายเกม + แสงสแกน — วางเป็นลูกแรกของกล่อง relative overflow-hidden */
export function HeroBackdrop({ game = "none", scan = true }: { game?: ArtGame; scan?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div className="art-hero-glow absolute inset-0" />
      <div className="art-grid absolute inset-0" />
      <GamePattern game={game} className="opacity-70" />
      <div className="art-hero-fade absolute inset-0" />
      {scan ? <span className="hud-scanline" /> : null}
    </div>
  );
}

/** กรอบมุม HUD 4 มุม + ขีดสเกลบน — ซ้อนบนการ์ด/หัวหน้าที่เป็น relative (ไม่กินพื้นที่) */
export function HudFrame({ tone = "cyan", ticks = true }: { tone?: "cyan" | "gold"; ticks?: boolean }) {
  const c = tone === "gold" ? "text-gold" : "text-cyan";
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${c}`}>
      <span className="art-corner absolute left-0 top-0" />
      <span className="art-corner absolute right-0 top-0 rotate-90" />
      <span className="art-corner absolute bottom-0 right-0 rotate-180" />
      <span className="art-corner absolute bottom-0 left-0 -rotate-90" />
      {ticks ? <span className="art-ticks absolute left-6 top-0" /> : null}
    </span>
  );
}

/** ภาพว่างเมื่อไม่มีข้อมูล: จานเรดาร์กวาดไม่เจอสัญญาณ */
export function EmptyArt({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 96 96" className={className}>
      <circle cx="48" cy="48" r="42" fill="none" stroke="var(--color-cyan)" strokeOpacity="0.25" strokeDasharray="4 6" />
      <circle cx="48" cy="48" r="28" fill="none" stroke="var(--color-cyan)" strokeOpacity="0.35" />
      <circle cx="48" cy="48" r="14" fill="var(--color-cyan)" fillOpacity="0.06" stroke="var(--color-cyan)" strokeOpacity="0.45" />
      <path d="M48 6v84M6 48h84" stroke="var(--color-cyan)" strokeOpacity="0.15" />
      <path d="M48 48 84 30A40 40 0 0 0 48 8Z" fill="var(--color-cyan)" fillOpacity="0.12" />
      <circle cx="48" cy="48" r="3" fill="var(--color-gold)" />
      <path d="M30 66l36-36" stroke="var(--color-gold)" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** เฟรมโลโก้/รูปทีม: มุมตัด HUD + ขอบฟ้าหรือทอง · ลูกคือ <img> หรือตัวอักษรย่อ */
export function AvatarFrame({
  tone = "cyan",
  size = "h-14 w-14",
  className = "",
  children,
}: {
  tone?: "cyan" | "gold";
  size?: string;
  className?: string;
  children: ReactNode;
}) {
  const edge = tone === "gold" ? "border-gold/60 shadow-glow-gold" : "border-cyan/50 shadow-glow-cyan";
  return (
    <span className={`art-avatar relative inline-flex shrink-0 items-center justify-center overflow-hidden border bg-surface-2 ${edge} ${size} ${className}`}>
      <span aria-hidden className="art-avatar-tick absolute left-0 top-0" />
      <span aria-hidden className="art-avatar-tick absolute bottom-0 right-0 rotate-180" />
      {children}
    </span>
  );
}
