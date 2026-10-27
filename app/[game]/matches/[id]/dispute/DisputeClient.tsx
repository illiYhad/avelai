"use client";

import { useActionState } from "react";
import { Msg } from "@/components/tournaments/ui";
import type { DisputeState } from "./actions";

const initial: DisputeState = { ok: false, message: "" };

export function DisputeForm({ action }: { action: (p: DisputeState, f: FormData) => Promise<DisputeState> }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded border border-amber-300/30 p-4">
      <label className="text-xs text-white/70">เหตุผล (10–1000 ตัวอักษร) *
        <textarea name="reason" required minLength={10} maxLength={1000} rows={4} className="mt-1 w-full rounded border border-white/20 bg-[#12121A] px-3 py-2 text-sm text-white" />
      </label>
      <label className="text-xs text-white/70">หลักฐานเพิ่มเติม (JPEG/PNG/WebP · ≤5MB · ไม่เกิน 5 รูป · ไม่บังคับ)
        <input name="evidence" type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-1 block text-xs" />
      </label>
      <button type="submit" disabled={pending} className="w-fit rounded bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{pending ? "กำลังส่ง…" : "เปิดข้อพิพาท"}</button>
      <Msg state={state} />
      {state.warning ? <p className="text-sm text-amber-300">{state.warning}</p> : null}
    </form>
  );
}
