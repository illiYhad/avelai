import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { issuePenaltyAction, resolveDisputeAction, startReviewAction } from "@/app/matches/[id]/dispute/actions";
import { TOURNAMENT_COLS, tournamentStaffLevel, type TournamentRow } from "@/lib/tournament/access";
import { teamLabel, type TeamName } from "@/lib/tournament/engine/view";
import { PenaltyForm, ResolveForm } from "./DisputeQueueClient";

// K-AV-6: คิวข้อพิพาทของผู้ตัดสิน + ออกโทษ · โทษที่ออกแล้วของทัวร์
export const dynamic = "force-dynamic";

type D = { id: string; match_id: string; opened_by_team: string; opened_by_user: string; status: string; reason: string; resolution: string | null; created_at: string; tournament_matches: { team_a_id: string | null; team_b_id: string | null; best_of: number; status: string } | { team_a_id: string | null; team_b_id: string | null; best_of: number; status: string }[] | null };

export default async function DisputeQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireUser(`/organizer/tournaments/${id}/disputes`);
  const { data: tRaw } = await db.from("tournaments").select(TOURNAMENT_COLS).eq("id", id).maybeSingle();
  const t = tRaw as TournamentRow | null;
  if (!t) notFound();
  if ((await tournamentStaffLevel(db, user.id, t)) === "NONE") notFound();
  const [{ data: dRaw }, { data: penalties }] = await Promise.all([
    db.from("disputes").select("id, match_id, opened_by_team, opened_by_user, status, reason, resolution, created_at, tournament_matches(team_a_id, team_b_id, best_of, status)").eq("tournament_id", id).order("created_at", { ascending: false }),
    db.from("penalties").select("id, user_id, team_id, type, value, until, reason, revoked_at, created_at").eq("tournament_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  const disputes = (dRaw ?? []) as D[];
  const teamIds = [...new Set(disputes.flatMap((d) => { const m = Array.isArray(d.tournament_matches) ? d.tournament_matches[0] : d.tournament_matches; return [d.opened_by_team, m?.team_a_id, m?.team_b_id]; }).filter((x): x is string => !!x))];
  const { data: teams } = teamIds.length ? await db.from("teams").select("id, name, tag").in("id", teamIds) : { data: [] };
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.name} · ข้อพิพาท / โทษ</h1>
        <Link href={`/organizer/tournaments/${id}`} className="text-xs text-white/60 underline">กลับหน้าจัดการ</Link>
      </div>
      {disputes.length === 0 ? <p className="text-sm text-white/60">ไม่มีข้อพิพาท</p> : disputes.map((d) => {
        const m = Array.isArray(d.tournament_matches) ? d.tournament_matches[0] : d.tournament_matches;
        const open = d.status === "OPEN" || d.status === "UNDER_REVIEW";
        return (
          <section key={d.id} className={`rounded border p-4 ${open ? "border-amber-300/40" : "border-white/15"}`}>
            <p className="text-sm"><span className="text-amber-300">{d.status}</span> · โดย <b>{teamLabel(names, d.opened_by_team)}</b> · {new Date(d.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · <Link href={`/matches/${d.match_id}/evidence`} className="underline">สมุดหลักฐาน</Link></p>
            <p className="mt-1 text-sm text-white/80">{d.reason}</p>
            {d.resolution ? <p className="mt-1 text-xs text-white/60">คำชี้ขาด: {d.resolution}</p> : null}
            {open && m?.team_a_id && m?.team_b_id ? (
              <div className="mt-3 flex flex-col gap-4">
                <ResolveForm disputeId={d.id} teamA={{ id: m.team_a_id, label: teamLabel(names, m.team_a_id) }} teamB={{ id: m.team_b_id, label: teamLabel(names, m.team_b_id) }} bestOf={m.best_of} review={startReviewAction} resolve={resolveDisputeAction} />
                <details className="text-sm"><summary className="cursor-pointer text-white/70">ออกโทษจากข้อพิพาทนี้</summary>
                  <div className="mt-2"><PenaltyForm tournamentId={id} disputeId={d.id} issue={issuePenaltyAction} candidates={[
                    { id: m.team_a_id, label: `ทีม ${teamLabel(names, m.team_a_id)}`, kind: "team" }, { id: m.team_b_id, label: `ทีม ${teamLabel(names, m.team_b_id)}`, kind: "team" },
                    { id: d.opened_by_user, label: "ผู้เปิดข้อพิพาท (ผู้ใช้)", kind: "user" },
                  ]} /></div>
                </details>
              </div>
            ) : null}
          </section>
        );
      })}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/90">โทษที่ออกในทัวร์นี้</h2>
        {(penalties ?? []).length === 0 ? <p className="text-sm text-white/60">ไม่มี</p> : (
          <ul className="divide-y divide-white/10 rounded border border-white/15 text-sm">
            {(penalties ?? []).map((p) => <li key={p.id} className="px-3 py-2">{p.type}{p.value ? ` ${p.value}` : ""}{p.until ? ` ถึง ${new Date(p.until).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}` : ""} · {p.team_id ? `ทีม ${teamLabel(names, p.team_id)}` : `ผู้ใช้ ${String(p.user_id).slice(0, 8)}`} · {p.reason}{p.revoked_at ? " · ยกเลิกแล้ว" : ""}</li>)}
          </ul>
        )}
      </section>
    </main>
  );
}
