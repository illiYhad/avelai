"use client";

import { useActionState } from "react";
import { ActionButton, DecisionForm, Msg } from "@/components/tournaments/ui";
import { STATUS_LABEL, type TournamentStatus } from "@/lib/tournament/state";
import type { OrgState } from "../actions";

const initial: OrgState = { ok: false, message: "" };

export function StatusButtons({ next, setStatus }: { next: TournamentStatus[]; setStatus: (to: string) => Promise<OrgState> }) {
  if (!next.length) return <p className="text-sm text-white/60">สถานะสุดท้ายแล้ว</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((s) => (
        <ActionButton key={s} action={() => setStatus(s)} label={`→ ${STATUS_LABEL[s]}`} confirmText={s === "CANCELLED" ? "ยกเลิกทัวร์นี้? ย้อนกลับไม่ได้" : s === "CHECK_IN" ? "เข้าช่วงเช็กอิน — ระบบจะ snapshot roster ของทีมที่ยืนยันแล้ว" : undefined} />
      ))}
    </div>
  );
}

export function PaymentReview({ review }: { review: (decision: "VERIFIED" | "REJECTED", reason: string) => Promise<OrgState> }) {
  return <DecisionForm review={review} />;
}

export function StaffForm({ action }: { action: (prev: OrgState, f: FormData) => Promise<OrgState> }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-xs text-white/70">username<input name="username" required className="rounded border border-white/20 bg-[#12121A] px-2 py-1 text-sm text-white" /></label>
      <label className="flex flex-col text-xs text-white/70">บทบาท
        <select name="role" className="rounded border border-white/20 bg-[#12121A] px-2 py-1 text-sm text-white"><option value="REFEREE">ผู้ตัดสิน</option><option value="STAFF">staff</option></select>
      </label>
      <button type="submit" disabled={pending} className="rounded border border-white/30 px-3 py-1.5 text-sm text-white/90 disabled:opacity-50">เพิ่ม</button>
      <Msg state={state} />
    </form>
  );
}
