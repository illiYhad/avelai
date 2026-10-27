// K-AV-UX2A Phase B: ตัวบอกขั้นตอน (แสดงผลอย่างเดียว · ขั้นปัจจุบันคำนวณจากข้อมูลที่หน้ามีอยู่แล้ว)
export default function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="ขั้นตอนการสมัคร">
      {labels.map((l, i) => (
        <li key={l} aria-current={i === current ? "step" : undefined} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm ${
              i < current ? "border-gold bg-gold text-void" : i === current ? "border-gold text-gold" : "border-line text-ink-muted"
            }`}
          >
            {i + 1}
          </span>
          <span className={`text-sm ${i === current ? "text-ink" : "text-ink-muted"}`}>{l}</span>
          {i < labels.length - 1 ? <span aria-hidden className="h-px flex-1 bg-line" /> : null}
        </li>
      ))}
    </ol>
  );
}
