import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { winRate } from "@/lib/elo/elo";
import { gameLabel } from "@/lib/games";
import { routes } from "@/lib/routes";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs tracking-widest text-cyan">PASSPORT</p>
        <h1 className="font-display text-2xl tracking-[0.15em] text-gold">{rows[0].username}</h1>
        <p className="text-sm text-white/70">Karma <span className={`font-numeric ${karma < 50 ? "text-red-300" : karma < 70 ? "text-amber-300" : "text-white"}`}>{karma}</span> / 100
          {karma < 70 ? <span className="text-xs text-amber-300"> · ลงได้เฉพาะทัวร์ฟรี{karma < 50 ? " · อาจถูกบล็อก 7 วัน" : ""}</span> : null}
          {userId === user.id ? <> · <Link href="/me" className="text-xs underline">โปรไฟล์</Link></> : null}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.game} className="flex flex-col gap-1 rounded border border-white/15 p-4 text-sm">
            <p className="text-xs tracking-widest text-cyan">{gameLabel(r.game)}</p>
            <p className="font-numeric text-2xl text-white">{r.rating} <span className="text-xs text-white/50">ELO · สูงสุด {r.peak}</span></p>
            <p className="text-white/80">ชนะ <span className="font-numeric">{r.wins}</span> · แพ้ <span className="font-numeric">{r.losses}</span> · Win rate <span className="font-numeric">{winRate(r.wins, r.matches)}%</span></p>
            <p className="text-xs text-white/60">แมตช์ที่นับ {r.games_played} · ทัวร์ที่ลง {r.tournaments_entered}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/90">ประวัติแมตช์ (COMPLETED · ล่าสุด {hist.length})</h2>
        {hist.length === 0 ? <p className="text-sm text-white/60">ยังไม่มีแมตช์ที่นับ ELO</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {hist.map((h) => {
              const m = Array.isArray(h.tournament_matches) ? h.tournament_matches[0] : h.tournament_matches;
              const t = m ? (Array.isArray(m.tournaments) ? m.tournaments[0] : m.tournaments) : null;
              const d = h.after - h.before;
              return (
                <li key={h.match_id} className="flex flex-wrap items-center gap-2 rounded border border-white/10 px-3 py-2">
                  <span className={h.won ? "text-emerald-300" : "text-red-300"}>{h.won ? "ชนะ" : "แพ้"}</span>
                  <span className="text-white/80">{t?.name ?? "ทัวร์"} · {m?.stage} R{m?.round} · {gameLabel(h.game)}</span>
                  <span className="font-numeric text-white/70">{h.before} → {h.after} ({d >= 0 ? "+" : ""}{d}) · K{h.k}</span>
                  <span className="text-xs text-white/50">{new Date(h.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
                  <Link href={routes.match(slug, h.match_id)} className="text-xs text-cyan underline">ห้องแมตช์</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
