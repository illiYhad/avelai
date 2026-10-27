"use client";

import { useActionState } from "react";
import { rerunPassportAction, type RerunState } from "./actions";

export function RerunForm() {
  const [state, action, pending] = useActionState<RerunState, FormData>(rerunPassportAction, { ok: false, message: "" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input name="match_id" placeholder="รหัสแมตช์ (uuid)" required className="w-80 rounded border border-white/20 bg-[#12121A] px-2 py-1 font-numeric text-white" />
      <button type="submit" disabled={pending} className="rounded btn-primary px-3 py-1.5 text-sm disabled:opacity-40">รันซ้ำ</button>
      {state.message ? <p className={state.ok ? "text-emerald-300" : "text-red-300"}>{state.message}</p> : null}
    </form>
  );
}
