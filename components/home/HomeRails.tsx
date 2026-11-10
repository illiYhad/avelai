import Link from "next/link";
import { routes } from "@/lib/routes";
import { tournamentTimeLabel } from "@/lib/home/time-label";
import type { HomeActivity, HomeTeam } from "@/lib/home/types";
import { defaultLocale, dict, localePath, type Locale } from "@/lib/i18n";

// K-AV-HOME.1: ราวซ้าย/ขวา (โครงจากภาพต้นแบบ 02/04) · กล่องว่างทุกกล่องมีปุ่มทำต่อ
// ปาร์ตี้/เพื่อน: ฐานข้อมูลยังไม่มีตาราง → "เร็ว ๆ นี้" + ปุ่ม disabled (ใบแม่ข้อ 5)

const circleBase = "flex h-12 w-12 items-center justify-center rounded-full border font-display font-black";
const circle = `${circleBase} text-xs tracking-wider`;

/** ราวซ้าย 72px (จอ ≥1280 เท่านั้น) */
// K-AV-I18N.0b: ข้อความจาก dict(locale).home.rails · ลิงก์ en ขึ้นต้น /en
export function LeftRail({ locale = defaultLocale }: { locale?: Locale }) {
  const t = dict(locale).home.rails;
  const d2 = localePath(locale, routes.tournaments("dota2"));
  return (
    <nav data-section="rail-left" aria-label={t.gamesAndLeagues} className="hidden w-[72px] shrink-0 xl:block">
      <ul className="sticky top-24 flex flex-col items-center gap-3">
        <li>
          <Link href={d2} title="Dota 2" aria-label="Dota 2" className={`${circle} border-gold/60 bg-panel text-gold hover:shadow-glow-gold`}>
            D2
          </Link>
        </li>
        <li>
          <span aria-disabled="true" title={dict(locale).home.games.soon} aria-label={t.mlbbSoon} className={`${circle} cursor-not-allowed border-white/15 bg-panel text-ink-muted opacity-50`}>
            ML
          </span>
        </li>
        <li aria-hidden className="h-px w-8 bg-line" />
        <li>
          {/* ลีกแรก ESTA (SYSTEM_CORE หมวด 4) · ใบ HOME.2 จะเปลี่ยนเป็นหน้าลีก */}
          <Link href={d2} title="ESTA" aria-label="ESTA" className={`${circle} border-cyan/50 bg-panel text-cyan hover:shadow-glow-cyan`}>
            ESTA
          </Link>
        </li>
        <li>
          <a href="#games" title={t.pickGame} aria-label={t.pickGame} className={`${circleBase} border-dashed border-white/25 text-xl text-ink-muted hover:border-cyan hover:text-cyan`}>
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

const Soon = ({ text }: { text: string }) => <span className="hud-chip hud-chip-gold">{text}</span>;

/** ราวขวา 280px (จอ ≥1024) · จอเล็กต่อท้ายเนื้อหา · เว้นล่าง 96px ให้ปุ่ม AVE มุมขวาล่าง */
export function RightRail({ activities, teams, now, locale = defaultLocale }: { activities: HomeActivity[]; teams: HomeTeam[]; now: number; locale?: Locale }) {
  const t = dict(locale).home.rails;
  const soon = <Soon text={dict(locale).home.games.soon} />;
  const lp = (p: string) => localePath(locale, p);
  return (
    <aside data-section="rail-right" aria-label={t.mine} className="w-full shrink-0 pb-24 lg:w-[280px]">
      <div className="hud-panel flex flex-col gap-5 rounded-xl p-5 lg:sticky lg:top-24">
        <Box id="activities" title={t.activities}>
          {activities.length === 0 ? (
            <Empty text={t.noActivities}>
              <Link href={lp(routes.tournaments("dota2"))} className="btn-ghost w-full rounded-md px-4">{t.findTournament}</Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {activities.map((a) => (
                <li key={a.id}>
                  <Link href={lp(routes.tournament(a.game, a.id))} className="block rounded-md px-2 py-1.5 hover:bg-white/5">
                    <p className="font-mono text-xs tracking-[0.15em] text-cyan">{tournamentTimeLabel(a.status, a.start_at, now, locale)}</p>
                    <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box id="party" title={t.party}>
          <Empty text={t.partyClosed}>
            {soon}
            <button type="button" disabled className="btn-ghost w-full rounded-md px-4">{t.createParty}</button>
          </Empty>
        </Box>

        <Box id="teams" title={t.myTeams}>
          {teams.length === 0 ? (
            <Empty text={t.noTeams}>
              <Link href={lp(routes.teamCreate("dota2"))} className="btn-ghost w-full rounded-md px-4">{t.createTeam}</Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {teams.map((tm) => (
                <li key={tm.id}>
                  <Link href={lp(routes.team("dota2", tm.id))} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
                    {tm.tag && <span className="font-mono text-xs text-gold">[{tm.tag}]</span>}
                    <span className="truncate text-sm font-semibold text-ink">{tm.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box id="friends" title={t.friends}>
          <Empty text={t.friendsClosed}>
            {soon}
            <button type="button" disabled className="btn-ghost w-full rounded-md px-4">{t.addFriend}</button>
          </Empty>
        </Box>
      </div>
    </aside>
  );
}
