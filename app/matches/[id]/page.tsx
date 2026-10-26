import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { MATCH_LABEL, type MatchStatus } from "@/lib/match/state";
import { MATCH_COLS, resolveWalkoverIfExpired, type MatchRow } from "@/lib/match/resolve";
import { leaderTeams } from "@/lib/tournament/access";
import { teamLabel, type TeamName } from "@/lib/tournament/engine/view";
import { declareFinishedAction, readyCheckAction, submitReportAction } from "./actions";
import { Countdown, ReadyButton, ReportForm } from "./MatchRoomClient";

// K-AV-5: ห้องแมตช์ — สถานะ · ปุ่มพร้อม (นับถอยหลัง walkover) · จบเกม · ส่งผล+หลักฐาน · resolve walkover แบบ lazy ตอนเปิดหน้า
export const dynamic = "force-dynamic";

type Full = MatchRow & { result_source: string | null; outcome: string | null; score_a: number | null; score_b: number | null; confirmed_at: string | null };

export default async function MatchRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireUser(`/matches/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: mRaw } = await db.from("tournament_matches").select(MATCH_COLS).eq("id", id).maybeSingle();
  if (!mRaw) notFound();
  let m = mRaw as Full;
  if (await resolveWalkoverIfExpired(db, m, user.id, new Date())) {
    const { data: again } = await db.from("tournament_matches").select(MATCH_COLS).eq("id", id).maybeSingle();
    if (again) m = again as Full;
  }
  const [{ data: t }, { data: teams }, mine, { data: reports }] = await Promise.all([
    db.from("tournaments").select("id, name, best_of, ready_check_minutes, auto_confirm, auto_confirm_minutes").eq("id", m.tournament_id).maybeSingle(),
    db.from("teams").select("id, name, tag").in("id", [m.team_a_id, m.team_b_id].filter((x): x is string => !!x)),
    leaderTeams(db, user.id),
    db.from("match_reports").select("reported_by_team, winner_team_id, score_a, score_b, created_at").eq("match_id", id),
  ]);
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));
  const myTeam = mine.find((x) => x.id === m.team_a_id || x.id === m.team_b_id);
  const side = myTeam ? (myTeam.id === m.team_a_id ? "A" : "B") : null;
  const status = m.status as MatchStatus;
  const label = (id: string | null) => teamLabel(names, id);
  const myReport = (reports ?? []).find((r) => r.reported_by_team === myTeam?.id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs tracking-widest text-cyan">{MATCH_LABEL[status] ?? m.status} · {m.stage} รอบ {m.round} #{m.position} · Best of {m.best_of}</p>
        <h1 className="text-xl font-bold text-white">{label(m.team_a_id)} <span className="text-white/40">vs</span> {label(m.team_b_id)}</h1>
        <p className="text-xs text-white/60">{t?.name} · <Link href={`/tournaments/${m.tournament_id}`} className="underline">ทัวร์</Link> · <Link href={`/matches/${id}/evidence`} className="underline">สมุดหลักฐาน</Link></p>
      </div>

      {status === "WALKOVER" || status === "COMPLETED" || status === "BYE" ? (
        <section className="rounded border border-white/15 p-4 text-sm">
          <p>ผู้ชนะ: <b className="text-cyan">{label(m.winner_team_id)}</b>{m.score_a !== null && m.score_b !== null ? ` · ${m.score_a}–${m.score_b}` : ""}</p>
          <p className="text-xs text-white/60">ที่มา: {m.result_source ?? "–"} · {m.outcome ?? "–"} · ยืนยันเมื่อ {m.confirmed_at ? new Date(m.confirmed_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "–"}</p>
        </section>
      ) : null}

      {side ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-white/80">คุณเป็นหัวหน้าทีม <b>{myTeam?.name}</b> (ฝั่ง {side})</p>
          {(status === "SCHEDULED" || status === "READY_CHECK") ? (
            <div className="flex flex-wrap items-center gap-3">
              <ReadyButton action={readyCheckAction.bind(null, id)} label={(side === "A" ? m.check_in_a_at : m.check_in_b_at) ? "กดพร้อมแล้ว ✓" : "ทีมเราพร้อมแล้ว"} />
              {status === "READY_CHECK" && m.forfeit_deadline_at ? <span className="text-sm text-amber-300">เหลือเวลา <Countdown deadline={m.forfeit_deadline_at} /> — ทีมที่ไม่กดพร้อมจะแพ้ walkover</span> : <span className="text-xs text-white/50">ทีมแรกที่กดจะเริ่มนับถอยหลัง {t?.ready_check_minutes ?? 15} นาที</span>}
            </div>
          ) : null}
          {(status === "LIVE" || status === "PAUSED") ? <ReadyButton action={declareFinishedAction.bind(null, id)} label="จบเกมแล้ว — ไปส่งผล" /> : null}
          {status === "AWAITING_RESULT" ? (
            myReport ? <p className="rounded border border-white/15 p-3 text-sm text-white/80">ทีมของคุณส่งผลแล้ว: {label(myReport.winner_team_id)} ชนะ {myReport.score_a}–{myReport.score_b} · รออีกฝั่ง/ผู้ตัดสิน</p>
            : <ReportForm action={submitReportAction.bind(null, id)} teamA={{ id: m.team_a_id!, label: label(m.team_a_id) }} teamB={{ id: m.team_b_id!, label: label(m.team_b_id) }} bestOf={m.best_of} />
          ) : null}
          {status === "DISPUTED" ? <p className="text-sm text-amber-300">แมตช์นี้มีข้อพิพาท — รอผู้ตัดสิน</p> : null}
        </section>
      ) : <p className="text-sm text-white/60">คุณไม่ใช่หัวหน้าทีมในแมตช์นี้ — ดูได้อย่างเดียว</p>}

      <section className="text-xs text-white/60">
        <p>เช็กอิน A: {m.check_in_a_at ? "✓" : "–"} · B: {m.check_in_b_at ? "✓" : "–"} · รายงานผลแล้ว {(reports ?? []).length}/2 ฝั่ง{t?.auto_confirm ? ` · ยืนยันอัตโนมัติหลัง ${t.auto_confirm_minutes} นาที` : ""}</p>
      </section>
    </main>
  );
}
