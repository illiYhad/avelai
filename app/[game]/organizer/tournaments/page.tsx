import Link from "next/link";
import { requireUser } from "@/lib/auth/roles";
import { gameLabel, gameFromSlug, slugOf, type GameSlug } from "@/lib/games";
import { platformRoles } from "@/lib/tournament/access";
import { STATUS_LABEL, type TournamentStatus } from "@/lib/tournament/state";
import { routes } from "@/lib/routes";
import { notFound } from "next/navigation";

// K-AV-3: ทัวร์ของฉัน (ผู้จัด) + ทัวร์ที่เป็น staff
export const metadata = { title: "ผู้จัด — AVELAi" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; game: string; status: string; start_at: string | null };

function List({ rows, slug }: { rows: Row[]; slug: GameSlug }) {
  return (
    <ul className="divide-y divide-white/10 rounded border border-white/15">
      {rows.map((t) => (
        <li key={t.id} className="px-4 py-3 text-sm">
          <Link href={routes.organizerTournament(slug, t.id)} className="font-semibold text-white hover:underline">{t.name}</Link>
          <span className="ml-2 text-xs text-white/60">{gameLabel(t.game)} · <span className="text-cyan">{STATUS_LABEL[t.status as TournamentStatus] ?? t.status}</span></span>
        </li>
      ))}
    </ul>
  );
}

export default async function OrganizerTournamentsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const { db, user } = await requireUser(routes.organizerTournaments(slug));
  const roles = await platformRoles(db, user.id);
  const [{ data: mine }, { data: staffRows }] = await Promise.all([
    db.from("tournaments").select("id, name, game, status, start_at").eq("game", code).eq("organizer_id", user.id).order("created_at", { ascending: false }),
    db.from("tournament_staff").select("role, tournaments!inner(id, name, game, status, start_at)").eq("tournaments.game", code).eq("user_id", user.id),
  ]);
  const staffed = (staffRows ?? []).map((s) => ({ role: s.role as string, t: (Array.isArray(s.tournaments) ? s.tournaments[0] : s.tournaments) as Row | null })).filter((x) => x.t);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-gold">ผู้จัดการแข่งขัน</h1>
        {roles.includes("ORGANIZER") || roles.includes("ADMIN") ? <Link href={routes.organizerTournamentNew(slug)} className="rounded btn-primary px-3 py-1.5 text-sm">+ สร้างทัวร์</Link> : null}
      </div>
      <section><h2 className="mb-2 text-sm font-semibold text-white/90">ทัวร์ที่ฉันจัด</h2>{(mine ?? []).length ? <List rows={(mine ?? []) as Row[]} slug={slug} /> : <p className="text-sm text-white/60">ยังไม่มี</p>}</section>
      {staffed.length ? <section><h2 className="mb-2 text-sm font-semibold text-white/90">ทัวร์ที่ฉันเป็น staff</h2><List rows={staffed.map((x) => x.t as Row)} slug={slug} /></section> : null}
    </main>
  );
}
