// K-AV-UX2A: การ์ดกลางแบบหน้า draft/login เดิม — ขอบ 1px · เรืองแสงทอง (ของเรา/เลือกอยู่) หรือฟ้า (ข้อมูล/ลิงก์)
// dashed = ช่องว่างเส้นประแบบ MEMBER SLOT
// K-AV-UX3B: การ์ดเรืองแสงได้วงเล็บมุม + พื้น panel แบบการ์ดหน้า Snake Draft
type Glow = "gold" | "cyan" | "none";

const GLOW: Record<Glow, string> = {
  gold: "ci-corners border-gold/50 bg-panel shadow-glow-gold [--corner:var(--color-gold)]",
  cyan: "ci-corners border-cyan/40 bg-panel shadow-glow-cyan [--corner:var(--color-cyan)]",
  none: "bg-surface-2 border-line",
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
  const edge = dashed ? "border-dashed border-white/20 bg-transparent" : GLOW[glow];
  return <Tag className={`relative rounded-xl border p-4 sm:p-6 ${edge} ${className}`}>{children}</Tag>;
}
