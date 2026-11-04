import type { ReactNode } from "react";

// K-AV-POLISH เฟส 2: ตาราง HUD กลาง — เลื่อนซ้ายขวาในกรอบตัวเอง (ไม่ดันหน้าล้นที่ 390)
// ใส่ <thead>/<tbody> ปกติเป็นลูก · สไตล์ th/td มาจาก .hud-table ใน globals.css · ตัวเลขใส่ className="font-numeric" ที่เซลล์
export default function HudTable({
  caption,
  className = "",
  children,
}: {
  caption?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`hud-table-wrap ${className}`}>
      <table className="hud-table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}
