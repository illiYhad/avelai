// K-AV-RULES.1 → K-AV-RULES.2: หน้ากติกา Ultimate Solo ยึดต้นแบบ 1:1 (หน้าตา + ฟังก์ชัน)
// ต้นแบบ: D:\Balehm_Studio\02_Products\AVELAi\01_Spec\REF_ultimate_solo_อัปเดต_2026-11-07.html
// static (● SSG) · ไม่อ่าน cookies/headers/searchParams · ไม่เรียก API · ข้อความทั้งหมดอยู่ที่ rules-content.ts
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { gameFromSlug, slugOf } from "@/lib/games";
import { routes } from "@/lib/routes";
import { SCORE_CONFIG } from "@/lib/avelai/score";
import { REF_VARS } from "./ref-theme";
import { snakeOrder } from "./snake";
import LiveSimulator from "./LiveSimulator";
import AveBox from "./AveBox";
import { isAveConfigured } from "@/lib/ave/config";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { FormatRadar, PenaltyBars, RoleDonut, ScoreStack } from "./RefCharts";
import {
  AVE, HEADER, HERO, HERO_CARDS, MATCHMAKING, RISK, SCORING, SECTIONS, STAGES, STRUCTURE, scoreCards,
} from "./rules-content";

export const metadata = { title: "กติกา Ultimate Solo · AVELAi" };

const card = "rounded-xl border border-[var(--ref-border)] bg-[var(--ref-card)]";

function SectionHead({ color, title, subtitle }: { color: string; title: string; subtitle: string }) {
  return (
    <div className="border-l-4 pl-4" style={{ borderColor: color }}>
      <h3 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h3>
      <p className="mt-1 text-sm text-[var(--ref-s400)]">{subtitle}</p>
    </div>
  );
}

export default async function RulesPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);

  if (slug !== "dota2") {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Surface glow="cyan" className="flex flex-col gap-3">
          <p className="text-base text-ink">กติกา MLBB เร็ว ๆ นี้</p>
          <Link href={routes.rules("dota2")} className="self-start text-sm text-cyan underline">ดูกติกา Dota 2 Ultimate Solo</Link>
        </Surface>
      </main>
    );
  }

  const [radiant, dire] = snakeOrder(10);
  const cards = scoreCards(SCORE_CONFIG);
  const row = (rank: number, team: 0 | 1, first: boolean) => {
    const label = rank === 1 ? "Rank #1 (Highest)" : rank === 10 ? "Rank #10 (Lowest)" : `Rank #${rank}`;
    const hi = team === 0 ? rank === 1 : rank <= 3;
    const bg = team === 0 ? (first ? "var(--ref-em-900)" : "var(--ref-em-900-20)") : (hi ? "var(--ref-rose-900)" : "var(--ref-rose-900-20)");
    const fg = hi ? (team === 0 ? "var(--ref-em300)" : "var(--ref-rose300)") : "var(--ref-s300)";
    return (
      <div key={rank} className="flex justify-between gap-2 rounded px-2 py-1" style={{ background: bg }}>
        <span>{label}</span>
        <span className="font-bold" style={{ color: fg }}>{MATCHMAKING.players[rank - 1]}</span>
      </div>
    );
  };

  return (
    <main style={REF_VARS} className="bg-[var(--ref-dark)] pb-16 font-sans text-[var(--ref-text)] [&_section]:scroll-mt-48 md:[&_section]:scroll-mt-36">
      {/* หัวหน้าแบบติดบน (:84–104) · ติดใต้ navbar (h-14 md:h-16) */}
      <header className="sticky top-14 z-40 border-b border-[var(--ref-border)] bg-[var(--ref-card-80)] backdrop-blur md:top-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-3 md:flex-row">
          <div className="flex items-center gap-3">
            {/* :87 โลโก้วงกลม (ใบเสริม 2) */}
            <Image src="/brand/rules/avelai-logo-256.png" alt="โลโก้ AVELAi" width={256} height={256} priority className="h-12 w-12 rounded-full border-2 border-[var(--ref-gold)] object-cover shadow-[var(--ref-glow-gold)]" />
            <div>
              <h1 className="bg-gradient-to-r from-[var(--ref-cyan)] to-[var(--ref-gold)] bg-clip-text font-display text-lg font-extrabold tracking-wider text-transparent md:text-2xl">{HEADER.title}</h1>
              <p className="font-mono text-xs tracking-widest text-[var(--ref-gold)]">{HEADER.motto}</p>
            </div>
          </div>
          <nav aria-label="หมวดกติกา" className="w-full overflow-x-auto md:w-auto" data-testid="rules-tabs">
            <div className="flex w-max gap-2 text-xs font-semibold">
              {SECTIONS.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={i === SECTIONS.length - 1
                    ? "flex items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--ref-gold-50)] bg-gradient-to-r from-[var(--ref-gold-50)] to-[var(--ref-cyan-50)] px-3 py-2 text-white"
                    : "whitespace-nowrap rounded-lg border border-[var(--ref-s700)] bg-[var(--ref-s800)] px-3 py-2 transition-all hover:bg-[var(--ref-dark)] hover:text-[var(--ref-cyan)]"}
                >
                  {s.tab}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <div className="mx-auto mt-8 max-w-7xl space-y-12 px-4">
        {/* Hero (:110–162) */}
        <section className="relative overflow-hidden rounded-2xl border border-[var(--ref-border)] bg-gradient-to-br from-[var(--ref-dark)] via-[var(--ref-card)] to-[var(--ref-dark)] p-6 shadow-2xl md:p-10">
          <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-[var(--ref-cyan-10)] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-72 w-72 rounded-full bg-[var(--ref-gold-10)] blur-3xl" />
          <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ref-cyan-30)] bg-[var(--ref-cyan-10)] px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[var(--ref-cyan)]">{HERO.badge}</div>
              <h2 className="font-display text-3xl font-black leading-tight text-white md:text-5xl">
                {HERO.title1}
                <br />
                <span className="bg-gradient-to-r from-[var(--ref-cyan)] to-[var(--ref-gold)] bg-clip-text text-transparent">{HERO.title2}</span>
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-[var(--ref-s300)] md:text-base">{HERO.intro}</p>
              <div className="grid grid-cols-2 gap-4 pt-4 md:grid-cols-4">
                {HERO_CARDS.map((c) => (
                  <div key={c.label} className="rounded-xl border border-[var(--ref-gold-30)] bg-[var(--ref-s800-80)] p-4 text-center">
                    <p className="text-xs font-medium uppercase text-[var(--ref-s400)]">{c.label}</p>
                    <p className="mt-1 text-lg font-black md:text-xl" style={{ color: c.color }}>{c.value}</p>
                    <p className="mt-0.5 text-xs text-[var(--ref-s500)]">{c.note}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* :153–161 รูปมาสคอต AVE (ผมสีเงิน · K-AV-RULES.3a แทนรูป AVEL ที่ตัดผิดตัว) + ไล่ดำจากล่าง + ป้าย AVE ONLINE */}
            <div className="relative lg:col-span-5">
              <div aria-hidden className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-t from-[var(--ref-dark)] via-transparent to-transparent" />
              <Image src="/brand/rules/ave-hero-900.jpg" alt="AVE มาสคอตประจำอารีนา" width={900} height={1273} priority sizes="(min-width: 1024px) 40vw, 100vw" className="h-auto w-full rounded-2xl border border-[var(--ref-gold-50)] object-cover shadow-[var(--ref-glow-gold)]" />
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-[var(--ref-cyan-50)] bg-[var(--ref-dark-90)] px-3 py-1.5">
                {/* K-AV-R2.2: ไม่มีคีย์ AVE → COMING SOON + จุดไม่กะพริบ */}
                <span className={`h-2 w-2 ${isAveConfigured() ? "animate-pulse " : ""}rounded-full bg-[var(--ref-cyan)]`} />
                <span className="font-mono text-xs font-bold tracking-wider text-[var(--ref-cyan)]">{isAveConfigured() ? HERO.online : HERO.onlineSoon}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 1. #structure (:167–215) */}
        <section id="structure" className="space-y-6">
          <SectionHead color="var(--ref-cyan400)" title={STRUCTURE.title} subtitle={STRUCTURE.subtitle} />
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <div className={`${card} p-6 shadow-[var(--ref-glow-cyan)] lg:col-span-7`}>
              <h4 className="mb-2 text-base font-semibold text-[var(--ref-cyan400)]">{STRUCTURE.chartTitle}</h4>
              <p className="mb-4 text-xs text-[var(--ref-s400)]">{STRUCTURE.chartNote}</p>
              <FormatRadar />
            </div>
            <div className="space-y-4 lg:col-span-5">
              {([[STRUCTURE.a, "var(--ref-cyan400)", "var(--ref-cyan-950)", "var(--ref-cyan-800)"], [STRUCTURE.b, "var(--ref-pink400)", "var(--ref-pink-950)", "var(--ref-pink-800)"]] as const).map(([b, c, bb, bd]) => (
                <div key={b.title} className="rounded-r-xl border-y border-r border-l-4 border-[var(--ref-border)] bg-[var(--ref-card)] p-5 shadow-lg" style={{ borderLeftColor: c }}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h5 className="text-lg font-bold" style={{ color: c }}>{b.title}</h5>
                    <span className="shrink-0 rounded border px-2 py-0.5 text-xs font-bold" style={{ background: bb, borderColor: bd, color: c }}>{b.badge}</span>
                  </div>
                  <ul className="list-inside list-disc space-y-2 text-xs text-[var(--ref-s300)]">
                    {b.items.map(([k, t]) => <li key={k}><strong className="text-white">{k}</strong> {t}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. #matchmaking (:218–293) */}
        <section id="matchmaking" className="space-y-6">
          <SectionHead color="var(--ref-blue)" title={MATCHMAKING.title} subtitle={MATCHMAKING.subtitle} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className={`${card} flex flex-col justify-between p-6`}>
              <h4 className="mb-2 text-base font-semibold text-[var(--ref-blue400)]">{MATCHMAKING.roleTitle}</h4>
              <p className="mb-4 text-xs text-[var(--ref-s400)]">{MATCHMAKING.roleBody}</p>
              <RoleDonut />
              <p className="mt-3 rounded bg-[var(--ref-s800-60)] p-2 text-center text-xs text-[var(--ref-s400)]">{MATCHMAKING.roleNote}</p>
            </div>
            <div className={`${card} flex flex-col justify-between p-6 md:col-span-1 lg:col-span-2`}>
              <h4 className="mb-2 text-base font-semibold text-[var(--ref-blue400)]">{MATCHMAKING.snakeTitle}</h4>
              <p className="mb-4 text-xs text-[var(--ref-s400)]">{MATCHMAKING.snakeBody}</p>
              <div className="my-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([[radiant, 0], [dire, 1]] as const).map(([ranks, t]) => (
                  <div key={t} className="space-y-2 rounded-lg border p-4" style={{ background: t === 0 ? "var(--ref-em-950)" : "var(--ref-rose-950)", borderColor: t === 0 ? "var(--ref-em-40)" : "var(--ref-rose-40)" }}>
                    <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: t === 0 ? "var(--ref-em-40)" : "var(--ref-rose-40)" }}>
                      <span className="font-display text-sm font-bold" style={{ color: t === 0 ? "var(--ref-em400)" : "var(--ref-rose400)" }}>{MATCHMAKING.teams[t].name}</span>
                      <span className="font-mono text-xs" style={{ color: t === 0 ? "var(--ref-em300)" : "var(--ref-rose300)" }}>{MATCHMAKING.teams[t].avg}</span>
                    </div>
                    <div className="space-y-1 text-xs">{ranks.map((r, i) => row(r, t, i === 0))}</div>
                  </div>
                ))}
              </div>
              <p className="rounded-lg border border-[var(--ref-s700)] bg-[var(--ref-s800)] p-3 text-xs text-[var(--ref-s300)]">
                ⚡ <strong className="text-[var(--ref-cyan400)]">{MATCHMAKING.whyLead}</strong> {MATCHMAKING.why}
              </p>
            </div>
          </div>
        </section>

        {/* 3. #scoring (:296–443) */}
        <section id="scoring" className="space-y-6">
          <SectionHead color="var(--ref-pink)" title={SCORING.title} subtitle={SCORING.subtitle} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((c, i) => (
              <div key={c.tag} className={`space-y-2 rounded-xl border bg-[var(--ref-card)] p-5 ${i === 3 ? "relative overflow-hidden border-[var(--ref-gold-50)] shadow-[var(--ref-glow-gold)]" : "border-[var(--ref-border)]"}`}>
                {i === 3 ? <div aria-hidden className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--ref-gold-10)] blur-xl" /> : null}
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.color }}>{c.tag}</span>
                <h5 className="font-display text-lg font-black text-white">{c.title}</h5>
                {"win" in c ? (
                  <p className="text-xs leading-relaxed text-[var(--ref-s300)]">
                    • ชัยชนะ (Win): <strong className="text-[var(--ref-em400)]">{c.win}</strong><br />
                    • พ่ายแพ้ (Loss): <strong className="text-[var(--ref-rose400)]">{c.lose}</strong><br />
                    {c.note}
                  </p>
                ) : "lead" in c ? (
                  <p className="text-xs leading-relaxed text-[var(--ref-s300)]">
                    • <strong className="text-[var(--ref-gold)]">{c.lead}</strong> <span className="font-mono">{c.formula}</span><br />• {c.note}
                  </p>
                ) : "formula" in c ? (
                  <>
                    <div className="break-words rounded border border-[var(--ref-s700)] bg-[var(--ref-s900)] p-2 font-mono text-xs text-[var(--ref-pink300)]">{c.formula}</div>
                    <p className="text-xs text-[var(--ref-s400)]">{c.note}</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ref-s400)]">
                    <span className="font-mono">{c.line1}</span><br />{c.line2}<br /><span className="text-xs text-[var(--ref-s500)]">{c.note}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className={`${card} flex flex-col justify-between p-6 lg:col-span-7`}>
              <h4 className="mb-2 text-base font-semibold text-[var(--ref-em400)]">{SCORING.chartTitle}</h4>
              <p className="mb-4 text-xs text-[var(--ref-s400)]">{SCORING.chartNote}</p>
              <ScoreStack />
            </div>
            <LiveSimulator />
          </div>
        </section>

        {/* 4. #finals (:446–459) */}
        <section id="finals" className="space-y-6">
          <SectionHead color="var(--ref-gold)" title={STAGES.title} subtitle={STAGES.subtitle} />
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            {STAGES.rows.map((r) => (
              <div key={r.name} className={`${card} p-5`}>
                <h4 className="mb-2 font-bold text-[var(--ref-cyan)]">{r.name}</h4>
                <p className="text-[var(--ref-s300)]">{r.text}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-[var(--ref-gold-30)] bg-[var(--ref-s900)] p-4 text-xs text-[var(--ref-s300)]">
            💰 <strong className="text-[var(--ref-gold)]">{STAGES.prizeLead}</strong> {STAGES.prize}
          </div>
          <p className="text-xs text-[var(--ref-s500)]">{STAGES.source}</p>
        </section>

        {/* 5. #risk (:462–529) */}
        <section id="risk" className="space-y-6">
          <SectionHead color="var(--ref-rose)" title={RISK.title} subtitle={RISK.subtitle} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className={`${card} flex flex-col justify-between p-6 lg:col-span-6`}>
              <h4 className="mb-2 text-base font-semibold text-[var(--ref-rose400)]">{RISK.chartTitle}</h4>
              <p className="mb-4 text-xs text-[var(--ref-s400)]">{RISK.chartNote}</p>
              <PenaltyBars />
            </div>
            <div className={`${card} flex flex-col justify-between space-y-4 p-6 lg:col-span-6`}>
              <div>
                <h4 className="mb-2 text-base font-semibold text-[var(--ref-em400)]">{RISK.workflowTitle}</h4>
                <p className="mb-4 text-xs text-[var(--ref-s400)]">{RISK.workflowNote}</p>
                <div className="space-y-3 text-xs">
                  {RISK.steps.map(([t, d], i) => (
                    <div key={t} className="flex items-center gap-3 rounded-lg border border-[var(--ref-s700)] bg-[var(--ref-s800)] p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--ref-em-40)] bg-[var(--ref-em-950)] font-bold text-[var(--ref-em400)]">{i + 1}</span>
                      <div><strong className="block text-white">{t}</strong><span className="text-[var(--ref-s400)]">{d}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--ref-rose-40)] bg-[var(--ref-rose-950)] p-3 text-xs text-[var(--ref-rose300)]">{RISK.streamDelay}</div>
              <div className="rounded-lg border border-[var(--ref-rose-40)] bg-[var(--ref-rose-950)] p-3 text-xs text-[var(--ref-rose300)]">{RISK.noVote}</div>
            </div>
          </div>
        </section>

        {/* 6. #ai-oracle (:533–577) */}
        <section id="ai-oracle" className="space-y-6">
          <SectionHead color="var(--ref-gold)" title={AVE.title} subtitle={AVE.subtitle} />
          <AveBox aveReady={isAveConfigured()} soonLabel={dict(await getLocale()).help.menu.aveSoon} />
        </section>
      </div>
    </main>
  );
}
