import type { ReactNode } from "react";

// K-AV-POLISH เฟส 2: หัวข้อส่วนในหน้า (ใต้ PageHeader) — Orbitron 14px มีขีดฟ้าหน้า · ด้านขวาวางชิป/ปุ่มได้
export default function SectionTitle({
  title,
  aside,
  as: Tag = "h2",
  className = "",
}: {
  title: ReactNode;
  aside?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <Tag className="hud-section-title">{title}</Tag>
      {aside}
    </div>
  );
}
