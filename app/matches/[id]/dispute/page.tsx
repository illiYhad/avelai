import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { canOpenDispute } from "@/lib/dispute/rules";
import { MATCH_LABEL, type MatchStatus } from "@/lib/match/state";
import { MATCH_COLS, type MatchRow } from "@/lib/match/resolve";
import { leaderTeams } from "@/lib/tournament/access";
import { teamLabel, type TeamName } from "@/lib/tournament/engine/view";
import { openDisputeAction } from "./actions";
import { DisputeForm } from "./DisputeClient";

// K-AV-6: หน้าเปิดข้อพิพาท (หัวหน้าทีมในแมตช์ · เปิดได้จาก LIVE/PAUSED/AWAITING_RESULT)
export const dynamic = "force-dynamic";

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireUser(`/matches/${id}/dispute`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: mRaw } = await db.from("tournament_matches").select(MATCH_COLS).eq("id", id).maybeSingle();
  if (!mRaw) notFound();
  const m = mRaw as MatchRow;
  const [mine, { data: teams }, { data: disputes }] = await Promise.all([
    leaderTeams(db, user.id),
    db.from("teams").select("id, name, tag").in("id", [m.team_a_id, m.team_b_id].filter((x): x is string => !!x)),
    db.from("disputes").select("id, opened_by_team, status, reason, resolution, created_at").eq("match_id", id).order("created_at"),
  ]);
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));
  const myTeam = mine.find((x) => x.id === m.team_a_id || x.id === m.team_b_id);
  const openErr = canOpenDispute(m.status);
  const myOpen = (disputes ?? []).find((d) => d.opened_by_team === myTeam?.id && (d.status === "OPEN" || d.status === "UNDER_REVIEW"));
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs tracking-widest text-amber-300">ข้อพิพาท · {MATCH_LABEL[m.status as MatchStatus] ?? m.status}</p>
        <h1 className="text-xl font-bold text-white">{teamLabel(names, m.team_a_id)} <span className="text-white/40">vs</span> {teamLabel(names, m.team_b_id)}</h1>
        <Link href={`/matches/${id}`} className="text-xs text-white/60 underline">กลับห้องแมตช์</Link>
      </div>
      {(disputes ?? []).map((d) => (
        <div key={d.id} className="rounded border border-white/15 p-3 text-sm">
          <p><b>{teamLabel(names, d.opened_by_team)}</b> · <span className="text-amber-300">{d.status}</span> · {new Date(d.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          <p className="text-white/80">{d.reason}</p>
          {d.resolution ? <p className="mt-1 text-xs text-white/60">คำชี้ขาด: {d.resolution}</p> : null}
        </div>
      ))}
      {!myTeam ? <p className="text-sm text-white/60">เฉพาะหัวหน้าทีมในแมตช์นี้เท่านั้นที่เปิดข้อพิพาทได้</p>
        : myOpen ? <p className="text-sm text-white/70">ทีมของคุณเปิดข้อพิพาทไว้แล้ว — รอผู้ตัดสิน</p>
        : openErr ? <p className="text-sm text-white/60">{openErr}</p>
        : <DisputeForm action={openDisputeAction.bind(null, id)} />}
    </main>
  );
}
