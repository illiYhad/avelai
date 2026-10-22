"use client";

import { useActionState } from "react";
import { grantRole, revokeRole, type RoleActionState } from "./actions";

const initialState: RoleActionState = { ok: false, message: "" };

const ROLES = ["PLAYER", "ORGANIZER", "REFEREE", "ADMIN"] as const;

export function GrantForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(grantRole, initialState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="role"
        className="rounded border border-white/20 bg-void px-2 py-1 text-sm text-white"
        defaultValue="PLAYER"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gold px-2 py-1 text-sm font-semibold text-void disabled:opacity-50"
      >
        ให้สิทธิ์
      </button>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-cyan" : "text-red-400"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function RevokeForm({ roleRowId }: { roleRowId: string }) {
  const [state, formAction, pending] = useActionState(revokeRole, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="role_row_id" value={roleRowId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-red-400/50 px-2 py-0.5 text-xs text-red-300 disabled:opacity-50"
      >
        ถอน
      </button>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-cyan" : "text-red-400"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
