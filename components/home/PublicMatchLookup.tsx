"use client";

import { useState } from "react";
import { defaultLocale, dict, type Locale } from "@/lib/i18n";
import { fill } from "@/lib/home/time-label";
import type { PublicMatch, PublicMatchErrorCode, PublicMatchPlayer } from "@/lib/dota/public-match";
import { lookupPublicMatch } from "@/lib/dota/public-match-client";

// K-AV-HOME.0: ช่อง Match ID + ผลสรุปแมตช์ (คนไม่ล็อกอิน) · เรียกเส้นสาธารณะ /api/public/dota2/match/[id] เท่านั้น
// ข้อความทุกคำจาก dict(locale).publicHome · ชื่อผู้เล่น/ฮีโร่มาจาก OpenDota ไม่แปล

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; code: PublicMatchErrorCode }
  | { kind: "done"; match: PublicMatch };

export function errorText(t: ReturnType<typeof dict>["publicHome"], code: PublicMatchErrorCode): string {
  return code === "invalid" ? t.errInvalid : code === "not_found" ? t.errNotFound : code === "rate_limited" ? t.errRate : t.errUpstream;
}

const dash = (v: number | null) => (v === null ? "–" : String(v));
export const scoreText = (v: number | null) => (v === null ? "–" : v.toFixed(2));
export function durationText(sec: number | null): string {
  if (sec === null) return "–";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function PublicMatchLookup({ locale = defaultLocale, initial = { kind: "idle" } }: { locale?: Locale; initial?: State }) {
  const t = dict(locale).publicHome;
  const [id, setId] = useState("");
  const [state, setState] = useState<State>(initial);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "loading" });
    const r = await lookupPublicMatch(id);
    setState(r.ok ? { kind: "done", match: r.match } : { kind: "error", code: r.code });
  }

  return (
    <section data-section="public-match" aria-labelledby="public-match-title" className="hud-panel flex flex-col gap-5 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="public-match-title" className="hud-title text-xl text-ink sm:text-2xl">{t.title}</h2>
        <p className="text-sm text-ink-muted">{t.intro}</p>
      </div>
      <form onSubmit={lookup} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-xs tracking-[0.15em] text-ink-muted">{t.label}</span>
          <input
            name="matchId"
            inputMode="numeric"
            autoComplete="off"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={t.placeholder}
            className="min-h-11 w-full rounded-md border border-line bg-white/[0.03] px-3 py-2 font-numeric text-base text-ink outline-none focus:border-gold"
          />
        </label>
        <button type="submit" disabled={state.kind === "loading"} className="btn-primary min-h-11 rounded-md px-6 font-display tracking-[0.1em] disabled:opacity-50">
          {state.kind === "loading" ? t.loading : t.submit}
        </button>
      </form>
      <div aria-live="polite">
        {state.kind === "idle" ? <p data-state="idle" className="text-sm text-ink-muted">{t.empty}</p> : null}
        {state.kind === "loading" ? <p data-state="loading" className="text-sm text-ink-muted">{t.loading}</p> : null}
        {state.kind === "error" ? (
          <p data-state="error" data-code={state.code} role="alert" className="rounded-md bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {errorText(t, state.code)}
          </p>
        ) : null}
        {state.kind === "done" ? <MatchResult match={state.match} t={t} /> : null}
      </div>
    </section>
  );
}

function MatchResult({ match, t }: { match: PublicMatch; t: ReturnType<typeof dict>["publicHome"] }) {
  const sides = [
    { radiant: true, label: t.radiant, score: match.radiantScore },
    { radiant: false, label: t.dire, score: match.direScore },
  ];
  const picks = [...match.picksBans].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <div data-state="done" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span className="font-mono text-cyan">{fill(t.matchLabel, { id: match.matchId })}</span>
        <span>
          {t.duration} <span className="font-numeric text-ink">{durationText(match.duration)}</span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sides.map((s) => {
          const won = match.radiantWin === null ? null : match.radiantWin === s.radiant;
          const rows = match.players.filter((p) => p.isRadiant === s.radiant);
          return (
            <div key={s.label} data-side={s.radiant ? "radiant" : "dire"} className="min-w-0 rounded-lg border border-line">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <span className={`font-display tracking-[0.1em] ${s.radiant ? "text-emerald-200" : "text-rose-200"}`}>{s.label}</span>
                <span className="flex items-center gap-2">
                  {won ? <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">{t.win}</span> : null}
                  <span className="font-numeric text-lg text-ink">{dash(s.score)}</span>
                </span>
              </div>
              <ul className="flex flex-col">
                <li aria-hidden className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-3 py-1 font-mono text-xs tracking-[0.1em] text-ink-muted">
                  <span>{t.player} · {t.hero}</span>
                  <span className="w-16 text-right">{t.kda}</span>
                  <span className="w-12 text-right">{t.score}</span>
                </li>
                {rows.map((p, i) => (
                  <PlayerRow key={`${s.label}-${i}`} p={p} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-mono text-xs tracking-[0.15em] text-ink-muted">{t.picksBans}</h3>
        {picks.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.noPicksBans}</p>
        ) : (
          <ul data-picks-bans className="flex flex-wrap gap-1.5">
            {picks.map((x, i) => (
              <li
                key={i}
                className={`rounded px-2 py-0.5 text-xs ${x.isPick ? "bg-cyan/15 text-cyan" : "bg-white/5 text-ink-muted line-through"}`}
                title={x.isPick ? t.pick : t.ban}
              >
                {x.team === 0 ? "R" : x.team === 1 ? "D" : "–"} · {x.hero}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        {t.scoreNote} · {t.source}
      </p>
    </div>
  );
}

function PlayerRow({ p }: { p: PublicMatchPlayer }) {
  return (
    <li data-player className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line/60 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-ink">{p.name}</span>
          <span className="truncate text-xs text-ink-muted">{p.hero}</span>
        </span>
      </span>
      <span className="w-16 text-right font-numeric text-ink">
        {dash(p.kills)}/{dash(p.deaths)}/{dash(p.assists)}
      </span>
      <span className="w-12 text-right font-numeric text-gold">{scoreText(p.matchScore)}</span>
    </li>
  );
}
