// หน้าทีม + roster — ยกแนวทางจาก Zodiac app/teams/[teamId]/page.tsx ปรับธีม AVELAi
// ลิงก์ไปเครื่องมือของน้องเปา (เฟส 3): ตารางซ้อม · งบทีม · สเกาต์
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { gameLabel } from "@/lib/games";
import { InvitePlayerModal } from "@/components/team/InvitePlayerModal";
import { LockRosterButton } from "@/components/team/LockRosterButton";
import { routes } from "@/lib/routes";
import { gameFromSlug, slugOf, teamGame } from "@/lib/games";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ game: string; teamId: string }>;
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { game, teamId } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
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
    .select("id, name, tag, logo_url, description, owner_id, captain_id, is_roster_locked, wins, losses, game")
    .eq("id", teamId)
    .maybeSingle();

  if (!team || teamGame(team.game) !== code) notFound(); // K-AV-UX2B: ทีมของอีกเกม = 404

  const [{ data: auth }, { data: members, error: membersError }] = await Promise.all([
    db.auth.getUser(),
    db
      .from("team_members")
      .select("user_id, role, status, joined_at, users:public_profiles_v!user_id!inner(username, display_name, avatar_url)")
      .eq("team_id", teamId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true }),
  ]);

  // K-AV-H2: เดิม error ถูกกลืนเงียบ → ROSTER (0) · ต้นเหตุ: embed users กำกวม (team_members มี FK ไป users 2 เส้น)
  if (membersError) console.error("[TEAM_ROSTER_LOAD]", membersError);

  const userId = auth.user?.id ?? null;
  const isLeader = userId !== null && (userId === team.owner_id || userId === team.captain_id);

  type MemberUser = { username: string; display_name: string | null; avatar_url: string | null };
  const roster = (members ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return { userId: m.user_id as string, role: m.role as string, user: u as MemberUser };
  });

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-1">{gameLabel(team.game).toUpperCase()} TEAM</p>
            <h1 className="text-2xl font-bold truncate">
              {team.name} <span className="text-[#00D4FF]">[{team.tag}]</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {team.wins}W - {team.losses}L
            </p>
          </div>
          {isLeader && <LockRosterButton teamId={team.id} locked={team.is_roster_locked} />}
        </div>

        {team.description && <p className="text-base text-neutral-300 mb-6">{team.description}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-8">
          <Link href={routes.teamSchedule(slug, team.id)} className="rounded-lg border border-white/10 bg-[#12121A] px-4 py-3 text-sm hover:border-[#00D4FF]/50">
            📅 ตารางซ้อม
          </Link>
          <Link href={routes.teamBudget(slug, team.id)} className="rounded-lg border border-white/10 bg-[#12121A] px-4 py-3 text-sm hover:border-[#00D4FF]/50">
            💰 เงินเดือน/งบทีม
          </Link>
          <Link href={routes.teamScout(slug, team.id)} className="rounded-lg border border-white/10 bg-[#12121A] px-4 py-3 text-sm hover:border-[#00D4FF]/50">
            🔭 สเกาต์
          </Link>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-sm font-bold tracking-wider text-neutral-300 uppercase">
            Roster ({roster.length})
          </h2>
          {isLeader && !team.is_roster_locked && <InvitePlayerModal teamId={team.id} />}
        </div>

        <ul className="flex flex-col gap-2">
          {roster.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#12121A] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{m.user.display_name || m.user.username}</p>
                <p className="text-xs text-neutral-500 font-mono truncate">@{m.user.username}</p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-1 text-xs font-mono font-bold ${
                  m.role === "OWNER" || m.role === "CAPTAIN"
                    ? "bg-[#C9A84C]/15 text-[#C9A84C]"
                    : "bg-white/5 text-neutral-300"
                }`}
              >
                {m.role}
              </span>
            </li>
          ))}
          {roster.length === 0 && <li className="text-sm text-neutral-500">ยังไม่มีสมาชิก</li>}
        </ul>
      </div>
    </main>
  );
}
