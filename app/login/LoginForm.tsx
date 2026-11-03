"use client";

import { useActionState } from "react";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

const initialState: LoginState = { ok: false, message: "" };

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);
  const [gState, gAction, gPending] = useActionState(signInWithGoogle, initialState);

  if (state.ok) {
    return (
      <p className="rounded border border-cyan/40 px-4 py-3 text-sm text-cyan">
        {state.message}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* K-AV-AUTH-G: ปุ่มรอง (ขอบ 1px) · ไอคอน G เป็น SVG ในโค้ด ไม่โหลดจากภายนอก */}
      <form action={gAction} className="flex flex-col gap-2">
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          disabled={gPending}
          className="btn-ghost flex min-h-12 w-full items-center justify-center gap-3 rounded-md px-4 py-2 text-base disabled:opacity-50"
        >
          <GoogleIcon />
          {gPending ? "กำลังพาไป Google…" : "เข้าสู่ระบบด้วย Google"}
        </button>
        {gState.message ? (
          <p role="alert" className="text-sm text-white/70">
            {gState.message}
          </p>
        ) : null}
      </form>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-sm text-ink-muted">หรือ</span>
        <span className="h-px flex-1 bg-line" />
      </div>

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
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
