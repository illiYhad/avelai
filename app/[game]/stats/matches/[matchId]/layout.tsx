import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import { dash, duration, gameModeLabel, lobbyLabel, thaiDateTime } from "@/lib/dota/display";
import { getMatchDetail, regionLabel } from "@/lib/dota/match";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "./BlockedNotice";
import { MATCH_TABS, matchTabPath } from "./tabs";
import MatchTabNav from "./MatchTabNav";
import ParseRequestPanel from "./ParseRequestPanel";

// K-AV-D3: หน้าแมตช์ Dota 2 สาธารณะ (ไม่ต้องล็อกอิน) — ข้อมูลจริงจาก OpenDota เท่านั้น
// ห้ามมีข้อมูลตัวอย่างหรือ fallback: ดึงไม่ได้ = ข้อความไทยจาก DotaError
export const dynamic = "force-dynamic";

export default async function MatchStatsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ game: string; matchId: string }>;
}) {
  const { game, matchId } = await params;
  // เฉพาะ Dota 2 — เกมอื่น (เช่น /mlbb/stats/matches/...) ต้อง 404
  if (game !== "dota2") notFound();
  if (!isValidMatchId(matchId)) notFound();

  // K-AV-D3.1: เพดานต่อ IP 30 ครั้ง/นาที ผ่านยามร่วม (นับครั้งเดียวต่อคำขอ ร่วมกับ page)
  // ถูกล็อก = ไม่เรียก getMatchDetail และไม่มีข้อมูลแมตช์ออกไป
  if (!(await guardPublicMatchView())) return blockedNotice(true);

  const r = await getMatchDetail(matchId);

  if (!r.ok) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <PageHeader eyebrow="DOTA 2 MATCH" title={`แมตช์ ${matchId}`} subtitle="แหล่งข้อมูล: OpenDota" />
        <Surface glow="cyan">
          <p className="text-base text-ink">{r.message}</p>
        </Surface>
      </main>
    );
  }

  const m = r.data;
  const winner = m.radiantWin === null ? "–" : m.radiantWin ? "Radiant" : "Dire";
  const winnerTeam = m.radiantWin === null ? null : m.radiantWin ? m.radiantTeamName : m.direTeamName;
  const region = regionLabel(m.region);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-10">
      <PageHeader
        eyebrow="DOTA 2 MATCH"
        title={`แมตช์ ${m.matchId}`}
        subtitle={<span className="text-sm">แหล่งข้อมูล: OpenDota{m.isParsed ? " · วิเคราะห์แล้ว" : " · ยังไม่วิเคราะห์"}</span>}
      />

      <Surface glow="gold">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-xs sm:grid-cols-3 sm:text-sm">
          <Fact label="ทีมที่ชนะ" value={winnerTeam ? `${winner} (${winnerTeam})` : winner} strong />
          <Fact label="คะแนน" value={`${dash(m.radiantScore)} – ${dash(m.direScore)}`} strong />
          <Fact label="เวลา" value={duration(m.duration)} />
          <Fact label="โหมด" value={gameModeLabel(m.gameMode)} />
          <Fact label="ประเภท" value={lobbyLabel(m.lobbyType)} />
          {region ? <Fact label="ภูมิภาค" value={region} /> : null}
          <Fact label="วันที่" value={thaiDateTime(m.startTime)} />
        </dl>
      </Surface>

      <ParseRequestPanel matchId={m.matchId} isParsed={m.isParsed} />

      <MatchTabNav matchId={m.matchId} tabs={MATCH_TABS.map((t) => ({ ...t, href: matchTabPath(m.matchId, t.slug) }))} />

      {children}

      <p className="text-xs text-ink-muted">
        ข้อมูลทั้งหมดมาจาก OpenDota ·{" "}
        <Link href="/me/dota" className="underline">
          การ์ดผู้เล่นของฉัน
        </Link>
      </p>
    </main>
  );
}

function Fact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs tracking-wider text-ink-muted">{label}</dt>
      <dd className={strong ? "text-sm font-bold text-gold sm:text-base" : "text-xs text-ink sm:text-sm"}>{value}</dd>
    </div>
  );
}
