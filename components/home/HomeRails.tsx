import Link from "next/link";
import { routes } from "@/lib/routes";
import { tournamentTimeLabel } from "@/lib/home/time-label";
import type { HomeActivity, HomeTeam } from "@/lib/home/types";

// K-AV-HOME.1: ราวซ้าย/ขวา (โครงจากภาพต้นแบบ 02/04) · กล่องว่างทุกกล่องมีปุ่มทำต่อ
// ปาร์ตี้/เพื่อน: ฐานข้อมูลยังไม่มีตาราง → "เร็ว ๆ นี้" + ปุ่ม disabled (ใบแม่ข้อ 5)

const circleBase = "flex h-12 w-12 items-center justify-center rounded-full border font-display font-black";
const circle = `${circleBase} text-xs tracking-wider`;

/** ราวซ้าย 72px (จอ ≥1280 เท่านั้น) */
export function LeftRail() {
  return (
    <nav data-section="rail-left" aria-label="เกมและลีก" className="hidden w-[72px] shrink-0 xl:block">
      <ul className="sticky top-24 flex flex-col items-center gap-3">
        <li>
          <Link href={routes.tournaments("dota2")} title="Dota 2" aria-label="Dota 2" className={`${circle} border-gold/60 bg-panel text-gold hover:shadow-glow-gold`}>
            D2
          </Link>
        </li>
        <li>
          <span aria-disabled="true" title="เร็ว ๆ นี้" aria-label="MLBB (เร็ว ๆ นี้)" className={`${circle} cursor-not-allowed border-white/15 bg-panel text-ink-muted opacity-50`}>
            ML
          </span>
        </li>
        <li aria-hidden className="h-px w-8 bg-line" />
        <li>
          {/* ลีกแรก ESTA (SYSTEM_CORE หมวด 4) · ใบ HOME.2 จะเปลี่ยนเป็นหน้าลีก */}
          <Link href={routes.tournaments("dota2")} title="ESTA" aria-label="ESTA" className={`${circle} border-cyan/50 bg-panel text-cyan hover:shadow-glow-cyan`}>
            ESTA
          </Link>
        </li>
        <li>
          <a href="#games" title="เลือกเกม" aria-label="เลือกเกม" className={`${circleBase} border-dashed border-white/25 text-xl text-ink-muted hover:border-cyan hover:text-cyan`}>
            +
          </a>
        </li>
      </ul>
    </nav>
  );
}

function Box({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section data-box={id} className="flex flex-col gap-3 border-b border-line pb-5 last:border-b-0">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div data-empty className="flex flex-col items-center gap-3 py-2 text-center">
      <p className="text-sm text-ink-muted">{text}</p>
      {children}
    </div>
  );
}

const soon = <span className="hud-chip hud-chip-gold">เร็ว ๆ นี้</span>;

/** ราวขวา 280px (จอ ≥1024) · จอเล็กต่อท้ายเนื้อหา · เว้นล่าง 96px ให้ปุ่ม AVE มุมขวาล่าง */
export function RightRail({ activities, teams, now }: { activities: HomeActivity[]; teams: HomeTeam[]; now: number }) {
  return (
    <aside data-section="rail-right" aria-label="ของฉัน" className="w-full shrink-0 pb-24 lg:w-[280px]">
      <div className="hud-panel flex flex-col gap-5 rounded-xl p-5 lg:sticky lg:top-24">
        <Box id="activities" title="กิจกรรมของฉัน">
          {activities.length === 0 ? (
            <Empty text="ยังไม่มีกิจกรรม">
              <Link href={routes.tournaments("dota2")} className="btn-ghost w-full rounded-md px-4">หาทัวร์</Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {activities.map((a) => (
                <li key={a.id}>
                  <Link href={routes.tournament(a.game, a.id)} className="block rounded-md px-2 py-1.5 hover:bg-white/5">
                    <p className="font-mono text-xs tracking-[0.15em] text-cyan">{tournamentTimeLabel(a.status, a.start_at, now)}</p>
                    <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box id="party" title="ปาร์ตี้">
          <Empty text="ยังไม่เปิดระบบปาร์ตี้">
            {soon}
            <button type="button" disabled className="btn-ghost w-full rounded-md px-4">สร้างปาร์ตี้</button>
          </Empty>
        </Box>

        <Box id="teams" title="ทีมของฉัน">
          {teams.length === 0 ? (
            <Empty text="ยังไม่มีทีม">
              <Link href={routes.teamCreate("dota2")} className="btn-ghost w-full rounded-md px-4">สร้างทีม</Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {teams.map((t) => (
                <li key={t.id}>
                  <Link href={routes.team("dota2", t.id)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
                    {t.tag && <span className="font-mono text-xs text-gold">[{t.tag}]</span>}
                    <span className="truncate text-sm font-semibold text-ink">{t.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box id="friends" title="เพื่อน">
          <Empty text="ยังไม่เปิดระบบเพื่อน">
            {soon}
            <button type="button" disabled className="btn-ghost w-full rounded-md px-4">เพิ่มเพื่อน</button>
          </Empty>
        </Box>
      </div>
    </aside>
  );
}
