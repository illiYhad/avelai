// K-AV-TOUR.1: Timeline 4 จุด — แนวตั้งที่มือถือ · แนวนอนที่ ≥768 · past เขียว · current ทองเรือง · upcoming เทา
import { fmtBangkok, type TimelinePoint, type TimelineState } from "@/lib/tournament/detail/timeline";

const DOT: Record<TimelineState, string> = {
  past: "border-emerald-400 bg-emerald-400/80",
  current: "border-gold bg-gold shadow-[0_0_0_4px_rgba(201,168,76,0.25),0_0_18px_rgba(201,168,76,0.75)]",
  upcoming: "border-white/30 bg-surface-3",
  unset: "border-dashed border-white/25 bg-transparent",
};
const TEXT: Record<TimelineState, string> = {
  past: "text-emerald-200",
  current: "text-gold",
  upcoming: "text-ink-muted",
  unset: "text-ink-muted/70",
};
const LINE: Record<TimelineState, string> = {
  past: "bg-emerald-400/60",
  current: "bg-gradient-to-r from-gold/70 to-white/10 max-md:bg-gradient-to-b",
  upcoming: "bg-white/10",
  unset: "bg-white/10",
};

export default function Timeline({ points }: { points: TimelinePoint[] }) {
  return (
    <section data-tour="timeline" aria-label="Timeline" className="hud-panel relative rounded-xl p-4 sm:p-6">
      <h2 className="mb-4 font-mono text-sm tracking-[0.2em] text-ink-muted">{"// TIMELINE"}</h2>
      <ol className="flex flex-col md:flex-row">
        {points.map((p, i) => {
          const last = i === points.length - 1;
          return (
            <li key={p.key} data-state={p.state} className="relative flex gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:gap-2 md:pb-0">
              {/* เส้นเชื่อมไปจุดถัดไป */}
              {!last ? (
                <span aria-hidden className={`absolute left-[7px] top-5 h-[calc(100%-1rem)] w-0.5 md:left-5 md:top-[7px] md:h-0.5 md:w-[calc(100%-1rem)] ${LINE[p.state]}`} />
              ) : null}
              <span aria-hidden className={`relative z-10 mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 md:mt-0 ${DOT[p.state]}`} />
              <div className="flex flex-col md:pr-3">
                <span className={`text-sm font-semibold ${TEXT[p.state]}`}>
                  {p.label}
                  {p.state === "current" ? <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 font-mono text-xs tracking-[0.15em] text-gold">ตอนนี้</span> : null}
                </span>
                <span className="text-xs text-ink-muted">{fmtBangkok(p.at)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
