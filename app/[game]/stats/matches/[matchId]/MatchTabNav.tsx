"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// K-AV-D3: แถบแท็บ 11 ตัว — เลื่อนแนวนอนได้ที่จอแคบ ปุ่มสูงอย่างน้อย 44px
export default function MatchTabNav({
  matchId,
  tabs,
}: {
  matchId: string;
  tabs: readonly { slug: string; label: string; ready: boolean; href: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={`แท็บของแมตช์ ${matchId}`} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max min-w-full gap-2 border-b border-line pb-2">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.slug || "overview"}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap rounded-lg border px-3 font-mono text-xs tracking-wider transition-colors sm:text-sm ${
                  active
                    ? "border-gold bg-gold/10 text-gold"
                    : t.ready
                      ? "border-line text-ink hover:border-cyan/50 hover:text-cyan"
                      : "border-line/60 text-ink-muted hover:border-line"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
