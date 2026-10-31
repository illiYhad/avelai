// K-AV-UX2A: หัวหน้า 3 ชั้นแบบหน้า draft เดิม — ป้ายหมวด mono → ชื่อหนา display → บรรทัดรอง
// K-AV-UX3B: หัวข้อ HUD น้ำหนัก black แบบหัวหน้า Snake Draft
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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        {eyebrow ? (
          <span className="w-fit rounded border border-cyan/30 bg-cyan/5 px-2 py-0.5 font-mono text-xs tracking-[0.2em] text-cyan">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-display text-2xl font-black tracking-wide text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-base text-ink-muted">{subtitle}</p> : null}
      </div>
      {aside}
    </header>
  );
}
