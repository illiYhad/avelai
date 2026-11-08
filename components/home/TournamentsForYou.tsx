import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { tournamentBadge } from "@/lib/tournament/badge";
import { routes } from "@/lib/routes";
import { tournamentTimeLabel } from "@/lib/home/time-label";
import type { HomeTournament } from "@/lib/home/types";

// K-AV-HOME.1: "ทัวร์นาเมนต์สำหรับคุณ" (โครงจากภาพต้นแบบ 04) · ข้อมูลจริงจากตาราง tournaments (อ่านอย่างเดียว)
// ไม่มีรูปทัวร์ในตาราง → แถบบนเป็นพื้นไล่สีกรมท่า + รูปแบบตัวใหญ่
export default function TournamentsForYou({ items, now }: { items: HomeTournament[]; now: number }) {
  return (
    <section data-section="for-you" aria-labelledby="home-foryou-title" className="flex flex-col gap-4">
      <h2 id="home-foryou-title" className="hud-title text-xl text-ink sm:text-2xl">ทัวร์นาเมนต์สำหรับคุณ</h2>
      {items.length === 0 ? (
        <div data-empty="for-you" className="hud-panel flex flex-col items-start gap-3 rounded-xl p-6">
          <p className="text-ink-muted">ยังไม่มีทัวร์ที่เปิดรับ</p>
          <Link href={routes.tournaments("dota2")} className="btn-ghost rounded-md px-4">ดูทัวร์ทั้งหมด</Link>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <li key={t.id}>
                <Link
                  href={routes.tournament("dota2", t.id)}
                  data-tournament={t.id}
                  className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-cyan"
                >
                  <div className="hud-panel overflow-hidden rounded-xl transition-colors group-hover:border-cyan/50">
                    <div aria-hidden className="flex h-28 items-center justify-center bg-gradient-to-br from-cyan-deep/40 via-panel to-void">
                      <span className="font-display text-2xl font-black tracking-[0.12em] text-ink/80">{t.format} BO{t.best_of}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-4">
                      <p className="font-mono text-xs tracking-[0.15em] text-cyan">{tournamentTimeLabel(t.status, t.start_at, now)}</p>
                      <h3 className="truncate font-bold text-ink">{t.name}</h3>
                      <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
                        <span>
                          {t.team_size}v{t.team_size} · {t.max_teams ?? "–"} ช่อง
                          <span className="font-mono tabular-nums"> · ยืนยัน {t.confirmed} ทีม</span>
                        </span>
                        <StatusBadge status={tournamentBadge(t.status)} />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex justify-center border-t border-line pt-4">
            <Link href={routes.tournaments("dota2")} className="btn-ghost rounded-md px-6">ดูเพิ่ม</Link>
          </div>
        </>
      )}
    </section>
  );
}
