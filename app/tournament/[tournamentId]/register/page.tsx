// หน้าสมัครทัวร์แบบทีม (ไม่มีค่าสมัคร) — ยกแนวทางจาก Zodiac
// app/tournament/[tournamentId]/register/page.tsx + actions/registration.ts
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { RegisterTeamForm } from "@/components/team/RegisterTeamForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tournamentId: string }>;
}

export default async function TournamentRegisterPage({ params }: PageProps) {
  const { tournamentId } = await params;
  const db = await getServerDb();

  if (!db) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 text-white">
        <p className="text-neutral-400 text-sm">ยังไม่ต่อฐานข้อมูล — ตั้งค่า environment ก่อนใช้งานหน้านี้</p>
      </main>
    );
  }

  const { data: tournament } = await db
    .from("tournament_instances")
    .select("id, tier, status, start_at, end_at, prize_pool_thb")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournament) notFound();

  const { data: auth } = await db.auth.getUser();
  const userId = auth.user?.id ?? null;

  // ทีมที่ผู้ใช้เป็น OWNER/CAPTAIN (สมัครแทนทีมได้)
  const { data: leaderTeams } = userId
    ? await db
        .from("teams")
        .select("id, name, tag, owner_id, captain_id")
        .or(`owner_id.eq.${userId},captain_id.eq.${userId}`)
        .is("deleted_at", null)
    : { data: [] };

  // สถานะการสมัครเดิมของทีมเหล่านั้น
  const teamIds = (leaderTeams ?? []).map((t) => t.id);
  const { data: registrations } = teamIds.length
    ? await db
        .from("tournament_registrations")
        .select("team_id, status")
        .eq("tournament_id", tournamentId)
        .in("team_id", teamIds)
    : { data: [] };

  const regByTeam = new Map((registrations ?? []).map((r) => [r.team_id, r.status]));

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-2">TOURNAMENT REGISTRATION</p>
        <h1 className="text-2xl font-bold mb-1">สมัครแข่งขัน ({tournament.tier.toUpperCase()})</h1>
        <p className="text-xs text-neutral-400 mb-6">
          เริ่ม {new Date(tournament.start_at).toLocaleString("th-TH")} · สมัครฟรี
        </p>

        {!userId && <p className="text-sm text-neutral-400">กรุณาเข้าสู่ระบบก่อนสมัคร</p>}

        {userId && (leaderTeams ?? []).length === 0 && (
          <p className="text-sm text-neutral-400">
            คุณยังไม่มีทีมที่คุณเป็นเจ้าของหรือกัปตัน — สร้างทีมก่อนที่หน้า &quot;ทีมของฉัน&quot;
          </p>
        )}

        <div className="flex flex-col gap-3">
          {(leaderTeams ?? []).map((t) => (
            <RegisterTeamForm
              key={t.id}
              tournamentId={tournament.id}
              teamId={t.id}
              teamLabel={`${t.name} [${t.tag}]`}
              existingStatus={regByTeam.get(t.id) ?? null}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
