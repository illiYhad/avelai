"use server";

// ยกจาก Zodiac actions/team.ts (เทสแล้ว) ปรับเข้ากับ AVELAi:
// - players/athlete_id/slug → public.users + username
// - ไม่มีตาราง games → game คงที่ 'MLBB'
// - ไม่อัปโหลดโลโก้เข้า storage (ยังไม่มี bucket ในโปรเจกต์ใหม่) — รับเป็น URL
// - audit_logs ใช้สคีมา 001 ผ่าน lib/audit.ts
// - notifications ของ Zodiac ไม่มีใน AVELAi → ตัดออก (ระบุในใบตอบ)

import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { checkRosterEligibility } from "@/lib/team/rosterEligibility";
import { logAudit } from "@/lib/audit";
import { failWith } from "@/lib/server-errors";
import { isUserSuspended, SUSPENDED_RESULT } from "@/lib/auth/suspension";

export type ActionResult =
  | { success: true; teamId?: string }
  | { error: { code: string; message: string } };

const DB_OFF = { error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล (env ไม่ครบ)" } } as const;

async function getCurrentUserId(): Promise<{ db: NonNullable<Awaited<ReturnType<typeof getServerDb>>>; userId: string } | null> {
  const db = await getServerDb();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  return { db, userId: data.user.id };
}

export async function createTeamAction(formData: FormData): Promise<ActionResult> {
  const name = (formData.get("name") as string | null)?.trim();
  const tag = (formData.get("tag") as string | null)?.trim().toUpperCase();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const logoUrl = (formData.get("logoUrl") as string | null)?.trim() || null;

  if (!name || name.length < 2 || name.length > 50) {
    return { error: { code: "INVALID_NAME", message: "ชื่อทีมต้องมีความยาวระหว่าง 2-50 ตัวอักษร" } };
  }
  if (!tag || tag.length < 2 || tag.length > 6) {
    return { error: { code: "INVALID_TAG", message: "แท็กทีม (Team Tag) ต้องมีความยาวระหว่าง 2-6 ตัวอักษร" } };
  }
  if (logoUrl && !/^https:\/\//.test(logoUrl)) {
    return { error: { code: "INVALID_LOGO_URL", message: "ลิงก์โลโก้ต้องขึ้นต้นด้วย https://" } };
  }

  const session = await getCurrentUserId();
  if (!session) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อนสร้างทีม" } };
  if (await isUserSuspended(session.db, session.userId)) return SUSPENDED_RESULT;
  // 1 คนสร้างได้ 1 ทีมต่อเกม (ตรรกะเดิมของ Zodiac)
  const { data: existingOwnTeam } = await session.db
    .from("teams")
    .select("id")
    .eq("owner_id", session.userId)
    .eq("game", "MLBB")
    .is("deleted_at", null)
    .maybeSingle();

  if (existingOwnTeam) {
    return { error: { code: "ALREADY_OWNER", message: "คุณเป็นเจ้าของทีมในเกมนี้อยู่แล้ว (1 คนสร้างได้ 1 ทีมต่อเกม)" } };
  }

  const baseSlug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || tag.toLowerCase();
  const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

  // K-AV-H2 (คำตัดสิน 07:15): เขียนด้วย service role ตามแบบ 110 — หลังเช็ก auth + suspended + กฎ 1 ทีม/เกม แล้วเท่านั้น
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const { data: newTeam, error: createError } = await admin
    .from("teams")
    .insert({
      name,
      tag,
      slug,
      description,
      logo_url: logoUrl,
      game: "MLBB",
      owner_id: session.userId,
      captain_id: session.userId,
    })
    .select("id")
    .single();

  if (createError || !newTeam) {
    return failWith("CREATE_FAILED", createError, "สร้างทีมไม่สำเร็จ");
  }

  const { error: memberError } = await admin.from("team_members").insert({
    team_id: newTeam.id,
    user_id: session.userId,
    role: "OWNER",
    status: "ACTIVE",
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    // ห้ามปล่อยทีมที่ไม่มีเจ้าของค้าง → ลบทีมที่เพิ่งสร้าง (ยังไม่มีสมาชิก/ข้อมูลอื่นผูก)
    const { error: rollbackError } = await admin.from("teams").delete().eq("id", newTeam.id);
    if (rollbackError) console.error("[TEAM_CREATE_ROLLBACK_FAILED]", newTeam.id, rollbackError);
    return failWith("MEMBER_ADD_FAILED", memberError, "สร้างทีมไม่สำเร็จ กรุณาลองใหม่");
  }

  await logAudit({
    action: "TEAM_CREATE",
    table_name: "teams",
    record_id: newTeam.id,
    payload: { name, tag, slug },
    performed_by: session.userId,
  });

  revalidatePath("/teams");
  revalidatePath(`/teams/${newTeam.id}`);
  return { success: true, teamId: newTeam.id };
}

export async function invitePlayerAction(teamId: string, formData: FormData): Promise<ActionResult> {
  const identifier = (formData.get("identifier") as string | null)?.trim();
  if (!identifier || !/^[A-Za-z0-9_-]{3,30}$/.test(identifier)) {
    return { error: { code: "INVALID_IDENTIFIER", message: "กรุณาระบุ username ของผู้เล่นให้ถูกต้อง" } };
  }

  const session = await getCurrentUserId();
  if (!session) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อน" } };
  if (await isUserSuspended(session.db, session.userId)) return SUSPENDED_RESULT;
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const { data: team } = await session.db
    .from("teams")
    .select("id, owner_id, captain_id, is_roster_locked")
    .eq("id", teamId)
    .single();

  if (!team) return { error: { code: "TEAM_NOT_FOUND", message: "ไม่พบทีมนี้" } };
  if (team.owner_id !== session.userId && team.captain_id !== session.userId) {
    return { error: { code: "FORBIDDEN", message: "เฉพาะเจ้าของทีมหรือกัปตันเท่านั้นที่เชิญผู้เล่นได้" } };
  }
  if (team.is_roster_locked) {
    return { error: { code: "ROSTER_LOCKED", message: "Roster ถูกล็อกแล้ว ไม่สามารถเพิ่มสมาชิกได้" } };
  }

  const { data: target } = await session.db
    .from("users")
    .select("id, username")
    .eq("username", identifier)
    .maybeSingle();

  if (!target) {
    return { error: { code: "PLAYER_NOT_FOUND", message: `ไม่พบผู้เล่น "${identifier}"` } };
  }

  // 1 คน = 1 ทีมต่อเกม (ตรรกะเดิมของ Zodiac)
  const { data: activeMemberships } = await session.db
    .from("team_members")
    .select("team_id, teams!inner(game)")
    .eq("user_id", target.id)
    .eq("status", "ACTIVE");

  const alreadyRostered = (activeMemberships ?? []).some((m) => {
    const joined = Array.isArray(m.teams) ? m.teams[0] : m.teams;
    return (joined as { game?: string } | null)?.game === "MLBB";
  });

  if (alreadyRostered) {
    return { error: { code: "PLAYER_ALREADY_ROSTERED", message: "ผู้เล่นคนนี้อยู่ทีมอื่นในเกมเดียวกันแล้ว" } };
  }

  // พฤติกรรมเดิมของ Zodiac (เทสแล้ว): เพิ่มเป็น ACTIVE ทันที
  const { error: insertError } = await admin.from("team_members").insert({
    team_id: teamId,
    user_id: target.id,
    role: "PLAYER",
    status: "ACTIVE",
    invited_by: session.userId,
    invited_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: { code: "ALREADY_MEMBER", message: "ผู้เล่นคนนี้อยู่ในทีมอยู่แล้ว" } };
    }
    return failWith("INVITE_FAILED", insertError);
  }

  await logAudit({
    action: "TEAM_MEMBER_ADD",
    table_name: "team_members",
    record_id: target.id,
    payload: { team_id: teamId, username: target.username },
    performed_by: session.userId,
  });

  revalidatePath(`/teams/${teamId}`);
  return { success: true };
}

export async function lockRosterAction(teamId: string): Promise<ActionResult> {
  const session = await getCurrentUserId();
  if (!session) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อน" } };
  if (await isUserSuspended(session.db, session.userId)) return SUSPENDED_RESULT;
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const { data: team } = await session.db
    .from("teams")
    .select("id, owner_id, captain_id, is_roster_locked")
    .eq("id", teamId)
    .single();

  if (!team) return { error: { code: "TEAM_NOT_FOUND", message: "ไม่พบทีมนี้" } };
  if (team.owner_id !== session.userId && team.captain_id !== session.userId) {
    return { error: { code: "FORBIDDEN", message: "เฉพาะเจ้าของทีมหรือกัปตันเท่านั้นที่ล็อก Roster ได้" } };
  }
  if (team.is_roster_locked) return { success: true }; // idempotent เหมือน Zodiac

  const eligibility = await checkRosterEligibility(session.db, teamId);
  if (!eligibility.isComplete) {
    return {
      error: {
        code: "TEAM_ROSTER_INCOMPLETE",
        message: `ทีมต้องมีสมาชิก ACTIVE ครบ ${eligibility.requiredCount} คนก่อนล็อก (ปัจจุบัน ${eligibility.activeCount} คน)`,
      },
    };
  }

  const { data: activeMembers } = await session.db
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", teamId)
    .eq("status", "ACTIVE");

  const { data: snapshot, error: snapshotError } = await admin
    .from("roster_snapshots")
    .insert({ team_id: teamId })
    .select("id")
    .single();

  if (snapshotError || !snapshot) {
    return failWith("SNAPSHOT_FAILED", snapshotError, "สร้าง roster snapshot ไม่สำเร็จ");
  }

  const memberRows = ((activeMembers ?? []) as { user_id: string; role: string }[]).map((m) => ({
    snapshot_id: snapshot.id,
    user_id: m.user_id,
    role: m.role,
  }));

  if (memberRows.length > 0) {
    await admin.from("roster_snapshot_members").insert(memberRows);
  }

  const { error: lockError } = await admin
    .from("teams")
    .update({ is_roster_locked: true })
    .eq("id", teamId);

  if (lockError) {
    return failWith("LOCK_FAILED", lockError);
  }

  await logAudit({
    action: "ROSTER_LOCK",
    table_name: "roster_snapshots",
    record_id: snapshot.id,
    payload: { team_id: teamId, member_count: memberRows.length },
    performed_by: session.userId,
  });

  revalidatePath(`/teams/${teamId}`);
  return { success: true };
}
