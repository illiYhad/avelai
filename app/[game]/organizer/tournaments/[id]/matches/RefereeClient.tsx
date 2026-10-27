"use client";

import { useState, useTransition } from "react";
import { Msg } from "@/components/tournaments/ui";
import type { MatchActionState } from "@/app/[game]/matches/[id]/actions";

const input = "rounded border border-white/20 bg-[#12121A] px-2 py-1 text-sm text-white";

/** ฟอร์มชี้ขาดผล — Idempotency-Key สร้างตอน mount (ส่งซ้ำ = คำขอเดิม) */
export function RefereeResultForm({ matchId, teamA, teamB, bestOf, decide, setStatus, setSchedule, scheduledAt }: {
  matchId: string; teamA: { id: string; label: string }; teamB: { id: string; label: string }; bestOf: number;
  decide: (matchId: string, input: { idempotencyKey: string; outcome: string; winnerTeamId: string; scoreA?: number; scoreB?: number; reason: string }) => Promise<MatchActionState>;
  setStatus: (matchId: string, to: string, reason: string) => Promise<MatchActionState>;
  setSchedule: (matchId: string, iso: string) => Promise<MatchActionState>;
  scheduledAt: string | null;
}) {
  const [when, setWhen] = useState(scheduledAt ? new Date(new Date(scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const [key] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState("NORMAL");
  const [winner, setWinner] = useState(teamA.id);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<MatchActionState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-white/70">เวลานัด (หัวหน้าทีมเริ่มเช็กความพร้อมได้ 30 นาทีก่อนเวลานี้)</label>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={input} />
        <button type="button" disabled={pending || !when} onClick={() => start(async () => setState(await setSchedule(matchId, new Date(when).toISOString())))} className="rounded border border-white/30 px-2 py-1 text-xs text-white/80 disabled:opacity-40">บันทึกเวลานัด</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {["LIVE", "PAUSED", "AWAITING_RESULT", "CANCELLED"].map((s) => (
          <button key={s} type="button" disabled={pending} onClick={() => start(async () => setState(await setStatus(matchId, s, reason)))} className="rounded border border-white/30 px-2 py-1 text-xs text-white/80">→ {s}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={input}>
          <option value="NORMAL">ผลปกติ</option><option value="FORFEIT">สละสิทธิ์</option><option value="WALKOVER">ไม่มาแข่ง (walkover)</option><option value="ADMIN_DECISION">คำตัดสินผู้จัด</option>
        </select>
        <select value={winner} onChange={(e) => setWinner(e.target.value)} className={input}><option value={teamA.id}>{teamA.label}</option><option value={teamB.id}>{teamB.label}</option></select>
        {outcome === "NORMAL" ? (
          <>
            <input type="number" min={0} max={7} value={scoreA} onChange={(e) => setScoreA(Number(e.target.value))} className={`w-16 ${input}`} title={`คะแนน ${teamA.label}`} />
            <span className="text-white/50">–</span>
            <input type="number" min={0} max={7} value={scoreB} onChange={(e) => setScoreB(Number(e.target.value))} className={`w-16 ${input}`} title={`คะแนน ${teamB.label}`} />
            <span className="text-xs text-white/50">(Bo{bestOf})</span>
          </>
        ) : null}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล (บังคับ)" className={input} />
      <button type="button" disabled={pending || !reason.trim()} onClick={() => start(async () => setState(await decide(matchId, { idempotencyKey: key, outcome, winnerTeamId: winner, scoreA, scoreB, reason })))} className="w-fit rounded btn-primary px-3 py-1.5 text-sm disabled:opacity-40">
        ชี้ขาดผล
      </button>
      <Msg state={state} />
      {state?.warning ? <p className="text-sm text-amber-300">{state.warning}</p> : null}
    </div>
  );
}
