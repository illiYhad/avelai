"use client";

// ปุ่มล็อก roster — เรียก lockRosterAction (ยกตรรกะจาก Zodiac actions/team.ts)
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockRosterAction } from "@/app/[game]/teams/actions";

export function LockRosterButton({ teamId, locked }: { teamId: string; locked: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (locked) {
    return <span className="text-xs font-mono text-gold">🔒 ROSTER LOCKED</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const res = await lockRosterAction(teamId);
            if ("error" in res) setMessage(res.error.message);
            else router.refresh();
          })
        }
        className="rounded border border-gold px-4 py-2 text-xs font-bold text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {isPending ? "กำลังล็อก..." : "🔒 ล็อก Roster"}
      </button>
      {message && <p className="text-xs text-rose-300 text-right max-w-60">{message}</p>}
    </div>
  );
}
