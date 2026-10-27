"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { ok: false, message: "" };

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.ok) {
    return (
      <p className="rounded border border-cyan/40 px-4 py-3 text-sm text-cyan">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="font-mono text-sm tracking-[0.15em] text-ink-muted">
        {"// อีเมล"}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="min-h-11 rounded-md border border-line bg-white/[0.03] px-3 py-2 text-base text-ink outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-primary mt-2 min-h-12 rounded-md px-4 py-2 font-display tracking-[0.1em] disabled:opacity-50"
      >
        {pending ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
      </button>
      {state.message ? (
        <p className="text-sm text-white/70">{state.message}</p>
      ) : null}
    </form>
  );
}
