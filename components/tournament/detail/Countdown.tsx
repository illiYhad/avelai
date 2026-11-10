"use client";
// K-AV-TOUR.1: นาฬิกานับถอยหลังจาก start_at — SSR ใช้ now ของ server แล้ว client เดินต่อทุกวินาที
import { useEffect, useState } from "react";
import { COUNTDOWN_LIVE, COUNTDOWN_PREFIX, COUNTDOWN_SOON, COUNTDOWN_UNSET, countdownView } from "@/lib/tournament/detail/countdown";

export default function Countdown({ status, startAt, serverNow }: { status: string; startAt: string | null; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  const ticking = status === "REGISTRATION" || status === "CHECK_IN";
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ticking]);

  const v = countdownView(status, startAt, now);
  if (v.kind === "none") return null;
  if (v.kind === "live") {
    return (
      <p className="flex items-center gap-2 font-display text-lg tracking-[0.12em] text-rose-200">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-rose-400 motion-safe:animate-pulse" />
        {COUNTDOWN_LIVE}
      </p>
    );
  }
  if (v.kind === "unset") return <p className="text-sm text-ink-muted">{COUNTDOWN_UNSET}</p>;
  if (v.kind === "soon") return <p className="font-display text-lg tracking-[0.12em] text-gold">{COUNTDOWN_SOON}</p>;
  return (
    <p className="flex flex-col gap-0.5" aria-live="off">
      <span className="font-mono text-xs tracking-[0.2em] text-ink-muted">{`// ${COUNTDOWN_PREFIX}`}</span>
      <span suppressHydrationWarning data-countdown className="font-display text-3xl tabular-nums tracking-[0.08em] text-gold sm:text-4xl">
        {v.text}
      </span>
    </p>
  );
}
