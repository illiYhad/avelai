"use server";

// ตารางซ้อม + เช็กชื่อ (K-AV-R เฟส 3 ข้อ 11 — ของน้องเปา)
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";
import { isActiveTeamMember, NOT_MEMBER_RESULT } from "@/lib/team/access";
import { parseBangkokLocal } from "@/lib/team/time";
import { failWith } from "@/lib/server-errors";
import { isUserSuspended, SUSPENDED_RESULT } from "@/lib/auth/suspension";

export type ActionResult = { success: true } | { error: { code: string; message: string } };

const DB_OFF = { error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล (env ไม่ครบ)" } } as const;
const SESSION_TYPES = ["SCRIM", "SOLO_PRACTICE", "MEETING"] as const;

async function requireLeader(teamId: string) {
  const db = await getServerDb();
  if (!db) return { error: DB_OFF.error } as const;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อน" } } as const;
  if (await isUserSuspended(db, auth.user.id)) return SUSPENDED_RESULT;
  const { data: member } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", auth.user.id)
    .eq("status", "ACTIVE")
    .in("role", ["OWNER", "CAPTAIN", "MANAGER", "COACH"])
    .maybeSingle();
  if (!member) return { error: { code: "FORBIDDEN", message: "เฉพาะหัวหน้าทีมเท่านั้น" } } as const;
  return { db, userId: auth.user.id } as const;
}

export async function createSessionAction(teamId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireLeader(teamId);
  if ("error" in ctx) return { error: ctx.error as { code: string; message: string } };
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const title = (formData.get("title") as string | null)?.trim() || null;
  const sessionType = String(formData.get("sessionType") ?? "SCRIM");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = (formData.get("endsAt") as string | null) || null;

  if (!SESSION_TYPES.includes(sessionType as (typeof SESSION_TYPES)[number])) {
    return { error: { code: "INVALID_TYPE", message: "ประเภทนัดซ้อมไม่ถูกต้อง" } };
  }
  // เวลาที่กรอกคือเวลาไทย (Asia/Bangkok) — ห้ามใช้ new Date(str) ตรง ๆ (server เป็น UTC)
  const startDate = parseBangkokLocal(startsAt);
  if (!startDate) {
    return { error: { code: "INVALID_TIME", message: "กรุณาระบุวันเวลาเริ่มให้ถูกต้อง" } };
  }
  const endDate = endsAt ? parseBangkokLocal(endsAt) : null;
  if (endsAt && (!endDate || endDate <= startDate)) {
    return { error: { code: "INVALID_TIME", message: "เวลาจบต้องอยู่หลังเวลาเริ่ม" } };
  }

  const { data: session, error } = await admin
    .from("practice_sessions")
    .insert({
      team_id: teamId,
      title,
      session_type: sessionType,
      starts_at: startDate.toISOString(),
      ends_at: endDate ? endDate.toISOString() : null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !session) {
    return failWith("CREATE_FAILED", error, "สร้างนัดซ้อมไม่สำเร็จ");
  }

  // สร้างแถว attendance ให้สมาชิก ACTIVE ทุกคน (รอ RSVP)
  const { data: members } = await admin
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("status", "ACTIVE");

  const rows = ((members ?? []) as { user_id: string }[]).map((m) => ({
    session_id: session.id,
    user_id: m.user_id,
  }));
  if (rows.length > 0) {
    const { error: attError } = await admin.from("practice_attendance").insert(rows);
    if (attError) {
      // ไม่ปล่อยนัดที่ไม่มีแถวเช็กชื่อค้าง (RSVP/เช็กชื่อจะเงียบหาย) → ลบนัดที่เพิ่งสร้าง
      await admin.from("practice_sessions").delete().eq("id", session.id);
      return failWith("ATTENDANCE_ROWS_FAILED", attError, "สร้างนัดซ้อมไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  await logAudit({
    action: "PRACTICE_SESSION_CREATE",
    table_name: "practice_sessions",
    record_id: session.id,
    payload: { team_id: teamId, session_type: sessionType, starts_at: startDate.toISOString() },
    performed_by: ctx.userId,
  });

  revalidatePath(`/team/${teamId}/schedule`);
  return { success: true };
}

export async function rsvpAction(teamId: string, sessionId: string, going: boolean): Promise<ActionResult> {
  const db = await getServerDb();
  if (!db) return DB_OFF;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อน" } };
  if (await isUserSuspended(db, auth.user.id)) return SUSPENDED_RESULT;
  // K-AV-H3: ต้องเป็นสมาชิก ACTIVE ของทีมนี้ก่อน RSVP
  if (!(await isActiveTeamMember(db, teamId, auth.user.id))) return NOT_MEMBER_RESULT;

  // ผ่าน RLS: อัปเดตได้เฉพาะแถวตัวเอง + คอลัมน์ rsvp เท่านั้น (120_team_management.sql)
  const { error } = await db
    .from("practice_attendance")
    .update({ rsvp: going ? "GOING" : "NOT_GOING" })
    .eq("session_id", sessionId)
    .eq("user_id", auth.user.id);

  if (error) return failWith("RSVP_FAILED", error);
  revalidatePath(`/team/${teamId}/schedule`);
  return { success: true };
}

export async function checkAttendanceAction(
  teamId: string,
  sessionId: string,
  userId: string,
  attended: boolean,
): Promise<ActionResult> {
  const ctx = await requireLeader(teamId);
  if ("error" in ctx) return { error: ctx.error as { code: string; message: string } };
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  // กันข้ามทีม: session ต้องเป็นของทีมนี้
  const { data: session } = await admin
    .from("practice_sessions")
    .select("id, team_id")
    .eq("id", sessionId)
    .single();
  if (!session || session.team_id !== teamId) {
    return { error: { code: "SESSION_NOT_FOUND", message: "ไม่พบนัดซ้อมของทีมนี้" } };
  }

  // ผู้ถูกเช็กชื่อต้องเป็นสมาชิก ACTIVE ของทีมนี้
  const { data: target } = await admin
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!target) return { error: { code: "NOT_A_MEMBER", message: "ผู้เล่นคนนี้ไม่ได้เป็นสมาชิกทีม" } };

  // upsert: สมาชิกที่เข้าทีมหลังสร้างนัดยังไม่มีแถว attendance — เดิม update จะไม่เจอแถวแล้วเงียบ (สำเร็จหลอก)
  const { data: saved, error } = await admin
    .from("practice_attendance")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        attended,
        checked_by: ctx.userId,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "session_id,user_id" },
    )
    .select("attended")
    .maybeSingle();

  if (error) return failWith("CHECK_FAILED", error);
  if (!saved || saved.attended !== attended) {
    return failWith("CHECK_NOT_SAVED", { sessionId, userId, saved }, "บันทึกการเช็กชื่อไม่สำเร็จ กรุณาลองใหม่");
  }

  revalidatePath(`/team/${teamId}/schedule`);
  return { success: true };
}
