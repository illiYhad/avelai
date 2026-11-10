import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { tournamentBadge } from "@/lib/tournament/badge";
import { routes } from "@/lib/routes";
import { tournamentTimeLabel } from "@/lib/home/time-label";
import type { HomeTournament } from "@/lib/home/types";
import { defaultLocale, dict, localePath, type Locale } from "@/lib/i18n";
import { fill } from "@/lib/home/time-label";

// K-AV-HOME.1: "ทัวร์นาเมนต์สำหรับคุณ" (โครงจากภาพต้นแบบ 04) · ข้อมูลจริงจากตาราง tournaments (อ่านอย่างเดียว)
// ไม่มีรูปทัวร์ในตาราง → แถบบนเป็นพื้นไล่สีกรมท่า + รูปแบบตัวใหญ่
// K-AV-I18N.0b: ข้อความจาก dict(locale).home.forYou · ชื่อทัวร์มาจากฐาน ไม่แปล · ป้ายสถานะ (components/ui/StatusBadge) นอกขอบเขต 0b
export default function TournamentsForYou({ items, now, locale = defaultLocale }: { items: HomeTournament[]; now: number; locale?: Locale }) {
  const t = dict(locale).home.forYou;
  const all = localePath(locale, routes.tournaments("dota2"));
  return (
    <section data-section="for-you" aria-labelledby="home-foryou-title" className="flex flex-col gap-4">
      <h2 id="home-foryou-title" className="hud-title text-xl text-ink sm:text-2xl">{t.title}</h2>
      {items.length === 0 ? (
        <div data-empty="for-you" className="hud-panel flex flex-col items-start gap-3 rounded-xl p-6">
          <p className="text-ink-muted">{t.empty}</p>
          <Link href={all} className="btn-ghost rounded-md px-4">{t.seeAll}</Link>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((x) => (
              <li key={x.id}>
                <Link
                  href={localePath(locale, routes.tournament("dota2", x.id))}
                  data-tournament={x.id}
                  className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-cyan"
                >
                  <div className="hud-panel overflow-hidden rounded-xl transition-colors group-hover:border-cyan/50">
                    <div aria-hidden className="flex h-28 items-center justify-center bg-gradient-to-br from-cyan-deep/40 via-panel to-void">
                      <span className="font-display text-2xl font-black tracking-[0.12em] text-ink/80">{x.format} BO{x.best_of}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-4">
                      <p className="font-mono text-xs tracking-[0.15em] text-cyan">{tournamentTimeLabel(x.status, x.start_at, now, locale)}</p>
                      <h3 className="truncate font-bold text-ink">{x.name}</h3>
                      <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
                        <span>
                          {x.team_size}v{x.team_size} · {fill(t.slots, { n: x.max_teams ?? "–" })}
                        </span>
                        <StatusBadge status={tournamentBadge(x.status)} />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex justify-center border-t border-line pt-4">
            <Link href={all} className="btn-ghost rounded-md px-6">{t.more}</Link>
          </div>
        </>
      )}
    </section>
  );
}
