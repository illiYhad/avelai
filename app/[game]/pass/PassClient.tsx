"use client";

import { useActionState } from "react";
import { GAMES } from "@/lib/games";
import { Msg } from "@/components/tournaments/ui";
import type { PassState } from "./actions";

const initial: PassState = { ok: false, message: "" };

export type PassMonthOption = { value: string; label: string };

// K-AV-PASS.2 (ซอง 026): วันที่ 1 ต้องเลือกชัดก่อนอัปสลิป · ข้อความตามมติตรงตัว
export const PREV_MONTH_CHOICE = "Pass เดือนก่อนหน้า (การ์ด Immortal + ดูข้อมูลย้อนหลัง · ไม่ได้ตั๋วรายวัน)";
export const CURRENT_MONTH_CHOICE = "Pass เดือนปัจจุบัน";

function MonthPicker({ months }: { months: PassMonthOption[] }) {
  if (months.length === 1) {
    return (
      <>
        <input type="hidden" name="pass_month" value={months[0].value} />
        <p className="text-sm text-white/90" data-pass-month={months[0].value}>Pass เดือน {months[0].label}</p>
      </>
    );
  }
  const [prev, current] = months;
  return (
    <fieldset className="flex flex-col gap-2" data-pass-month-choice>
      <legend className="mb-1 text-sm text-white/80">เลือก Pass ที่จะซื้อ (ต้องเลือกก่อนอัปสลิป)</legend>
      {[{ o: prev, text: PREV_MONTH_CHOICE }, { o: current, text: CURRENT_MONTH_CHOICE }].map(({ o, text }) => (
        <label key={o.value} className="flex items-start gap-2 rounded border border-white/15 p-3 text-sm text-white/90">
          <input type="radio" name="pass_month" value={o.value} required className="mt-1" />
          <span>{text} <span className="text-white/60">· {o.label}</span></span>
        </label>
      ))}
    </fieldset>
  );
}

export function PassSlipForm({ action, token, months }: { action: (prev: PassState, f: FormData) => Promise<PassState>; token: string; months: PassMonthOption[] }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="idempotency" value={token} />
      <MonthPicker months={months} />
      <label className="text-sm text-white/80">เกม</label>
      <select name="game" className="rounded border border-white/20 bg-[#12121A] px-3 py-2 text-sm text-white">{Object.entries(GAMES).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}</select>
      <label className="text-sm text-white/80">อัปโหลดสลิป (JPEG/PNG/WebP · ≤ 5 MB)</label>
      <input type="file" name="slip" accept="image/jpeg,image/png,image/webp" required className="text-xs text-white/80" />
      <button type="submit" disabled={pending} className="rounded btn-primary px-4 py-2 text-sm disabled:opacity-50">{pending ? "กำลังส่ง…" : "ส่งสลิป"}</button>
      <Msg state={state} />
    </form>
  );
}
