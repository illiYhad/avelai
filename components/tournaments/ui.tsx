"use client";

import { useState, useTransition } from "react";

// K-AV-3: ปุ่ม/ฟอร์มเล็กที่เรียก server action แล้วแสดงข้อความไทย (ใช้ซ้ำทั้งฝั่งผู้จัด/ผู้สมัคร/แอดมิน)
type Result = { ok: boolean; message: string };

export function Msg({ state }: { state: Result | null }) {
  if (!state?.message) return null;
  return <p className={`text-sm ${state.ok ? "text-cyan" : "text-red-400"}`}>{state.message}</p>;
}

/** ปุ่มเรียก action ที่ bind พารามิเตอร์ไว้แล้ว (ไม่มีฟอร์ม) · confirm ก่อนถ้าระบุ */
export function ActionButton({ action, label, confirmText, className }: { action: () => Promise<Result>; label: string; confirmText?: string; className?: string }) {
  const [state, setState] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => { if (confirmText && !window.confirm(confirmText)) return; start(async () => setState(await action())); }}
        className={className ?? "rounded border border-white/30 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"}
      >
        {pending ? "…" : label}
      </button>
      <Msg state={state} />
    </span>
  );
}

/** ยืนยัน/ปฏิเสธสลิป — ปฏิเสธต้องกรอกเหตุผล */
export function DecisionForm({ review }: { review: (decision: "VERIFIED" | "REJECTED", reason: string) => Promise<Result> }) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => start(async () => setState(await review("VERIFIED", "")))} className="rounded bg-gold px-3 py-1.5 text-sm font-semibold text-void disabled:opacity-50">
          ยืนยันสลิป
        </button>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลที่ปฏิเสธ (บังคับ)" className="min-w-0 flex-1 rounded border border-white/20 bg-transparent px-2 py-1 text-sm text-white" />
        <button type="button" disabled={pending || !reason.trim()} onClick={() => start(async () => setState(await review("REJECTED", reason)))} className="rounded border border-red-400/60 px-3 py-1.5 text-sm text-red-300 disabled:opacity-40">
          ปฏิเสธ
        </button>
      </div>
      <Msg state={state} />
    </div>
  );
}
