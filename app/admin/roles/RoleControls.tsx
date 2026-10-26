"use client";

import { useActionState, useState } from "react";
import { grantRole, revokeRole, type RoleActionState } from "./actions";

const initialState: RoleActionState = { ok: false, message: "" };

// K-AV-FIX2: เหตุผลบังคับ + ยืนยัน 2 ขั้น (กดครั้งแรก = แสดงสรุป · กดยืนยัน = ส่งจริง)
// ตัวเลือก role มาจาก server (grantableRoles) — ADMIN ไม่เห็น ADMIN/SUPER_ADMIN

export function GrantForm({ userId, username, roles }: { userId: string; username: string; roles: string[] }) {
  const [state, formAction, pending] = useActionState(grantRole, initialState);
  const [role, setRole] = useState(roles[0] ?? "");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const ready = role !== "" && reason.trim() !== "";
  return (
    <form action={(fd) => { setConfirming(false); formAction(fd); }} className="flex flex-col gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="role"
          value={role}
          onChange={(e) => { setRole(e.target.value); setConfirming(false); }}
          className="rounded border border-white/20 bg-void px-2 py-1 text-sm text-white"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          name="reason"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setConfirming(false); }}
          placeholder="เหตุผล (บังคับ)"
          required
          className="min-w-0 flex-1 rounded border border-white/20 bg-transparent px-2 py-1 text-sm text-white outline-none focus:border-gold"
        />
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
          <span>
            ยืนยันให้ <b className="text-gold">{role}</b> แก่ {username}?
          </span>
          <button type="submit" disabled={pending} className="rounded bg-gold px-2 py-1 font-semibold text-void disabled:opacity-50">
            ยืนยัน
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded border border-white/20 px-2 py-1">
            ยกเลิก
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!ready || pending}
          onClick={() => setConfirming(true)}
          className="self-start rounded bg-gold px-2 py-1 text-sm font-semibold text-void disabled:opacity-50"
        >
          ให้สิทธิ์
        </button>
      )}
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-cyan" : "text-red-400"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function RevokeForm({ roleRowId, role, username }: { roleRowId: string; role: string; username: string }) {
  const [state, formAction, pending] = useActionState(revokeRole, initialState);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-red-400/50 px-2 py-0.5 text-xs text-red-300"
        >
          ถอน
        </button>
        {state.message ? (
          <span className={`text-xs ${state.ok ? "text-cyan" : "text-red-400"}`}>{state.message}</span>
        ) : null}
      </span>
    );
  }
  return (
    <form
      action={(fd) => { setConfirming(false); setOpen(false); formAction(fd); }}
      className="flex w-full flex-wrap items-center gap-2"
    >
      <input type="hidden" name="role_row_id" value={roleRowId} />
      <input
        name="reason"
        value={reason}
        onChange={(e) => { setReason(e.target.value); setConfirming(false); }}
        placeholder="เหตุผลที่ถอน (บังคับ)"
        required
        className="min-w-0 flex-1 rounded border border-white/20 bg-transparent px-2 py-0.5 text-xs text-white outline-none focus:border-gold"
      />
      {confirming ? (
        <>
          <span className="text-xs text-white/80">ยืนยันถอน {role} ของ {username}?</span>
          <button type="submit" disabled={pending} className="rounded bg-red-500/80 px-2 py-0.5 text-xs font-semibold text-white disabled:opacity-50">
            ยืนยันถอน
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={reason.trim() === ""}
          onClick={() => setConfirming(true)}
          className="rounded border border-red-400/50 px-2 py-0.5 text-xs text-red-300 disabled:opacity-50"
        >
          ถอน
        </button>
      )}
      <button type="button" onClick={() => { setOpen(false); setConfirming(false); }} className="text-xs text-white/60">
        ยกเลิก
      </button>
    </form>
  );
}
