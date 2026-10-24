// สเกาต์ผู้เล่น (K-AV-R เฟส 3 ข้อ 13) — รายชื่อจับตา + ดึงข้อมูล Liquipedia (Private Beta)
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { isActiveTeamMember } from "@/lib/team/access";
import { TeamRestricted } from "../TeamRestricted";
import { ScoutClient, type ProspectView } from "./ScoutClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamScoutPage({ params }: PageProps) {
  const { id: teamId } = await params;
  const db = await getServerDb();

  if (!db) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 text-white">
        <p className="text-neutral-400 text-sm">ยังไม่ต่อฐานข้อมูล — ตั้งค่า environment ก่อนใช้งานหน้านี้</p>
      </main>
    );
  }

  // K-AV-H3: เช็กสมาชิกก่อน — คนนอก/ไม่ล็อกอินไม่ดึงข้อมูลทีมเลย
  const { data: auth } = await db.auth.getUser();
  if (!auth.user || !(await isActiveTeamMember(db, teamId, auth.user.id))) {
    return <TeamRestricted what="หน้าสเกาต์" />;
  }

  const { data: team } = await db
    .from("teams")
    .select("id, name, tag, owner_id, captain_id, private_beta")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) notFound();

  const [{ data: prospects }] = await Promise.all([
    db
      .from("scout_prospects")
      .select("id, nickname, position, current_team, liquipedia_url, notes, stars, liquipedia_cache, liquipedia_fetched_at")
      .eq("team_id", teamId)
      .order("stars", { ascending: false })
      .limit(100),
  ]);

  const userId = auth.user?.id ?? null;
  const { data: myRole } = userId
    ? await db
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .in("role", ["OWNER", "CAPTAIN", "MANAGER", "COACH"])
        .maybeSingle()
    : { data: null };

  const isLeader = userId !== null && (team.owner_id === userId || team.captain_id === userId || myRole !== null);

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-2">SCOUTING</p>
        <h1 className="text-2xl font-bold mb-6">
          สเกาต์ — {team.name} <span className="text-[#00D4FF]">[{team.tag}]</span>
        </h1>
        <ScoutClient
          teamId={teamId}
          isLeader={isLeader}
          privateBeta={Boolean(team.private_beta)}
          prospects={(prospects ?? []) as ProspectView[]}
        />
      </div>
    </main>
  );
}
