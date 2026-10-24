// หน้าตรวจผลแมตช์/ข้อพิพาทของแอดมิน (K-AV-R เฟส 2)
// ยกแนวทางจาก Zodiac: admin hub + dispute resolve flow · ใช้ requireAdmin ของ K-AV-1
import { requireAdmin } from "@/lib/auth/roles";
import { ResolveDisputeForm } from "@/components/team/ResolveDisputeForm";

export const dynamic = "force-dynamic";

type TeamRef = { id: string; name: string; tag: string };

export default async function AdminTeamMatchesPage() {
  const { db } = await requireAdmin("/admin/team-matches");

  const { data: matches } = await db
    .from("team_matches")
    .select("id, status, best_of, scheduled_at, team_a_id, team_b_id, score_a, score_b")
    .in("status", ["AWAITING_RESULT", "DISPUTED"])
    .order("updated_at", { ascending: false })
    .limit(50);

  const matchIds = (matches ?? []).map((m) => m.id);
  const teamIds = Array.from(
    new Set((matches ?? []).flatMap((m) => [m.team_a_id, m.team_b_id]).filter(Boolean)),
  ) as string[];

  const [{ data: teams }, { data: reports }, { data: disputes }] = await Promise.all([
    teamIds.length ? db.from("teams").select("id, name, tag").in("id", teamIds) : Promise.resolve({ data: [] as TeamRef[] }),
    matchIds.length
      ? db.from("team_match_reports").select("*").in("match_id", matchIds)
      : Promise.resolve({ data: [] }),
    matchIds.length
      ? db.from("team_match_disputes").select("*").in("match_id", matchIds).neq("status", "RESOLVED")
      : Promise.resolve({ data: [] }),
  ]);

  const teamOf = (id: string | null): TeamRef =>
    (teams ?? []).find((t: TeamRef) => t.id === id) ?? { id: id ?? "", name: "ไม่ทราบทีม", tag: "" };

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-2">ADMIN</p>
        <h1 className="text-2xl font-bold mb-6">ตรวจผลแมตช์ทีม / ข้อพิพาท</h1>

        {(matches ?? []).length === 0 && (
          <p className="text-sm text-neutral-400">ไม่มีแมตช์ที่รอตรวจหรือมีข้อพิพาทในขณะนี้</p>
        )}

        <ul className="flex flex-col gap-4">
          {(matches ?? []).map((m) => {
            const a = teamOf(m.team_a_id);
            const b = teamOf(m.team_b_id);
            const matchReports = (reports ?? []).filter((r) => r.match_id === m.id);
            const matchDisputes = (disputes ?? []).filter((d) => d.match_id === m.id);
            return (
              <li key={m.id} className="rounded-lg border border-white/10 bg-[#12121A] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    {a.name} {a.tag && `[${a.tag}]`} <span className="text-neutral-500">vs</span> {b.name} {b.tag && `[${b.tag}]`}
                  </p>
                  <span
                    className={`rounded px-2 py-1 text-[10px] font-mono font-bold ${
                      m.status === "DISPUTED" ? "bg-rose-500/15 text-rose-300" : "bg-yellow-500/15 text-yellow-300"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                {matchReports.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {matchReports.map((r) => (
                      <div key={r.id} className="rounded border border-white/10 bg-[#0A0A0F] p-2 text-xs">
                        <p>
                          รายงานโดยทีม {teamOf(r.reported_by_team).name}: ผู้ชนะ {r.winner_team_id ? teamOf(r.winner_team_id).name : "เสมอ"} · {r.score_a}:{r.score_b}
                        </p>
                        <p className="mt-1 text-neutral-400 break-all">
                          หลักฐาน: {(r.evidence_urls as string[]).map((u: string, i: number) => (
                            <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-[#00D4FF] underline mr-2">
                              รูปที่ {i + 1}
                            </a>
                          ))}
                        </p>
                        {r.note && <p className="mt-1 text-neutral-400">โน้ต: {r.note}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {matchDisputes.map((d) => (
                  <div key={d.id} className="mt-3 rounded border border-rose-500/30 bg-rose-500/5 p-2 text-xs">
                    <p className="font-bold text-rose-300">ข้อพิพาท ({d.category} · {d.priority})</p>
                    <p className="mt-1 whitespace-pre-wrap text-neutral-300">{d.reason}</p>
                    {(d.evidence_urls as string[])?.length > 0 && (
                      <p className="mt-1 text-neutral-400">
                        หลักฐาน: {(d.evidence_urls as string[]).map((u: string, i: number) => (
                          <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-[#00D4FF] underline mr-2">
                            รูปที่ {i + 1}
                          </a>
                        ))}
                      </p>
                    )}
                    <ResolveDisputeForm
                      matchId={m.id}
                      disputeId={d.id}
                      teamA={{ id: a.id, name: a.name }}
                      teamB={{ id: b.id, name: b.name }}
                    />
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
