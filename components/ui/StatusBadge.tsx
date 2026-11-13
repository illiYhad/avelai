import { defaultLocale, dict, type Locale } from "@/lib/i18n";
import { th } from "@/lib/i18n/th";

// K-AV-UX2A: ป้ายสถานะเดียวทั้งเว็บ — พื้นโปร่ง 15% + ตัวพาสเทล
// K-AV-I18N.0d: ข้อความมาจากพจนานุกรม status (th = ข้อความเดิมตรงตัว) · ไม่ส่ง locale = ไทยเหมือนเดิม
export const STATUS_BADGES = {
  OPEN: { label: th.status.OPEN, tone: "bg-emerald-400/15 text-emerald-200" },
  SCHEDULED: { label: th.status.SCHEDULED, tone: "bg-sky-400/15 text-sky-200" },
  LIVE: { label: th.status.LIVE, tone: "bg-rose-400/15 text-rose-200" },
  COMPLETED: { label: th.status.COMPLETED, tone: "bg-white/10 text-ink-muted" },
  PENDING_PAYMENT: { label: th.status.PENDING_PAYMENT, tone: "bg-amber-400/15 text-amber-200" },
  READY_CHECK: { label: th.status.READY_CHECK, tone: "bg-cyan/15 text-cyan" },
  AWAITING_RESULT: { label: th.status.AWAITING_RESULT, tone: "bg-violet-400/15 text-violet-200" },
  DISPUTED: { label: th.status.DISPUTED, tone: "bg-orange-400/15 text-orange-200" },
  LOCKED: { label: th.status.LOCKED, tone: "bg-gold/15 text-gold" },
  CANCELLED: { label: th.status.CANCELLED, tone: "bg-red-400/15 text-red-200" },
} as const;

export type BadgeStatus = keyof typeof STATUS_BADGES;

export default function StatusBadge({ status, locale = defaultLocale }: { status: BadgeStatus; locale?: Locale }) {
  const b = STATUS_BADGES[status];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${b.tone}`}>
      {dict(locale).status[status]}
    </span>
  );
}
