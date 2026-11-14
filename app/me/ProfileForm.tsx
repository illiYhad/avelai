"use client";
import { dict, type Locale } from "@/lib/i18n";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "./actions";

const initialState: ProfileState = { ok: false, message: "" };

export default function ProfileForm({
  username,
  avatarUrl,
  locale = "th",
}: {
  username: string;
  avatarUrl: string;
  locale?: Locale;
}) {
  const t = dict(locale).me; // K-AV-R2.6
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <label htmlFor="username" className="text-sm text-white/80">
        {t.usernameLabel}
      </label>
      <input
        id="username"
        name="username"
        defaultValue={username}
        required
        className="rounded border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-gold"
      />
      <label htmlFor="avatar_url" className="text-sm text-white/80">
        {t.avatarLabel}
      </label>
      <input
        id="avatar_url"
        name="avatar_url"
        defaultValue={avatarUrl}
        placeholder="https://…"
        className="rounded border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded btn-primary px-4 py-2 disabled:opacity-50"
      >
        {pending ? t.saving : t.save}
      </button>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-cyan" : "text-red-400"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
