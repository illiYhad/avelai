"use client";

import { useActionState } from "react";
import { Msg } from "@/components/tournaments/ui";
import type { RegState } from "./actions";

const initial: RegState = { ok: false, message: "" };

export function RegisterForm({ action, teams }: { action: (prev: RegState, f: FormData) => Promise<RegState>; teams: { id: string; name: string; tag: string }[] }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className="text-sm text-white/80">เลือกทีม (เฉพาะทีมที่คุณเป็นหัวหน้าและเล่นเกมนี้)</label>
      <select name="team_id" required className="rounded border border-white/20 bg-[#12121A] px-3 py-2 text-sm text-white">
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name} [{t.tag}]</option>)}
      </select>
      <button type="submit" disabled={pending} className="rounded bg-gold px-4 py-2 text-sm font-semibold text-void disabled:opacity-50">{pending ? "กำลังสมัคร…" : "สมัครแข่ง"}</button>
      <Msg state={state} />
    </form>
  );
}

export function SlipForm({ action, registrationId, token }: { action: (prev: RegState, f: FormData) => Promise<RegState>; registrationId: string; token: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="registration_id" value={registrationId} />
      <input type="hidden" name="idempotency" value={token} />
      <label className="text-sm text-white/80">อัปโหลดสลิป (JPEG/PNG/WebP · ≤ 5 MB)</label>
      <input type="file" name="slip" accept="image/jpeg,image/png,image/webp" required className="text-xs text-white/80" />
      <button type="submit" disabled={pending} className="rounded bg-gold px-4 py-2 text-sm font-semibold text-void disabled:opacity-50">{pending ? "กำลังส่ง…" : "ส่งสลิป"}</button>
      <Msg state={state} />
    </form>
  );
}
