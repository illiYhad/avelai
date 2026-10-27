// หน้า "ทีมของฉัน" — จุดเข้า Team Management (K-AV-R เฟส 2)
// แนวทางจาก Zodiac app/teams + ปรับธีม AVELAi · env-safe: ไม่มี env = แสดงข้อความแทน
import Link from "next/link";
import { getServerDb } from "@/lib/db/server";
import { gameLabel, gameFromSlug, slugOf } from "@/lib/games";
import { routes } from "@/lib/routes";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyTeamsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
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

  const { data: auth } = await db.auth.getUser();
  const userId = auth.user?.id ?? null;

  const { data: memberships } = userId
    ? await db
        .from("team_members")
        .select("role, status, teams!inner(id, name, tag, logo_url, is_roster_locked, wins, losses, game)")
        .eq("teams.game", code)
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
    : { data: [] };

  type TeamRow = { id: string; name: string; tag: string; logo_url: string | null; is_roster_locked: boolean; wins: number; losses: number; game: string | null };
  const teams = (memberships ?? []).map((m) => {
    const t = Array.isArray(m.teams) ? m.teams[0] : m.teams;
    return { ...(t as TeamRow), myRole: m.role as string };
  });

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-1">TEAM MANAGEMENT</p>
            <h1 className="text-2xl font-bold">ทีมของฉัน</h1>
          </div>
          <Link
            href={routes.teamCreate(slug)}
            className="rounded bg-[#00D4FF] px-4 py-2 text-xs font-bold text-black hover:bg-[#3ae0ff]"
          >
            + สร้างทีม
          </Link>
        </div>

        {!userId && <p className="text-neutral-400 text-sm">กรุณาเข้าสู่ระบบเพื่อดูทีมของคุณ</p>}

        {userId && teams.length === 0 && (
          <p className="text-neutral-400 text-sm">คุณยังไม่ได้อยู่ในทีมใด — สร้างทีมใหม่หรือรอคำเชิญจากทีมอื่น</p>
        )}

        <ul className="flex flex-col gap-3">
          {teams.map((t) => (
            <li key={t.id}>
              <Link
                href={routes.team(slug, t.id)}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#12121A] px-4 py-3 hover:border-[#00D4FF]/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {t.name} <span className="text-[#00D4FF]">[{t.tag}]</span>
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {gameLabel(t.game)} · บทบาท: {t.myRole} · {t.wins}W-{t.losses}L {t.is_roster_locked ? "· 🔒 roster ล็อกแล้ว" : ""}
                  </p>
                </div>
                <span className="text-neutral-500 text-sm shrink-0">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
