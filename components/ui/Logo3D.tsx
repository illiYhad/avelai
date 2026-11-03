// K-AV-UX4: โลโก้ AVELAi 3D หมุนช้า ๆ — CSS ล้วน (ไม่มี JS เพิ่ม) · ชั้นหลัง 6 ชั้นให้ความหนา · หยุดหมุนเมื่อ prefers-reduced-motion
const DEPTH = [6, 5, 4, 3, 2, 1];

export default function Logo3D({ size = "text-4xl sm:text-5xl" }: { size?: string }) {
  return (
    <div className="logo-3d flex justify-center" role="img" aria-label="AVELAi">
      <span aria-hidden className={`logo-3d-spin font-display font-black tracking-[0.12em] ${size}`}>
        {DEPTH.map((d) => (
          <span key={d} className="logo-3d-layer" style={{ transform: `translateZ(-${d * 1.5}px)` }}>
            AVEL<span>Ai</span>
          </span>
        ))}
        <span className="logo-3d-face relative text-ink">
          AVEL<span className="text-gold">Ai</span>
        </span>
      </span>
    </div>
  );
}
