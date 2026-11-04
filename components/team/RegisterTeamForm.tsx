"use client";

// ปุ่มสมัครทัวร์ของทีม — เรียก registerTeamAction (เส้นสมัครฟรีจาก Zodiac)
import { useState, useTransition } from "react";
import { registerTeamAction } from "@/app/tournament/[tournamentId]/register/actions";

interface Props {
  tournamentId: string;
  teamId: string;
  teamLabel: string;
  existingStatus: string | null;
}

export function RegisterTeamForm({ tournamentId, teamId, teamLabel, existingStatus }: Props) {
  const [status, setStatus] = useState<string | null>(existingStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-white/10 bg-surface-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold truncate">{teamLabel}</p>
        {status ? (
          <span className="shrink-0 rounded bg-cyan/10 px-2 py-1 text-xs font-mono font-bold text-cyan">
            {status}
          </span>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await registerTeamAction(tournamentId, teamId);
                if ("error" in res) setError(res.error.message);
                else setStatus(res.status);
              })
            }
            className="shrink-0 rounded bg-cyan px-4 py-1.5 text-xs font-bold text-black hover:bg-cyan disabled:opacity-50"
          >
            {isPending ? "กำลังสมัคร..." : "สมัคร"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
