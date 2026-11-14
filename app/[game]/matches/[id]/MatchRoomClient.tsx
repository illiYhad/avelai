"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionButton, Msg } from "@/components/tournaments/ui";
import type { MatchActionState } from "./actions";

const initial: MatchActionState = { ok: false, message: "" };

/** นับถอยหลังถึง deadline (ฝั่ง client · อ่านจาก prop ไม่ใช่ Date.now ใน render) */
export function Countdown({ deadline }: { deadline: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (left === null) return null;
  return <span className="font-numeric">{left === 0 ? "หมดเวลา — โหลดหน้าใหม่" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</span>;
}

export function ReadyButton({ action, label }: { action: () => Promise<MatchActionState>; label: string }) {
  return <ActionButton action={action} label={label} className="rounded btn-primary px-4 py-2 text-sm" />;
}

export function ReportForm({ action, teamA, teamB, bestOf }: { action: (p: MatchActionState, f: FormData) => Promise<MatchActionState>; teamA: { id: string; label: string }; teamB: { id: string; label: string }; bestOf: number }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const input = "rounded border border-white/20 bg-[#12121A] px-3 py-2 text-sm text-white";
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded border border-white/15 p-4">
      <p className="text-sm font-semibold text-white/90">ส่งผล (Best of {bestOf}) — ต้องแนบภาพหลักฐานอย่างน้อย 1 รูป</p>
      <label className="text-xs text-white/70">ทีมที่ชนะ
        <select name="winner_team_id" className={`mt-1 w-full ${input}`}><option value={teamA.id}>{teamA.label}</option><option value={teamB.id}>{teamB.label}</option></select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-white/70">คะแนน {teamA.label}<input name="score_a" type="number" min={0} max={7} required className={`mt-1 w-full ${input}`} /></label>
        <label className="text-xs text-white/70">คะแนน {teamB.label}<input name="score_b" type="number" min={0} max={7} required className={`mt-1 w-full ${input}`} /></label>
      </div>
      <label className="text-xs text-white/70">หลักฐาน (JPEG/PNG/WebP · ≤5MB · ไม่เกิน 5 รูป)
        <input name="evidence" type="file" accept="image/jpeg,image/png,image/webp" multiple required className="mt-1 block text-xs" />
      </label>
      <label className="text-xs text-white/70">หมายเหตุ<input name="note" maxLength={500} className={`mt-1 w-full ${input}`} /></label>
      <button type="submit" disabled={pending} className="w-fit rounded btn-primary px-4 py-2 text-sm disabled:opacity-50">{pending ? "กำลังส่ง…" : "ส่งผล"}</button>
      <Msg state={state} />
      {state.warning ? <p className="text-sm text-amber-300">{state.warning}</p> : null}
    </form>
  );
}

/** K-AV-INTEG.1b: ช่องกรอก Dota Match ID ต่อเกม (1..bestOf) · ข้อความมาจาก dict ฝั่ง server */
export function DotaMatchIdForm({ action, bestOf, existing, canOverwrite, t }: {
  action: (p: MatchActionState, f: FormData) => Promise<MatchActionState>;
  bestOf: number;
  existing: Record<number, string>;
  canOverwrite: boolean;
  t: { title: string; hint: string; game: string; save: string; saving: string; lockedHint: string };
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const input = "w-36 rounded border border-white/20 bg-[#12121A] px-3 py-2 font-numeric text-sm text-white";
  const games = Array.from({ length: Math.min(7, Math.max(1, bestOf)) }, (_, i) => i + 1);
  return (
    <section className="flex flex-col gap-2 rounded border border-white/15 p-4">
      <p className="text-sm font-semibold text-white/90">{t.title}</p>
      <p className="text-xs text-white/60">{t.hint}</p>
      {games.map((n) => {
        const cur = existing[n] ?? "";
        const locked = !!cur && !canOverwrite;
        return (
          <form key={n} action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="game_number" value={n} />
            <label className="flex items-center gap-2 text-xs text-white/70">{t.game} {n}
              <input name="dota_match_id" defaultValue={cur} inputMode="numeric" pattern="[1-9][0-9]{5,11}" maxLength={12} required disabled={locked} className={input} />
            </label>
            {locked ? <span className="text-xs text-white/50">{t.lockedHint}</span> : (
              <button type="submit" disabled={pending} className="rounded btn-primary px-3 py-2 text-xs disabled:opacity-50">{pending ? t.saving : t.save}</button>
            )}
          </form>
        );
      })}
      <Msg state={state} />
    </section>
  );
}
