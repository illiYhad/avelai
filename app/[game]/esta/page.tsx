import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { gameFromSlug, gameLabel, slugOf } from "@/lib/games";
import { routes } from "@/lib/routes";
import { dict, localePath } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { fill } from "@/lib/home/time-label";
import { tournamentBadge } from "@/lib/tournament/badge";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import GameTag from "@/components/ui/GameTag";
import EstaIntro from "@/components/esta/EstaIntro";

// K-AV-HOME.2: หน้าลีก ESTA แนว Space (ภาพต้นแบบ 03) · สาธารณะ · EN = /en/{game}/esta (middleware rewrite)
// เส้น /{game}/esta: ลีกผูกเกม (ESTA Phase 1 = Dota 2) เหมือนหน้าระบบอื่นใต้ /[game]/
// ข้อมูลทัวร์: ตาราง tournaments อ่านอย่างเดียว คอลัมน์/เงื่อนไขเดียวกับ app/[game]/tournaments/page.tsx
// ไม่อ่าน/เขียนตารางสมาชิกของผู้จัด · ปุ่ม Join disabled (อลิส) · ตารางอันดับยังไม่มีข้อมูล = สถานะว่าง
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: dict(await getLocale()).esta.metaTitle };
}

type Row = { id: string; name: string; format: string; best_of: number; max_teams: number | null; status: string; start_at: string | null; team_size: number };

export default async function EstaPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const locale = await getLocale();
  const t = dict(locale).esta;
  const lp = (p: string) => localePath(locale, p);

  const db = await getServerDb();
  let rows: Row[] = [];
  const counts = new Map<string, number>();
  if (db) {
    const { data } = await db.from("tournaments").select("id, name, format, best_of, max_teams, status, start_at, team_size").eq("game", code).neq("status", "DRAFT").order("start_at", { ascending: true, nullsFirst: false }).limit(20);
    rows = (data ?? []) as Row[];
    if (rows.length) {
      const { data: regs } = await db.from("registrations").select("tournament_id").in("tournament_id", rows.map((r) => r.id)).in("status", ["CONFIRMED", "CHECKED_IN"]);
      for (const r of (regs ?? []) as { tournament_id: string }[]) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);
    }
  }

  const dateFmt = locale === "en" ? "en-GB" : "th-TH";
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <EstaIntro locale={locale} />
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <GameTag game={slug} />
            <span className="hud-chip hud-chip-gold">{t.joinSoon}</span>
            <button type="button" disabled aria-disabled="true" data-esta-join className="btn-primary min-h-11 cursor-not-allowed rounded-md px-6 opacity-50">
              {t.join}
            </button>
          </div>
        }
      />
      <Link href={lp(routes.rules(slug))} className="self-start text-sm text-cyan underline">{t.rules}</Link>

      <section aria-labelledby="esta-tournaments" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="esta-tournaments" className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">{t.tournaments}</h2>
          <Link href={lp(routes.tournaments(slug))} className="text-sm text-cyan underline">{t.seeAll}</Link>
        </div>
        {!db ? <p className="text-base text-ink-muted">{t.noDb}</p> : rows.length === 0 ? (
          <EmptyState message={fill(t.noTournaments, { game: gameLabel(code) })} actionLabel={t.seeAll} actionHref={lp(routes.tournaments(slug))} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={lp(routes.tournament(slug, r.id))} data-tournament={r.id} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-cyan">
                  <Surface glow={r.status === "REGISTRATION" ? "gold" : "none"} className="transition-colors hover:border-cyan/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs tracking-[0.2em] text-cyan">{r.format} BO{r.best_of} · {r.team_size}v{r.team_size}</p>
                        <h3 className="mt-1 truncate text-lg font-bold text-ink">{r.name}</h3>
                      </div>
                      <StatusBadge status={tournamentBadge(r.status)} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
                      <span>{r.start_at ? new Date(r.start_at).toLocaleString(dateFmt, { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : t.tbd}</span>
                      <span className="font-mono tabular-nums text-ink">{fill(t.teams, { n: counts.get(r.id) ?? 0, max: r.max_teams ?? "–" })}</span>
                    </div>
                  </Surface>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="esta-standings" className="flex flex-col gap-3">
        <h2 id="esta-standings" className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">{t.standings}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {([["daily", t.daily, t.dailyNote], ["weekend", t.weekend, t.weekendNote]] as const).map(([id, title, note]) => (
            <div key={id} data-standings={id}>
              <Surface>
                <h3 className="hud-title text-lg text-ink">{title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{note}</p>
                <div className="mt-4">
                  <EmptyState message={t.noStandings} actionLabel={t.findTournament} actionHref={lp(routes.tournaments(slug))} />
                </div>
              </Surface>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
