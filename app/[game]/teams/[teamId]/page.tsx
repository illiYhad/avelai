// หน้าทีม + roster — ยกแนวทางจาก Zodiac app/teams/[teamId]/page.tsx ปรับธีม AVELAi
// ลิงก์ไปเครื่องมือของน้องเปา (เฟส 3): ตารางซ้อม · งบทีม · สเกาต์
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { GAMES, gameLabel } from "@/lib/games";
import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import Stat from "@/components/ui/Stat";
import GameTag from "@/components/ui/GameTag";
import { InvitePlayerModal } from "@/components/team/InvitePlayerModal";
import { LockRosterButton } from "@/components/team/LockRosterButton";
import { routes } from "@/lib/routes";
import { gameFromSlug, slugOf, teamGame } from "@/lib/games";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ game: string; teamId: string }>;
}

// OG สำหรับแชร์ทีมใน Discord — ชื่อ/แท็ก/เกม/สถิติเท่านั้น (ข้อมูลที่หน้าสาธารณะแสดงอยู่แล้ว)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { game, teamId } = await params;
  const code = gameFromSlug(game);
  if (!code) return {};
  try {
    const db = await getServerDb();
    if (!db) return {};
    const { data: t } = await db.from("teams").select("name, tag, game, wins, losses").eq("id", teamId).maybeSingle();
    if (!t || teamGame(t.game) !== code) return {};
    const title = `${t.name} [${t.tag}] · ${gameLabel(t.game)}`;
    const description = `ชนะ ${t.wins ?? 0} · แพ้ ${t.losses ?? 0}`;
    return { title: `${t.name} — AVELAi`, description, openGraph: { title, description, siteName: "AVELAi", locale: "th_TH", images: ["/og/avelai-default.png"] } };
  } catch {
    return {};
  }
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { game, teamId } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const db = await getServerDb();

  if (!db) {
    return (
      <main className="px-4 py-10">
        <p className="text-base text-ink-muted">ยังไม่ต่อฐานข้อมูล — ตั้งค่า environment ก่อนใช้งานหน้านี้</p>
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

  const STAFF = new Set(["SUBSTITUTE", "COACH", "MANAGER"]);
  const ROLE_LABEL: Record<string, string> = { OWNER: "OWNER", CAPTAIN: "CAPTAIN", PLAYER: "ผู้เล่น", SUBSTITUTE: "ตัวสำรอง", COACH: "โค้ช", MANAGER: "ผู้จัดการ" };
  const starters = roster.filter((m) => !STAFF.has(m.role));
  const bench = roster.filter((m) => STAFF.has(m.role));
  const slots = Math.max(GAMES[code].teamSize, starters.length);
  const total = (team.wins ?? 0) + (team.losses ?? 0);
  const tabs = [
    { href: routes.team(slug, team.id), label: "Roster", active: true },
    { href: routes.teamSchedule(slug, team.id), label: "ตารางซ้อม", active: false },
    { href: routes.teamBudget(slug, team.id), label: "งบทีม", active: false },
    { href: routes.teamScout(slug, team.id), label: "สเกาต์", active: false },
  ];

  const MemberCard = ({ m }: { m: (typeof roster)[number] }) => {
    const lead = m.role === "OWNER" || m.role === "CAPTAIN";
    return (
      <Surface as="li" glow={lead ? "gold" : "none"} className="flex items-center justify-between gap-3 !p-4">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-ink">{m.user.display_name || m.user.username}</p>
          <p className="truncate font-mono text-sm text-ink-muted">@{m.user.username}</p>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 font-mono text-xs font-bold ${lead ? "bg-gold/15 text-gold" : "bg-white/5 text-ink-muted"}`}>{ROLE_LABEL[m.role] ?? m.role}</span>
      </Surface>
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 pb-28 sm:px-6">
      <PageHeader
        eyebrow={`// ${gameLabel(team.game).toUpperCase()} · TEAM`}
        title={<>{team.name} <span className="font-mono text-cyan">[{team.tag}]</span></>}
        subtitle={team.description ?? undefined}
        aside={<GameTag game={slug} />}
      />
      <Surface glow="cyan" className="grid grid-cols-3 gap-4">
        <Stat label="// ชนะ" value={team.wins ?? 0} tone="cyan" />
        <Stat label="// แพ้" value={team.losses ?? 0} />
        <Stat label="// แมตช์รวม" value={total} />
      </Surface>

      <nav aria-label="เมนูทีม" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => (
          <Link key={tab.label} href={tab.href} aria-current={tab.active ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm ${tab.active ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-sm tracking-[0.2em] text-ink-muted">{"// ตัวจริง"} ({starters.length}/{GAMES[code].teamSize})</h2>
        <ul className="flex flex-col gap-2">
          {starters.map((m) => <MemberCard key={m.userId} m={m} />)}
          {Array.from({ length: Math.max(slots - starters.length, 0) }, (_, i) => (
            <Surface key={`empty-${i}`} as="li" dashed className="!p-4 text-center text-sm text-ink-muted">ช่องว่าง</Surface>
          ))}
        </ul>
      </section>

      {bench.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-sm tracking-[0.2em] text-ink-muted">{"// ตัวสำรอง / ทีมงาน"}</h2>
          <ul className="flex flex-col gap-2">{bench.map((m) => <MemberCard key={m.userId} m={m} />)}</ul>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-void/95 p-3 backdrop-blur sm:static sm:rounded-lg sm:border sm:bg-surface-2 sm:p-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">{team.is_roster_locked ? <span className="text-gold">🔒 Roster ล็อกแล้ว</span> : <>Roster <b className="text-cyan">เปิดอยู่</b></>}</p>
          {isLeader ? (
            <div className="flex items-center gap-3">
              {!team.is_roster_locked && <InvitePlayerModal teamId={team.id} />}
              <LockRosterButton teamId={team.id} locked={team.is_roster_locked} />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
