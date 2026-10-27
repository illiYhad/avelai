import Link from "next/link";

// K-AV-UX2A: สถานะว่าง — กรอบเส้นประ + ข้อความไทย + ปุ่มไปต่อ (ลิงก์รับเป็น prop)
export default function EmptyState({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-white/20 px-6 py-10 text-center">
      <p className="text-base text-ink-muted">{message}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary flex min-h-11 items-center rounded px-4 text-sm">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
