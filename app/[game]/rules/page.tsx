// K-AV-RULES.1: หน้ากติกา Ultimate Solo · อ่านได้ไม่ต้องล็อกอิน · ไม่อ่าน cookies/headers/searchParams
// dota2 = หน้าเต็ม · mlbb = การ์ด "เร็ว ๆ นี้" · ข้อความทั้งหมดอยู่ที่ rules-content.ts
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import { gameFromSlug, slugOf } from "@/lib/games";
import { routes } from "@/lib/routes";
import { PENDING_PARSING_LABEL, SCORE_CONFIG } from "@/lib/avelai/score";
import ScoreCalculator from "./ScoreCalculator";
import { snakeOrder } from "./snake";
import {
  ASK_AVE, DMG_POLICY, HERO, HERO_CARDS, PENALTIES, ROLES, SNAKE, STAGES, scoreRulesText,
} from "./rules-content";

export const metadata = { title: "กติกา Ultimate Solo · AVELAi" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-bold text-ink sm:text-xl">{children}</h2>;
}

export default async function RulesPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);

  if (slug !== "dota2") {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PageHeader eyebrow="// RULES" title="กติกา" subtitle="MLBB" />
        <Surface glow="cyan" className="flex flex-col gap-3">
          <p className="text-base text-ink">กติกา MLBB เร็ว ๆ นี้</p>
          <Link href={routes.rules("dota2")} className="self-start text-sm text-cyan underline">ดูกติกา Dota 2 Ultimate Solo</Link>
        </Surface>
      </main>
    );
  }

  const [team1, team2] = snakeOrder(10);
  const formula = scoreRulesText(SCORE_CONFIG);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* a) Hero + 4 การ์ด */}
      <PageHeader eyebrow={`// ${HERO.eyebrow}`} title={HERO.title} subtitle={HERO.tagline} />
      <p className="text-base text-ink-muted">{HERO.intro}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {HERO_CARDS.map((c) => (
          <Surface key={c.label} glow="none" className="flex flex-col gap-1">
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className="font-display text-lg font-bold text-gold">{c.value}</p>
            <p className="text-sm text-ink-muted">{c.note}</p>
          </Surface>
        ))}
      </div>

      {/* b) ตำแหน่ง + Snake Draft */}
      <Surface glow="none" as="section" className="flex flex-col gap-3">
        <SectionTitle>{ROLES.title}</SectionTitle>
        <p className="text-base text-ink">{ROLES.body}</p>
        <p className="text-sm text-ink-muted">{ROLES.note}</p>
      </Surface>
      <Surface glow="cyan" as="section" className="flex flex-col gap-3">
        <SectionTitle>{SNAKE.title}</SectionTitle>
        <p className="text-base text-ink-muted">{SNAKE.body}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[team1, team2].map((ranks, i) => (
            <div key={SNAKE.teams[i]} className="rounded border border-line p-3">
              <p className="font-mono text-xs tracking-[0.2em] text-cyan">{SNAKE.teams[i]}</p>
              <ul className="mt-2 flex flex-wrap gap-2 font-mono text-sm text-ink">
                {ranks.map((r) => <li key={r} className="rounded border border-line px-2 py-1">อันดับ {r}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-muted">{SNAKE.why}</p>
      </Surface>

      {/* c) สูตรคะแนน 4 ส่วน (ข้อความจาก SCORE_CONFIG) */}
      <Surface glow="none" as="section" className="flex flex-col gap-3">
        <SectionTitle>สูตรคะแนนรายแมตช์</SectionTitle>
        {formula.map((b) => (
          <div key={b.title} className="flex flex-col gap-1">
            <p className="font-bold text-ink">{b.title}</p>
            {b.lines.map((l) => <p key={l} className="break-words font-mono text-sm text-ink-muted">{l}</p>)}
          </div>
        ))}
        <p className="text-sm text-ink-muted">{DMG_POLICY} <span className="text-gold">{PENDING_PARSING_LABEL}</span></p>
      </Surface>

      {/* d) + e) ตัวคำนวณ + กราฟ */}
      <Surface glow="gold" as="section" className="flex flex-col gap-3">
        <SectionTitle>ตัวคำนวณคะแนน</SectionTitle>
        <ScoreCalculator />
      </Surface>

      {/* f) รอบชิง & ตัดเชือก + กองรางวัล */}
      <Surface glow="none" as="section" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>{STAGES.title}</SectionTitle>
          <span className="rounded border border-gold/60 px-2 py-0.5 text-xs text-gold">{STAGES.openBadge}</span>
        </div>
        <p className="text-sm text-ink-muted">{STAGES.subtitle}</p>
        <ul className="flex flex-col gap-2">
          {STAGES.rows.map((r) => (
            <li key={r.name} className="rounded border border-line p-3">
              <p className="font-bold text-ink">{r.name}</p>
              <p className="text-sm text-ink-muted">{r.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink">{STAGES.prize}</p>
        <p className="text-xs text-ink-muted">{STAGES.source}</p>
      </Surface>

      {/* g) บทลงโทษ (เฉพาะที่มีต้นทางเซ็นแล้ว) */}
      <Surface glow="none" as="section" className="flex flex-col gap-3">
        <SectionTitle>บทลงโทษ</SectionTitle>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
          {PENALTIES.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </Surface>

      {/* h) ถาม AVE (ไม่มีแชทใหม่ · ไม่เรียก API) */}
      <Surface glow="cyan" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-ink">{ASK_AVE}</p>
        <Link href="/login" className="text-sm text-cyan underline">เข้าสู่ระบบ</Link>
      </Surface>
    </main>
  );
}
