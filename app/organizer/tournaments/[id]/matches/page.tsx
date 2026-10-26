import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { refereeResultAction, refereeStatusAction } from "@/app/matches/[id]/actions";
import { MATCH_LABEL, isTerminal, type MatchStatus } from "@/lib/match/state";
import { MATCH_COLS, type MatchRow } from "@/lib/match/resolve";
import { TOURNAMENT_COLS, tournamentStaffLevel, type TournamentRow } from "@/lib/tournament/access";
import { teamLabel, type TeamName } from "@/lib/tournament/engine/view";
import { RefereeResultForm } from "./RefereeClient";

// K-AV-5: หน้าผู้ตัดสิน — รายการแมตช์ของทัวร์ + ชี้ขาดผล (REFEREE/ผู้จัด/ADMIN)
export const dynamic = "force-dynamic";

export default async function RefereeMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireUser(`/organizer/tournaments/${id}/matches`);
  const { data: tRaw } = await db.from("tournaments").select(TOURNAMENT_COLS).eq("id", id).maybeSingle();
  const t = tRaw as TournamentRow | null;
  if (!t) notFound();
  if ((await tournamentStaffLevel(db, user.id, t)) === "NONE") notFound();
  const { data: rows } = await db.from("tournament_matches").select(MATCH_COLS).eq("tournament_id", id).order("stage").order("round").order("position");
  const matches = (rows ?? []) as (MatchRow & { score_a: number | null; score_b: number | null; result_source: string | null })[];
  const teamIds = [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x): x is string => !!x))];
  const { data: teams } = teamIds.length ? await db.from("teams").select("id, name, tag").in("id", teamIds) : { data: [] };
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.name} · แมตช์ (ผู้ตัดสิน)</h1>
        <Link href={`/organizer/tournaments/${id}`} className="text-xs text-white/60 underline">กลับหน้าจัดการ</Link>
      </div>
      {matches.length === 0 ? <p className="text-sm text-white/60">ยังไม่มีแมตช์ (สร้างสาย/รอบก่อน)</p> : matches.map((m) => {
        const status = m.status as MatchStatus;
        return (
          <section key={m.id} className="rounded border border-white/15 p-4">
            <p className="text-sm"><span className="text-xs text-white/50">{m.stage} R{m.round} #{m.position}</span> · <b>{teamLabel(names, m.team_a_id)}</b> vs <b>{teamLabel(names, m.team_b_id)}</b> · <span className="text-cyan">{MATCH_LABEL[status] ?? m.status}</span>
              {m.winner_team_id ? ` · ชนะ: ${teamLabel(names, m.winner_team_id)}${m.score_a !== null ? ` ${m.score_a}–${m.score_b}` : ""} (${m.result_source})` : ""}
              · <Link href={`/matches/${m.id}`} className="underline">ห้องแมตช์</Link> · <Link href={`/matches/${m.id}/evidence`} className="underline">หลักฐาน</Link>
            </p>
            {!isTerminal(status) && m.team_a_id && m.team_b_id ? (
              <div className="mt-3">
                <RefereeResultForm matchId={m.id} teamA={{ id: m.team_a_id, label: teamLabel(names, m.team_a_id) }} teamB={{ id: m.team_b_id, label: teamLabel(names, m.team_b_id) }} bestOf={m.best_of} decide={refereeResultAction} setStatus={refereeStatusAction} />
              </div>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
