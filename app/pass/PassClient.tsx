"use client";

import { useActionState } from "react";
import { GAMES } from "@/lib/games";
import { Msg } from "@/components/tournaments/ui";
import type { PassState } from "./actions";

const initial: PassState = { ok: false, message: "" };

export function PassSlipForm({ action, token }: { action: (prev: PassState, f: FormData) => Promise<PassState>; token: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="idempotency" value={token} />
      <label className="text-sm text-white/80">เกม</label>
      <select name="game" className="rounded border border-white/20 bg-[#12121A] px-3 py-2 text-sm text-white">{Object.entries(GAMES).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}</select>
      <label className="text-sm text-white/80">อัปโหลดสลิป (JPEG/PNG/WebP · ≤ 5 MB)</label>
      <input type="file" name="slip" accept="image/jpeg,image/png,image/webp" required className="text-xs text-white/80" />
      <button type="submit" disabled={pending} className="rounded bg-gold px-4 py-2 text-sm font-semibold text-void disabled:opacity-50">{pending ? "กำลังส่ง…" : "ส่งสลิป"}</button>
      <Msg state={state} />
    </form>
  );
}
