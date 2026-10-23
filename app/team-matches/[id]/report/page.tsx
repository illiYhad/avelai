// หน้ารายงานผลของหัวหน้าทีม — ยกจาก Zodiac app/matches/[id]/report/page.tsx
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import ReportResultForm from "@/components/team/ReportResultForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportTeamMatchPage({ params }: PageProps) {
  const { id } = await params;
  const db = await getServerDb();

  if (!db) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 text-white">
        <p className="text-neutral-400 text-sm">ยังไม่ต่อฐานข้อมูล — ตั้งค่า environment ก่อนใช้งานหน้านี้</p>
      </main>
    );
  }

  const { data: match } = await db
    .from("team_matches")
    .select("id, status, best_of, team_a_id, team_b_id")
    .eq("id", id)
    .maybeSingle();

  if (!match) notFound();

  const teamIds = [match.team_a_id, match.team_b_id].filter((t): t is string => Boolean(t));
  const { data: teams } = teamIds.length
    ? await db.from("teams").select("id, name, tag").in("id", teamIds)
    : { data: [] };

  const labelOf = (teamId: string | null, fallback: string) => {
    const team = teams?.find((t) => t.id === teamId);
    return { id: teamId ?? "", name: team ? (team.tag ? `${team.name} [${team.tag}]` : team.name) : fallback };
  };

  return (
    <ReportResultForm
      matchId={match.id}
      teamA={labelOf(match.team_a_id, "ทีม A")}
      teamB={labelOf(match.team_b_id, "ทีม B")}
      bestOf={match.best_of ?? 3}
      status={match.status}
    />
  );
}
