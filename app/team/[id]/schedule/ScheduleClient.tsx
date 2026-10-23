"use client";

// UI ตารางซ้อม: สร้างนัด (หัวหน้า) · RSVP (สมาชิก) · เช็กชื่อจริง (หัวหน้า) · สรุป % รายคน
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionAction, rsvpAction, checkAttendanceAction } from "./actions";
import type { MemberAttendanceStat } from "@/lib/team/attendance";

export interface SessionView {
  id: string;
  title: string | null;
  session_type: string;
  starts_at: string;
  ends_at: string | null;
  attendance: {
    user_id: string;
    username: string;
    rsvp: string;
    attended: boolean | null;
  }[];
}

interface Props {
  teamId: string;
  myUserId: string | null;
  isLeader: boolean;
  sessions: SessionView[];
  stats: (MemberAttendanceStat & { username: string })[];
}

const TYPE_LABEL: Record<string, string> = {
  SCRIM: "Scrim",
  SOLO_PRACTICE: "ซ้อมเอง",
  MEETING: "ประชุม",
};

export function ScheduleClient({ teamId, myUserId, isLeader, sessions, stats }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createSessionAction(teamId, formData);
      if ("error" in res) setError(res.error.message);
      else router.refresh();
    });
  }

  const inputCls =
    "rounded border border-white/15 bg-[#0A0A0F] px-2 py-1.5 text-xs text-white focus:border-[#00D4FF] focus:outline-none";

  return (
    <div className="flex flex-col gap-8">
      {isLeader && (
        <form onSubmit={onCreate} className="rounded-lg border border-white/10 bg-[#12121A] p-4 flex flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-wider text-[#00D4FF] uppercase">สร้างนัดซ้อม</p>
          <div className="flex flex-wrap gap-2">
            <input name="title" placeholder="หัวข้อ (ไม่บังคับ)" className={`${inputCls} flex-1 min-w-40`} />
            <select name="sessionType" className={inputCls} defaultValue="SCRIM">
              <option value="SCRIM">Scrim</option>
              <option value="SOLO_PRACTICE">ซ้อมเอง</option>
              <option value="MEETING">ประชุม</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-neutral-400">
              เริ่ม <input name="startsAt" type="datetime-local" required className={`${inputCls} ml-1`} />
            </label>
            <label className="text-xs text-neutral-400">
              จบ <input name="endsAt" type="datetime-local" className={`${inputCls} ml-1`} />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-[#00D4FF] px-4 py-1.5 text-xs font-bold text-black disabled:opacity-50"
            >
              {isPending ? "กำลังบันทึก..." : "+ สร้างนัด"}
            </button>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </form>
      )}

      <section>
        <h2 className="font-mono text-sm font-bold tracking-wider text-neutral-300 uppercase mb-3">
          นัดซ้อม ({sessions.length})
        </h2>
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => {
            const mine = s.attendance.find((a) => a.user_id === myUserId);
            return (
              <li key={s.id} className="rounded-lg border border-white/10 bg-[#12121A] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">
                      {TYPE_LABEL[s.session_type] ?? s.session_type}
                      {s.title ? ` · ${s.title}` : ""}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {new Date(s.starts_at).toLocaleString("th-TH")}
                      {s.ends_at ? ` – ${new Date(s.ends_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  </div>
                  {mine && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => startTransition(async () => { await rsvpAction(teamId, s.id, true); router.refresh(); })}
                        className={`rounded px-3 py-1 text-[10px] font-bold border ${mine.rsvp === "GOING" ? "bg-emerald-500/20 border-emerald-400 text-emerald-300" : "border-white/20 text-neutral-400"}`}
                      >
                        มา
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => startTransition(async () => { await rsvpAction(teamId, s.id, false); router.refresh(); })}
                        className={`rounded px-3 py-1 text-[10px] font-bold border ${mine.rsvp === "NOT_GOING" ? "bg-rose-500/20 border-rose-400 text-rose-300" : "border-white/20 text-neutral-400"}`}
                      >
                        ไม่มา
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-1">
                  {s.attendance.map((a) => (
                    <div key={a.user_id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        @{a.username}
                        <span className={`ml-2 font-mono ${a.rsvp === "GOING" ? "text-emerald-400" : a.rsvp === "NOT_GOING" ? "text-rose-400" : "text-neutral-500"}`}>
                          {a.rsvp === "GOING" ? "จะมา" : a.rsvp === "NOT_GOING" ? "ไม่มา" : "ยังไม่ตอบ"}
                        </span>
                      </span>
                      {isLeader ? (
                        <span className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => startTransition(async () => { await checkAttendanceAction(teamId, s.id, a.user_id, true); router.refresh(); })}
                            className={`rounded px-2 py-0.5 text-[10px] border ${a.attended === true ? "bg-emerald-500/20 border-emerald-400 text-emerald-300" : "border-white/20 text-neutral-500"}`}
                          >
                            ✓ มาจริง
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => startTransition(async () => { await checkAttendanceAction(teamId, s.id, a.user_id, false); router.refresh(); })}
                            className={`rounded px-2 py-0.5 text-[10px] border ${a.attended === false ? "bg-rose-500/20 border-rose-400 text-rose-300" : "border-white/20 text-neutral-500"}`}
                          >
                            ✗ ขาด
                          </button>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-mono text-neutral-500">
                          {a.attended === true ? "✓ มาจริง" : a.attended === false ? "✗ ขาด" : "—"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
          {sessions.length === 0 && <li className="text-sm text-neutral-500">ยังไม่มีนัดซ้อม</li>}
        </ul>
      </section>

      <section>
        <h2 className="font-mono text-sm font-bold tracking-wider text-neutral-300 uppercase mb-3">
          สรุป % เข้าซ้อมรายคน
        </h2>
        <ul className="flex flex-col gap-1">
          {stats.map((s) => (
            <li key={s.userId} className="flex items-center gap-3 text-xs">
              <span className="w-32 truncate">@{s.username}</span>
              <div className="flex-1 h-2 rounded bg-white/10 overflow-hidden">
                <div className="h-full bg-[#00D4FF]" style={{ width: `${s.percent}%` }} />
              </div>
              <span className="w-20 text-right font-mono">
                {s.percent}% ({s.attendedCount}/{s.checkedCount})
              </span>
            </li>
          ))}
          {stats.length === 0 && <li className="text-sm text-neutral-500">ยังไม่มีข้อมูลเช็กชื่อ</li>}
        </ul>
      </section>
    </div>
  );
}
