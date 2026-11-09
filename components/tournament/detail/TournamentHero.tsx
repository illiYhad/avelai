// K-AV-TOUR.1: หัวทัวร์ — แบนเนอร์ไล่สีกรมท่า + HUD (ไม่มีรูปทัวร์ในตาราง → ไม่มี <img>) · นาฬิกา · ปุ่มหลักปุ่มเดียว
import Link from "next/link";
import type { GameSlug } from "@/lib/games";
import { routes } from "@/lib/routes";
import type { PrimaryCta } from "@/lib/tournament/detail/cta";
import StatusBadge from "@/components/ui/StatusBadge";
import GameTag from "@/components/ui/GameTag";
import { tournamentBadge } from "@/lib/tournament/badge";
import Countdown from "./Countdown";

export const ORGANIZER_FALLBACK = "ผู้จัด";

export default function TournamentHero({
  slug, name, status, format, bestOf, teamSize, startAt, serverNow, organizer, cta,
}: {
  slug: GameSlug;
  name: string;
  status: string;
  format: string;
  bestOf: number;
  teamSize: number;
  startAt: string | null;
  serverNow: number;
  organizer: string | null;
  cta: PrimaryCta | null;
}) {
  return (
    <section
      data-tour="hero"
      className="relative overflow-hidden rounded-xl border border-hud-edge bg-[linear-gradient(135deg,#0c2347_0%,#0a1630_45%,#0B0E14_100%)] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]"
    >
      {/* HUD: เส้นตาราง + แสงมุม (ตกแต่งอย่างเดียว) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:linear-gradient(120deg,black,transparent_75%)]" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />

      <div className="relative flex flex-col gap-5 p-5 sm:p-8">
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 font-mono text-xs tracking-[0.12em] text-ink-muted">
          <span>{organizer ?? ORGANIZER_FALLBACK}</span>
          <span aria-hidden>›</span>
          <Link href={routes.tournaments(slug)} className="underline-offset-4 hover:text-cyan hover:underline">ทัวร์นาเมนต์</Link>
        </nav>

        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.2em] text-cyan">{`// ${format} BO${bestOf} · ${teamSize}v${teamSize}`}</p>
          <h1 className="break-words font-display text-2xl font-bold leading-tight tracking-[0.04em] text-ink sm:text-4xl">{name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <GameTag game={slug} />
            <StatusBadge status={tournamentBadge(status)} />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div data-tour="countdown" className="min-h-[3rem]">
            <Countdown status={status} startAt={startAt} serverNow={serverNow} />
          </div>
          {cta ? (
            <Link
              data-tour="cta"
              data-cta="primary"
              href={cta.href}
              className={`${cta.kind === "register" ? "btn-primary" : "btn-ghost"} flex h-12 w-full items-center justify-center rounded px-6 font-display tracking-[0.08em] sm:w-fit`}
            >
              {cta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
