// K-AV-UX4: แสงสแกนวิ่งช้า ๆ ในพาเนลฮีโร่ — แยกชั้นตัดขอบเอง จึงไม่ตัดวงเล็บมุม (ci-corners) ของพาเนล
export default function HudScan() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <span className="hud-scanline" />
    </div>
  );
}
