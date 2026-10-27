// K-AV-UX2A: ตัวเลขใหญ่ (Orbitron · tabular-nums) + ป้ายเล็ก
export default function Stat({ label, value, tone = "ink" }: { label: string; value: React.ReactNode; tone?: "ink" | "gold" | "cyan" }) {
  const color = tone === "gold" ? "text-gold" : tone === "cyan" ? "text-cyan" : "text-ink";
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs tracking-[0.2em] text-ink-muted">{label}</span>
      <span className={`font-sans text-2xl font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
