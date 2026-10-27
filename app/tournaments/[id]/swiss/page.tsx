import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { standings, type SwissResult } from "@/lib/tournament/engine";
import { teamLabel, type TeamName } from "@/lib/tournament/engine/view";

// K-AV-4: ตารางรอบ Swiss + อันดับ (tiebreak: Wins → Buchholz → H2H → ลำดับลงทะเบียน) · อ่านอย่างเดียว
export const dynamic = "force-dynamic";

type PairRow = { round: number; board: number; team_a_id: string; team_b_id: string | null; tournament_matches: { winner_team_id: string | null; status: string } | { winner_team_id: string | null; status: string }[] | null };

export default async function SwissPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getServerDb();
  if (!db) return <main className="px-6 py-10 text-sm text-white/60">ยังไม่ต่อฐานข้อมูล</main>;
  const { data: t } = await db.from("tournaments").select("id, name, format, status, swiss_rounds").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: auth } = await db.auth.getUser();
  const [{ data: pairs }, { data: regs }] = await Promise.all([
    db.from("tournament_swiss_pairings").select("round, board, team_a_id, team_b_id, tournament_matches(winner_team_id, status)").eq("tournament_id", id).order("round").order("board"),
    db.from("registrations").select("team_id, seed, created_at").eq("tournament_id", id).eq("status", "CHECKED_IN").order("created_at"),
  ]);
  const rows = (pairs ?? []) as PairRow[];
  const results: SwissResult[] = rows.map((p) => {
    const m = Array.isArray(p.tournament_matches) ? p.tournament_matches[0] : p.tournament_matches;
    return { round: p.round, teamA: p.team_a_id, teamB: p.team_b_id, winnerId: m && (m.status === "COMPLETED" || m.status === "BYE") ? m.winner_team_id : null };
  });
  const teamOrder = ((regs ?? []) as { team_id: string }[]).map((r) => r.team_id);
  const teamIds = [...new Set([...teamOrder, ...rows.flatMap((p) => [p.team_a_id, p.team_b_id]).filter((x): x is string => !!x)])];
  const { data: teams } = teamIds.length ? await db.from("teams").select("id, name, tag").in("id", teamIds) : { data: [] };
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));
  const table = teamOrder.length ? standings(teamOrder, results) : [];
  const rounds = [...new Set(rows.map((p) => p.round))].sort((a, b) => a - b);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.name} · Swiss</h1>
        <Link href={`/tournaments/${id}`} className="text-xs text-white/60 underline">รายละเอียดทัวร์</Link>
      </div>
      {!auth.user ? <p className="text-sm text-white/60">เข้าสู่ระบบเพื่อดูตาราง</p> : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-white/90">อันดับ{t.swiss_rounds ? ` · ${t.swiss_rounds} รอบ` : ""}</h2>
            {table.length === 0 ? <p className="text-sm text-white/60">ยังไม่มีทีมเช็กอิน</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-white/60"><tr><th className="py-1">#</th><th>ทีม</th><th>ชนะ</th><th>แพ้</th><th>Buchholz</th></tr></thead>
                  <tbody>{table.map((s) => <tr key={s.teamId} className="border-t border-white/10"><td className="py-1 font-numeric">{s.rank}</td><td>{teamLabel(names, s.teamId)}</td><td className="font-numeric">{s.wins}</td><td className="font-numeric">{s.losses}</td><td className="font-numeric">{s.buchholz}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
          {rounds.map((r) => (
            <section key={r}>
              <h2 className="mb-2 text-sm font-semibold text-white/90">รอบ {r}</h2>
              <ul className="divide-y divide-white/10 rounded border border-white/15 text-sm">
                {rows.filter((p) => p.round === r).map((p) => {
                  const res = results.find((x) => x.round === p.round && x.teamA === p.team_a_id)!;
                  return (
                    <li key={p.board} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="w-8 text-xs text-white/50">#{p.board}</span>
                      <span className={res.winnerId === p.team_a_id ? "text-cyan" : ""}>{teamLabel(names, p.team_a_id)}</span>
                      <span className="text-white/60">vs</span>
                      <span className={res.winnerId === p.team_b_id ? "text-cyan" : ""}>{p.team_b_id ? teamLabel(names, p.team_b_id) : "BYE"}</span>
                      <span className="ml-auto text-xs text-white/50">{!p.team_b_id ? "ผ่าน" : res.winnerId ? "จบแล้ว" : "รอผล"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {rounds.length === 0 ? <p className="text-sm text-white/60">ยังไม่ได้สร้างรอบ</p> : null}
        </>
      )}
    </main>
  );
}
