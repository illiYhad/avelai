"use client";

import { useActionState, useEffect, useState } from "react";
import { dict, type Locale } from "@/lib/i18n";
import { newPlayerAction, sendCodeAction, verifyCodeAction, type ChooseState } from "./actions";

// K-AV-STEAMLOGIN.2: หน้าเลือกหลังล็อกอิน Steam ครั้งแรก — มี 2 ปุ่มเท่านั้น
// ก. ผู้เล่นใหม่ (สร้างบัญชี) · ข. มีบัญชีอยู่แล้ว (ยืนยันอีเมลด้วยรหัส 6 หลัก แล้วผูก Steam เข้าบัญชีเดิม)
const initial: ChooseState = { ok: false, message: "" };
const RESEND_SEC = 60;
const INPUT = "min-h-11 rounded-md border border-line bg-white/[0.03] px-3 py-2 text-base text-ink outline-none focus:border-gold";
const LABEL = "font-mono text-sm tracking-[0.15em] text-ink-muted";

export default function ChooseForm({ locale = "th" }: { locale?: Locale }) {
  const t = dict(locale).login; // K-AV-R2.7
  const [mode, setMode] = useState<"pick" | "existing">("pick");
  const [newState, newAction, newPending] = useActionState(newPlayerAction, initial);
  const [wait, setWait] = useState(0);
  // กันกดส่งรหัสรัว: นับถอยหลัง 60 วินาทีหลังส่งแต่ละครั้ง (ฝั่ง server มี cookie กันซ้ำอีกชั้น)
  const [sendState, sendAction, sendPending] = useActionState(async (prev: ChooseState, formData: FormData) => {
    const result = await sendCodeAction(prev, formData);
    if (result.step === "code") setWait(RESEND_SEC);
    return result;
  }, initial);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyCodeAction, initial);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (mode === "pick") {
    return (
      <div className="flex w-full flex-col gap-4">
        <form action={newAction} className="flex flex-col gap-2">
          <button type="submit" disabled={newPending} className="btn-ghost flex min-h-12 w-full items-center justify-center rounded-md px-4 py-2 text-base disabled:opacity-50">
            {newPending ? t.chooseCreating : t.chooseNewPlayer}
          </button>
          <p className="text-sm text-ink-muted">{t.chooseNewPlayerHint}</p>
          {newState.message ? <p role="alert" className="text-sm text-white/70">{newState.message}</p> : null}
        </form>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setMode("existing")} className="btn-ghost flex min-h-12 w-full items-center justify-center rounded-md px-4 py-2 text-base">
            {t.chooseHaveAccount}
          </button>
          <p className="text-sm text-ink-muted">{t.chooseHaveAccountHint}</p>
        </div>
      </div>
    );
  }

  const email = sendState.email ?? "";
  const codeStep = sendState.step === "code" && email !== "";

  return (
    <div className="flex w-full flex-col gap-4">
      <form action={sendAction} className="flex w-full flex-col gap-3">
        <label htmlFor="choose-email" className={LABEL}>{t.chooseEmailLabel}</label>
        <input id="choose-email" name="email" type="email" required autoComplete="email" defaultValue={email} placeholder="you@example.com" className={INPUT} />
        <button type="submit" disabled={sendPending || wait > 0} className="btn-ghost flex min-h-12 w-full items-center justify-center rounded-md px-4 py-2 text-base disabled:opacity-50">
          {sendPending ? t.sending : wait > 0 ? t.chooseResendIn.replace("{s}", String(wait)) : codeStep ? t.chooseResend : t.chooseSendCode}
        </button>
        {sendState.message ? (
          <p role="status" className={sendState.ok ? "rounded border border-cyan/40 px-4 py-3 text-sm text-cyan" : "text-sm text-white/70"}>{sendState.message}</p>
        ) : null}
      </form>

      {codeStep ? (
        <form action={verifyAction} className="flex w-full flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <label htmlFor="choose-code" className={LABEL}>{t.chooseCodeLabel}</label>
          <input id="choose-code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" className={`${INPUT} font-mono tracking-[0.4em]`} />
          <button type="submit" disabled={verifyPending} className="btn-ghost flex min-h-12 w-full items-center justify-center rounded-md px-4 py-2 text-base disabled:opacity-50">
            {verifyPending ? t.chooseVerifying : t.chooseVerify}
          </button>
          {verifyState.message ? <p role="alert" className="text-sm text-white/70">{verifyState.message}</p> : null}
        </form>
      ) : null}

      <button type="button" onClick={() => setMode("pick")} className="min-h-11 self-start text-sm text-ink-muted underline">
        {t.chooseBack}
      </button>
    </div>
  );
}
