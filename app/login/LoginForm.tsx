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
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-sm text-white/80">
        อีเมล
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="rounded border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded btn-primary px-4 py-2 disabled:opacity-50"
      >
        {pending ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
      </button>
      {state.message ? (
        <p className="text-sm text-white/70">{state.message}</p>
      ) : null}
    </form>
  );
}
