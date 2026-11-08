import type { SupabaseClient } from "@supabase/supabase-js";
import { isGameCode, slugOf } from "@/lib/games";
import type { HomeActivity, HomeTeam, HomeTournament } from "@/lib/home/types";

// K-AV-HOME.1: อ่านข้อมูลหน้าแรก (อ่านอย่างเดียว · ไม่มี SQL/API ใหม่) · อ่านพลาดแต่ละก้อน = ก้อนนั้นว่าง ไม่ล้มทั้งหน้า
// คอลัมน์อ้างจาก migration:
//   tournaments  = supabase/migrations/140_tournaments_registration.sql:38-62 (id name game format team_size best_of status start_at max_teams)
//   registrations = supabase/migrations/140_tournaments_registration.sql:196-208 (tournament_id team_id status)
//   team_members = supabase/migrations/110_from_zodiac_team_core.sql:59-65 (team_id user_id status)
//   teams        = supabase/migrations/110_from_zodiac_team_core.sql:29 (id name tag game) · query แบบ app/[game]/teams/page.tsx

const OPEN_STATUSES = ["REGISTRATION", "CHECK_IN", "SEEDING", "RUNNING"] as const;
const LIVE_REG_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] as const;
const DONE_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

type TRow = Omit<HomeTournament, "confirmed">;

/** เวลาอ้างอิงของคำขอนี้ (อ่านครั้งเดียวต่อคำขอใน server component · ส่งเป็น props ให้ HomeView) */
export async function loadRequestTime(): Promise<number> {
  return Date.now();
}

/** ทัวร์ Dota 2 ที่เปิดอยู่ 3 รายการ เรียง start_at + จำนวนทีมยืนยันแบบ app/[game]/tournaments/page.tsx:41 */
export async function loadTournamentsForYou(db: SupabaseClient): Promise<HomeTournament[]> {
  try {
    const { data, error } = await db
      .from("tournaments")
      .select("id, name, status, format, best_of, team_size, max_teams, start_at")
      .eq("game", "DOTA2")
      .in("status", [...OPEN_STATUSES])
      .order("start_at", { ascending: true, nullsFirst: false })
      .limit(3);
    if (error || !data) return [];
    const rows = data as TRow[];
    const counts = new Map<string, number>();
    if (rows.length) {
      const { data: regs } = await db
        .from("registrations")
        .select("tournament_id")
        .in("tournament_id", rows.map((r) => r.id))
        .in("status", ["CONFIRMED", "CHECKED_IN"]);
      for (const r of (regs ?? []) as { tournament_id: string }[]) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);
    }
    return rows.map((r) => ({ ...r, confirmed: counts.get(r.id) ?? 0 }));
  } catch {
    return [];
  }
}

/** team_id ของทีมที่ผู้ใช้เป็นสมาชิก ACTIVE (ทุกเกม) */
async function myTeamIds(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await db.from("team_members").select("team_id").eq("user_id", userId).eq("status", "ACTIVE");
  return ((data ?? []) as { team_id: string }[]).map((r) => r.team_id);
}

/** "กิจกรรมของฉัน": ทัวร์ที่ทีมของฉันสมัครแล้ว (ยังไม่ถอน/ไม่ถูกปฏิเสธ) และทัวร์ยังไม่จบ · สูงสุด 3 */
export async function loadMyActivities(db: SupabaseClient, userId: string): Promise<HomeActivity[]> {
  try {
    const teamIds = await myTeamIds(db, userId);
    if (!teamIds.length) return [];
    const { data: regs } = await db
      .from("registrations")
      .select("tournament_id")
      .in("team_id", teamIds)
      .in("status", [...LIVE_REG_STATUSES]);
    const ids = [...new Set(((regs ?? []) as { tournament_id: string }[]).map((r) => r.tournament_id))];
    if (!ids.length) return [];
    const { data } = await db
      .from("tournaments")
      .select("id, name, status, start_at, game")
      .in("id", ids)
      .order("start_at", { ascending: true, nullsFirst: false });
    return ((data ?? []) as { id: string; name: string; status: string; start_at: string | null; game: string }[])
      .filter((t) => !DONE_STATUSES.has(t.status) && isGameCode(t.game))
      .slice(0, 3)
      .map((t) => ({ id: t.id, name: t.name, status: t.status, start_at: t.start_at, game: slugOf(t.game as "DOTA2" | "MLBB") }));
  } catch {
    return [];
  }
}

/** "ทีมของฉัน": แบบ app/[game]/teams/page.tsx (game DOTA2 · ACTIVE) · สูงสุด 3 */
export async function loadMyTeams(db: SupabaseClient, userId: string): Promise<HomeTeam[]> {
  try {
    const { data } = await db
      .from("team_members")
      .select("status, teams!inner(id, name, tag, game)")
      .eq("teams.game", "DOTA2")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .limit(3);
    return ((data ?? []) as { teams: unknown }[]).flatMap((m) => {
      const t = (Array.isArray(m.teams) ? m.teams[0] : m.teams) as { id: string; name: string; tag: string | null } | undefined;
      return t ? [{ id: t.id, name: t.name, tag: t.tag }] : [];
    });
  } catch {
    return [];
  }
}
