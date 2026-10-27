// K-AV-UX2A: การ์ดกลางแบบหน้า draft/login เดิม — ขอบ 1px · เรืองแสงทอง (ของเรา/เลือกอยู่) หรือฟ้า (ข้อมูล/ลิงก์)
// dashed = ช่องว่างเส้นประแบบ MEMBER SLOT
type Glow = "gold" | "cyan" | "none";

const GLOW: Record<Glow, string> = {
  gold: "border-gold/40 shadow-[0_0_15px_color-mix(in_srgb,var(--color-gold)_30%,transparent)]",
  cyan: "border-cyan/30 shadow-[0_0_15px_color-mix(in_srgb,var(--color-cyan)_25%,transparent)]",
  none: "border-line",
};

export default function Surface({
  glow = "none",
  dashed = false,
  as: Tag = "div",
  className = "",
  children,
}: {
  glow?: Glow;
  dashed?: boolean;
  as?: "div" | "section" | "article" | "li";
  className?: string;
  children: React.ReactNode;
}) {
  const edge = dashed ? "border-dashed border-white/20 bg-transparent" : `bg-surface-2 ${GLOW[glow]}`;
  return <Tag className={`relative rounded-lg border p-4 sm:p-6 ${edge} ${className}`}>{children}</Tag>;
}
