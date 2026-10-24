// ตารางซ้อม + เช็กชื่อ (K-AV-R เฟส 3 ข้อ 11 — ของน้องเปา · ทีม Underdog MLBB)
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { computeAttendanceStats } from "@/lib/team/attendance";
import { ScheduleClient, type SessionView } from "./ScheduleClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamSchedulePage({ params }: PageProps) {
  const { id: teamId } = await params;
  const db = await getServerDb();

  if (!db) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 text-white">
        <p className="text-neutral-400 text-sm">ยังไม่ต่อฐานข้อมูล — ตั้งค่า environment ก่อนใช้งานหน้านี้</p>
      </main>
    );
  }

  const { data: team } = await db
    .from("teams")
    .select("id, name, tag, owner_id, captain_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) notFound();

  const [{ data: auth }, { data: sessions }, { data: members }] = await Promise.all([
    db.auth.getUser(),
    db
      .from("practice_sessions")
      .select("id, title, session_type, starts_at, ends_at")
      .eq("team_id", teamId)
      .order("starts_at", { ascending: false })
      .limit(30),
    db
      .from("team_members")
      .select("user_id, role, users!user_id!inner(username)")
      .eq("team_id", teamId)
      .eq("status", "ACTIVE"),
  ]);

  const myUserId = auth.user?.id ?? null;
  const myRow = (members ?? []).find((m) => m.user_id === myUserId);
  const isLeader =
    myUserId !== null &&
    (myUserId === team.owner_id ||
      myUserId === team.captain_id ||
      ["OWNER", "CAPTAIN", "MANAGER", "COACH"].includes((myRow?.role as string) ?? ""));

  const usernameOf = new Map(
    (members ?? []).map((m) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      return [m.user_id as string, (u as { username: string }).username];
    }),
  );

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: attendance } = sessionIds.length
    ? await db
        .from("practice_attendance")
        .select("session_id, user_id, rsvp, attended")
        .in("session_id", sessionIds)
    : { data: [] };

  const sessionViews: SessionView[] = (sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    session_type: s.session_type,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    attendance: (attendance ?? [])
      .filter((a) => a.session_id === s.id)
      .map((a) => ({
        user_id: a.user_id,
        username: usernameOf.get(a.user_id) ?? "?",
        rsvp: a.rsvp,
        attended: a.attended,
      })),
  }));

  const stats = computeAttendanceStats(
    (attendance ?? []).map((a) => ({ session_id: a.session_id, user_id: a.user_id, attended: a.attended })),
  )
    .map((s) => ({ ...s, username: usernameOf.get(s.userId) ?? "?" }))
    .sort((a, b) => b.percent - a.percent);

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-2">TEAM SCHEDULE</p>
        <h1 className="text-2xl font-bold mb-6">
          ตารางซ้อม — {team.name} <span className="text-[#00D4FF]">[{team.tag}]</span>
        </h1>
        <ScheduleClient
          teamId={teamId}
          myUserId={myUserId}
          isLeader={isLeader}
          sessions={sessionViews}
          stats={stats}
        />
      </div>
    </main>
  );
}
