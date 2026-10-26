"use client";

import { useState, useTransition } from "react";
import { ActionButton, Msg } from "@/components/tournaments/ui";
import type { DisputeState } from "@/app/matches/[id]/dispute/actions";

const input = "rounded border border-white/20 bg-[#12121A] px-2 py-1 text-sm text-white";

/** ชี้ขาดข้อพิพาท — Idempotency-Key สร้างตอน mount */
export function ResolveForm({ disputeId, teamA, teamB, bestOf, review, resolve }: {
  disputeId: string; teamA: { id: string; label: string }; teamB: { id: string; label: string }; bestOf: number;
  review: (disputeId: string) => Promise<DisputeState>;
  resolve: (disputeId: string, input: { idempotencyKey: string; kind: "UPHOLD" | "REJECT"; winnerTeamId?: string; scoreA?: number; scoreB?: number; resolution: string; falseDispute?: boolean }) => Promise<DisputeState>;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<"UPHOLD" | "REJECT">("UPHOLD");
  const [winner, setWinner] = useState(teamA.id);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [falseDispute, setFalse] = useState(false);
  const [resolution, setResolution] = useState("");
  const [state, setState] = useState<DisputeState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 text-sm">
      <ActionButton action={() => review(disputeId)} label="รับเรื่อง (UNDER_REVIEW)" className="w-fit rounded border border-white/30 px-2 py-1 text-xs text-white/80" />
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as "UPHOLD" | "REJECT")} className={input}><option value="UPHOLD">รับฟัง — ตั้งผลใหม่</option><option value="REJECT">ไม่มีมูล — แมตช์กลับไปรอผล</option></select>
        {kind === "UPHOLD" ? (
          <>
            <select value={winner} onChange={(e) => setWinner(e.target.value)} className={input}><option value={teamA.id}>{teamA.label}</option><option value={teamB.id}>{teamB.label}</option></select>
            <input type="number" min={0} max={7} value={scoreA} onChange={(e) => setScoreA(Number(e.target.value))} className={`w-16 ${input}`} /><span className="text-white/50">–</span>
            <input type="number" min={0} max={7} value={scoreB} onChange={(e) => setScoreB(Number(e.target.value))} className={`w-16 ${input}`} /><span className="text-xs text-white/50">(Bo{bestOf})</span>
          </>
        ) : <label className="flex items-center gap-1 text-xs text-white/70"><input type="checkbox" checked={falseDispute} onChange={(e) => setFalse(e.target.checked)} /> ข้อพิพาทเท็จ (Karma −10 ให้ T7)</label>}
      </div>
      <input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="คำชี้ขาด (บังคับ ≥5 ตัวอักษร)" className={input} />
      <button type="button" disabled={pending || resolution.trim().length < 5} onClick={() => start(async () => setState(await resolve(disputeId, { idempotencyKey: key, kind, winnerTeamId: winner, scoreA, scoreB, resolution, falseDispute })))} className="w-fit rounded btn-primary px-3 py-1.5 text-sm disabled:opacity-40">ชี้ขาด</button>
      <Msg state={state} />
      {state?.warning ? <p className="text-sm text-amber-300">{state.warning}</p> : null}
      {state?.karmaDelta !== undefined ? <p className="text-xs text-white/60">Karma delta (ส่งต่อ T7): {state.karmaDelta}</p> : null}
    </div>
  );
}

export function PenaltyForm({ tournamentId, disputeId, candidates, issue }: {
  tournamentId: string; disputeId?: string; candidates: { id: string; label: string; kind: "user" | "team" }[];
  issue: (input: { tournamentId: string; disputeId?: string; subjectUserId?: string; subjectTeamId?: string; type: string; value?: number; until?: string; reason: string }) => Promise<DisputeState>;
}) {
  const [subject, setSubject] = useState(candidates[0]?.id ?? "");
  const [type, setType] = useState("WARNING");
  const [value, setValue] = useState(-5);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<DisputeState | null>(null);
  const [pending, start] = useTransition();
  const c = candidates.find((x) => x.id === subject);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={input}>{candidates.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={input}><option value="WARNING">WARNING</option><option value="SUSPENSION">SUSPENSION</option><option value="KARMA">KARMA</option><option value="BAN">BAN (ADMIN)</option></select>
        {type === "SUSPENSION" ? <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={input} /> : null}
        {type === "KARMA" ? <input type="number" max={-1} value={value} onChange={(e) => setValue(Number(e.target.value))} className={`w-20 ${input}`} /> : null}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล (บังคับ ≥5 ตัวอักษร)" className={input} />
      <button type="button" disabled={pending || reason.trim().length < 5 || !c} onClick={() => start(async () => setState(await issue({ tournamentId, disputeId, subjectUserId: c?.kind === "user" ? c.id : undefined, subjectTeamId: c?.kind === "team" ? c.id : undefined, type, value, until: until ? new Date(until).toISOString() : undefined, reason })))} className="w-fit rounded border border-red-400/60 px-3 py-1.5 text-sm text-red-300 disabled:opacity-40">ออกโทษ</button>
      <Msg state={state} />
    </div>
  );
}
