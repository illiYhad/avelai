// K-AV-UX2A: การ์ดกลางแบบหน้า draft/login เดิม — ขอบ 1px · เรืองแสงทอง (ของเรา/เลือกอยู่) หรือฟ้า (ข้อมูล/ลิงก์)
// dashed = ช่องว่างเส้นประแบบ MEMBER SLOT
// K-AV-UX3B: การ์ดเรืองแสงได้วงเล็บมุม + พื้น panel แบบการ์ดหน้า Snake Draft
type Glow = "gold" | "cyan" | "none";

// K-AV-UX4: ทุกแบบเป็นพาเนล HUD (พื้น panel + เส้นแสงบน + เงาลึก) · none = ไม่มีวงเล็บมุม
const GLOW: Record<Glow, string> = {
  gold: "hud-panel hud-panel-gold ci-corners",
  cyan: "hud-panel ci-corners border-cyan/40 shadow-glow-cyan",
  none: "hud-panel",
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
  const edge = dashed ? "border border-dashed border-white/20 bg-transparent" : GLOW[glow];
  return <Tag className={`relative rounded-xl p-4 sm:p-6 ${edge} ${className}`}>{children}</Tag>;
}
