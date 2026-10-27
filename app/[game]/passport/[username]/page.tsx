import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { winRate } from "@/lib/elo/elo";
import { routes } from "@/lib/routes";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import Stat from "@/components/ui/Stat";
import GameTag from "@/components/ui/GameTag";
import EmptyState from "@/components/ui/EmptyState";
import { gameFromSlug, slugOf } from "@/lib/games";

// K-AV-7: Passport สาธารณะ (ผู้ล็อกอิน) — อ่านจาก view passport_v (security_invoker · เฉพาะข้อมูลสาธารณะ) + elo_history (เฉพาะแมตช์ COMPLETED)
// Win rate คำนวณสด · ข้อมูล Dota (D1/D2 game_accounts) ไม่ปนใน ELO
export const dynamic = "force-dynamic";

type Row = { user_id: string; username: string; game: string; rating: number; games_played: number; peak: number; matches: number; wins: number; losses: number; karma: number; tournaments_entered: number };
type Hist = { match_id: string; game: string; before: number; after: number; k: number; won: boolean; created_at: string; tournament_matches: { stage: string; round: number; status: string; tournaments: { name: string } | { name: string }[] | null } | { stage: string; round: number; status: string; tournaments: { name: string } | { name: string }[] | null }[] | null };

export async function generateMetadata({ params }: { params: Promise<{ game: string; username: string }> }) {
  const { username } = await params;
  return { title: `Passport ${decodeURIComponent(username)} — AVELAi` };
}

export default async function PassportPage({ params }: { params: Promise<{ game: string; username: string }> }) {
  const { game, username: raw } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const username = decodeURIComponent(raw).slice(0, 40);
  const { db, user } = await requireUser(routes.passport(slug, decodeURIComponent(raw)));
  const { data: rowsRaw } = await db.from("passport_v").select("user_id, username, game, rating, games_played, peak, matches, wins, losses, karma, tournaments_entered").eq("username", username).eq("game", code).order("game");
  const rows = (rowsRaw ?? []) as Row[];
  if (rows.length === 0) notFound();
  const userId = rows[0].user_id;
  const { data: histRaw } = await db.from("elo_history").select("match_id, game, before, after, k, won, created_at, tournament_matches(stage, round, status, tournaments(name))").eq("user_id", userId).eq("game", code).order("created_at", { ascending: false }).limit(30);
  const hist = ((histRaw ?? []) as unknown as Hist[]).filter((h) => { const m = Array.isArray(h.tournament_matches) ? h.tournament_matches[0] : h.tournament_matches; return m?.status === "COMPLETED"; });
  const karma = rows[0].karma;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="// PASSPORT"
        title={rows[0].username}
        subtitle={
          <span>
            Karma <span className={`font-mono tabular-nums ${karma < 50 ? "text-red-300" : karma < 70 ? "text-amber-300" : "text-ink"}`}>{karma}</span> / 100
            {karma < 70 ? <span className="text-sm text-amber-300"> · ลงได้เฉพาะทัวร์ฟรี{karma < 50 ? " · อาจถูกบล็อก 7 วัน" : ""}</span> : null}
            {userId === user.id ? <> · <Link href="/me" className="text-sm text-cyan underline">โปรไฟล์</Link></> : null}
          </span>
        }
        aside={<GameTag game={slug} />}
      />

      <section className="flex flex-col gap-3">
        {rows.map((r) => (
          <Surface key={r.game} as="article" glow="gold" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="// ELO" value={r.rating} tone="gold" />
            <Stat label="// KARMA" value={karma} tone="cyan" />
            <Stat label="// WIN RATE" value={`${winRate(r.wins, r.matches)}%`} />
            <Stat label="// ทัวร์ที่ลง" value={r.tournaments_entered} />
            <p className="col-span-2 text-sm text-ink-muted sm:col-span-4">
              ชนะ <span className="font-mono tabular-nums text-ink">{r.wins}</span> · แพ้ <span className="font-mono tabular-nums text-ink">{r.losses}</span> · สูงสุด <span className="font-mono tabular-nums text-ink">{r.peak}</span> · แมตช์ที่นับ {r.games_played}
            </p>
          </Surface>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-sm tracking-[0.2em] text-ink-muted">{"// ประวัติแมตช์"} (ล่าสุด {hist.length})</h2>
        {hist.length === 0 ? <EmptyState message="ยังไม่มีแมตช์ที่นับ ELO" /> : (
          <ul className="flex flex-col gap-2">
            {hist.map((h) => {
              const m = Array.isArray(h.tournament_matches) ? h.tournament_matches[0] : h.tournament_matches;
              const t = m ? (Array.isArray(m.tournaments) ? m.tournaments[0] : m.tournaments) : null;
              const d = h.after - h.before;
              return (
                <Surface key={h.match_id} as="li" className="flex flex-wrap items-center gap-x-3 gap-y-1 !p-4 text-sm">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${h.won ? "bg-emerald-400/15 text-emerald-200" : "bg-red-400/15 text-red-200"}`}>{h.won ? "ชนะ" : "แพ้"}</span>
                  <span className="text-base text-ink">{t?.name ?? "ทัวร์"} · {m?.stage} R{m?.round}</span>
                  <span className="font-mono tabular-nums text-ink-muted">{h.before} → {h.after} ({d >= 0 ? "+" : ""}{d}) · K{h.k}</span>
                  <span className="text-xs text-ink-muted">{new Date(h.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
                  <Link href={routes.match(slug, h.match_id)} className="ml-auto flex min-h-11 items-center text-sm text-cyan underline">ห้องแมตช์</Link>
                </Surface>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
