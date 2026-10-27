"use client";

import { useActionState, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GAMES, gameFromSlug, slugOf } from "@/lib/games";
import { BEST_OF, ENTRY_LABEL, ENTRY_TYPES, FORMAT_LABEL, TOURNAMENT_FORMATS } from "@/lib/tournament/state";
import { Msg } from "@/components/tournaments/ui";
import type { OrgState } from "./actions";
import { routes } from "@/lib/routes";

const initial: OrgState = { ok: false, message: "" };
const input = "rounded border border-white/20 bg-[#12121A] px-3 py-2 text-sm text-white";
const toLocal = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export type TournamentFormValues = {
  name?: string; game?: string; format?: string; team_size?: number; best_of?: number; check_in_minutes?: number; max_teams?: number | null;
  entry_type?: string; entry_fee_thb?: number | string; promptpay_id?: string | null; rules?: string | null;
  reg_open_at?: string | null; reg_close_at?: string | null; start_at?: string | null;
};

export function TournamentForm({ action, values = {}, submitLabel }: { action: (prev: OrgState, f: FormData) => Promise<OrgState>; values?: TournamentFormValues; submitLabel: string }) {
  const router = useRouter();
  const code = gameFromSlug(useParams<{ game: string }>().game); // layout กัน slug แปลกไว้แล้ว
  const [state, formAction, pending] = useActionState(async (prev: OrgState, f: FormData) => {
    const r = await action(prev, f);
    if (r.ok && r.id && code) router.push(routes.organizerTournament(slugOf(code), r.id));
    return r;
  }, initial);
  const [entry, setEntry] = useState(values.entry_type ?? "FREE");
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col text-xs text-white/70 sm:col-span-2">ชื่อทัวร์ *<input name="name" required minLength={3} maxLength={80} defaultValue={values.name} className={input} /></label>
      <label className="flex flex-col text-xs text-white/70">เกม *
        <select name="game" defaultValue={values.game ?? "MLBB"} className={input}>{Object.entries(GAMES).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}</select>
      </label>
      <label className="flex flex-col text-xs text-white/70">รูปแบบ *
        <select name="format" defaultValue={values.format ?? "SE"} className={input}>{TOURNAMENT_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}</select>
      </label>
      <label className="flex flex-col text-xs text-white/70">ขนาดทีม<input name="team_size" type="number" min={1} max={10} defaultValue={values.team_size ?? 5} className={input} /></label>
      <label className="flex flex-col text-xs text-white/70">Best of
        <select name="best_of" defaultValue={values.best_of ?? 1} className={input}>{BEST_OF.map((b) => <option key={b} value={b}>{b}</option>)}</select>
      </label>
      <label className="flex flex-col text-xs text-white/70">เปิดรับสมัคร<input name="reg_open_at" type="datetime-local" defaultValue={toLocal(values.reg_open_at)} className={input} /></label>
      <label className="flex flex-col text-xs text-white/70">ปิดรับสมัคร<input name="reg_close_at" type="datetime-local" defaultValue={toLocal(values.reg_close_at)} className={input} /></label>
      <label className="flex flex-col text-xs text-white/70">เริ่มแข่ง<input name="start_at" type="datetime-local" defaultValue={toLocal(values.start_at)} className={input} /></label>
      <label className="flex flex-col text-xs text-white/70">เช็กอินก่อนเริ่ม (นาที)<input name="check_in_minutes" type="number" min={5} max={240} defaultValue={values.check_in_minutes ?? 30} className={input} /></label>
      <label className="flex flex-col text-xs text-white/70">ทีมสูงสุด (ว่าง = ไม่จำกัด)<input name="max_teams" type="number" min={2} max={256} defaultValue={values.max_teams ?? ""} className={input} /></label>
      <label className="flex flex-col text-xs text-white/70">ค่าเข้า *
        <select name="entry_type" value={entry} onChange={(e) => setEntry(e.target.value)} className={input}>{ENTRY_TYPES.map((e) => <option key={e} value={e}>{ENTRY_LABEL[e]}</option>)}</select>
      </label>
      {entry === "PAID" ? (
        <>
          <label className="flex flex-col text-xs text-white/70">ค่าเข้า (บาท/ทีม) *<input name="entry_fee_thb" type="number" min={1} step="0.01" defaultValue={values.entry_fee_thb ?? ""} className={input} /></label>
          <label className="flex flex-col text-xs text-white/70">PromptPay ID ของผู้จัด * (เบอร์/เลข 13 หลัก/e-Wallet)<input name="promptpay_id" defaultValue={values.promptpay_id ?? ""} className={input} /></label>
        </>
      ) : null}
      <label className="flex flex-col text-xs text-white/70 sm:col-span-2">กติกา<textarea name="rules" rows={4} maxLength={5000} defaultValue={values.rules ?? ""} className={input} /></label>
      <div className="sm:col-span-2 flex flex-col gap-2">
        <button type="submit" disabled={pending} className="w-fit rounded btn-primary px-4 py-2 text-sm disabled:opacity-50">{pending ? "กำลังบันทึก…" : submitLabel}</button>
        <Msg state={state} />
      </div>
    </form>
  );
}
