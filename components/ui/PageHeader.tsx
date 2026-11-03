// K-AV-UX2A: หัวหน้า 3 ชั้นแบบหน้า draft เดิม — ป้ายหมวด mono → ชื่อหนา display → บรรทัดรอง
// K-AV-UX3B: หัวข้อ HUD น้ำหนัก black แบบหัวหน้า Snake Draft
// K-AV-UX4: ชิป HUD มีจุดสถานะ · หัวเรื่องเรืองแสง · เส้นใต้หัวแบบหน้า Snake Draft
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="flex flex-col gap-2">
        {eyebrow ? (
          <span className="hud-chip">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
            {eyebrow}
          </span>
        ) : null}
        <h1 className="hud-title text-2xl text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-base text-ink-muted">{subtitle}</p> : null}
      </div>
      {aside}
    </header>
  );
}
