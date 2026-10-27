// K-AV-UX2A: ป้ายสถานะเดียวทั้งเว็บ — พื้นโปร่ง 15% + ตัวพาสเทล · ข้อความไทยเสมอ
export const STATUS_BADGES = {
  OPEN: { label: "เปิดรับสมัคร", tone: "bg-emerald-400/15 text-emerald-200" },
  SCHEDULED: { label: "กำหนดการแล้ว", tone: "bg-sky-400/15 text-sky-200" },
  LIVE: { label: "กำลังแข่ง", tone: "bg-rose-400/15 text-rose-200" },
  COMPLETED: { label: "จบแล้ว", tone: "bg-white/10 text-ink-muted" },
  PENDING_PAYMENT: { label: "รอตรวจสลิป", tone: "bg-amber-400/15 text-amber-200" },
  READY_CHECK: { label: "รอยืนยันพร้อม", tone: "bg-cyan/15 text-cyan" },
  AWAITING_RESULT: { label: "รอผลแข่ง", tone: "bg-violet-400/15 text-violet-200" },
  DISPUTED: { label: "มีข้อโต้แย้ง", tone: "bg-orange-400/15 text-orange-200" },
  LOCKED: { label: "ล็อกแล้ว", tone: "bg-gold/15 text-gold" },
  CANCELLED: { label: "ยกเลิกแล้ว", tone: "bg-red-400/15 text-red-200" },
} as const;

export type BadgeStatus = keyof typeof STATUS_BADGES;

export default function StatusBadge({ status }: { status: BadgeStatus }) {
  const b = STATUS_BADGES[status];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${b.tone}`}>
      {b.label}
    </span>
  );
}
