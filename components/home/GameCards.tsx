import Link from "next/link";
import GameTag from "@/components/ui/GameTag";
import { routes } from "@/lib/routes";

// K-AV-HOME.1: "เลือกเกม" (โครงจากภาพต้นแบบ 04 แถว Browse games)
// ไม่มีอาร์ตเกมในเครื่อง → แผง HUD + ชื่อเกม Orbitron · Dota 2 กดได้ · MLBB "เร็ว ๆ นี้" (SYSTEM_CORE หมวด 4 · ซอง 012)
export default function GameCards() {
  return (
    <section id="games" data-section="games" aria-labelledby="home-games-title" className="flex flex-col gap-4 scroll-mt-24">
      <h2 id="home-games-title" className="hud-title text-xl text-ink sm:text-2xl">เลือกเกม</h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <li>
          <Link
            href={routes.tournaments("dota2")}
            data-game="dota2"
            className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-cyan"
          >
            <div className="hud-panel hud-panel-gold ci-corners relative flex aspect-[3/4] flex-col justify-between rounded-xl p-4 transition-shadow group-hover:shadow-glow-gold">
              <GameTag game="dota2" />
              <p className="font-display text-3xl font-black leading-none tracking-[0.08em] text-ink sm:text-4xl">
                DOTA<br /><span className="text-gold">2</span>
              </p>
            </div>
            <p className="mt-2 font-semibold text-ink">Dota 2</p>
          </Link>
        </li>
        <li>
          <div data-game="mlbb" aria-disabled="true" title="เร็ว ๆ นี้" className="cursor-not-allowed opacity-60">
            <div className="hud-panel relative flex aspect-[3/4] flex-col justify-between rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <GameTag game="mlbb" />
                <span className="hud-chip hud-chip-gold">เร็ว ๆ นี้</span>
              </div>
              <p className="font-display text-3xl font-black leading-none tracking-[0.08em] text-ink-muted sm:text-4xl">MLBB</p>
            </div>
            <p className="mt-2 font-semibold text-ink-muted">Mobile Legends</p>
          </div>
        </li>
      </ul>
    </section>
  );
}
