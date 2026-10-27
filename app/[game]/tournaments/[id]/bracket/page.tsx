import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { championOf, rowToSlot, type SlotRow } from "@/lib/tournament/engine";
import { BRACKET_LABEL, groupRounds, teamLabel, type TeamName } from "@/lib/tournament/engine/view";
import { routes } from "@/lib/routes";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import BracketBoard, { type BoardGroup } from "./BracketBoard";
import { gameFromSlug, slugOf } from "@/lib/games";

// K-AV-4: สาย SE/DE อ่านอย่างเดียว · responsive (เลื่อนแนวนอนบนมือถือ) · ทีมยังไม่รู้ = "รอผล"
export const dynamic = "force-dynamic";

export default async function BracketPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const db = await getServerDb();
  if (!db) return <main className="px-6 py-10 text-base text-ink-muted">ยังไม่ต่อฐานข้อมูล</main>;
  const { data: t } = await db.from("tournaments").select("id, name, format, status").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: auth } = await db.auth.getUser();
  const { data: rows } = await db.from("tournament_bracket_slots").select("tournament_id, bracket, round, position, team_a_id, team_b_id, winner_to, winner_to_side, loser_to, loser_to_side, source_a, source_b, is_grand_final_reset, winner_team_id, status").eq("tournament_id", id);
  const slots = ((rows ?? []) as SlotRow[]).map(rowToSlot);
  const teamIds = [...new Set(slots.flatMap((s) => [s.teamA, s.teamB, s.winnerId]).filter((x): x is string => !!x))];
  const { data: teams } = teamIds.length ? await db.from("teams").select("id, name, tag").in("id", teamIds) : { data: [] };
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));
  const champion = championOf(slots);
  const statusText = (st: string) => (st === "BYE" ? "ผ่านอัตโนมัติ" : st === "READY" ? "รอแข่ง" : st === "DONE" ? "จบแล้ว" : st === "VOID" ? "ไม่ใช้" : "รอผล");
  const groups: BoardGroup[] = groupRounds(slots).map((g) => ({
    bracket: g.bracket,
    label: BRACKET_LABEL[g.bracket],
    rounds: g.rounds.map((r) => ({
      round: r.round,
      slots: r.slots.map((s) => ({
        key: s.key,
        a: { label: teamLabel(names, s.teamA), won: Boolean(s.winnerId && s.teamA === s.winnerId) },
        b: { label: teamLabel(names, s.teamB), won: Boolean(s.winnerId && s.teamB === s.winnerId) },
        statusText: statusText(s.status),
        void: s.status === "VOID",
        reset: s.isGrandFinalReset,
      })),
    })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={`// BRACKET ${t.format}`}
        title={t.name}
        subtitle={champion ? <span className="text-gold">🏆 แชมป์: {teamLabel(names, champion)}</span> : undefined}
        aside={<Link href={routes.tournament(slug, id)} className="btn-ghost flex min-h-11 items-center rounded px-4 text-sm">รายละเอียดทัวร์</Link>}
      />
      {!auth.user ? <EmptyState message="เข้าสู่ระบบเพื่อดูสาย" actionLabel="เข้าสู่ระบบ" actionHref="/login" /> : slots.length === 0 ? <EmptyState message="ยังไม่ได้สร้างสาย" /> : <BracketBoard groups={groups} />}
    </main>
  );
}
