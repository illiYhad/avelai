"use server";

// ตารางซ้อม + เช็กชื่อ (K-AV-R เฟส 3 ข้อ 11 — ของน้องเปา)
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";
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
  const startDate = new Date(startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return { error: { code: "INVALID_TIME", message: "กรุณาระบุวันเวลาเริ่มให้ถูกต้อง" } };
  }
  const endDate = endsAt ? new Date(endsAt) : null;
  if (endDate && (Number.isNaN(endDate.getTime()) || endDate <= startDate)) {
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
  if (rows.length > 0) await admin.from("practice_attendance").insert(rows);

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

  const { error } = await admin
    .from("practice_attendance")
    .update({
      attended,
      checked_by: ctx.userId,
      checked_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  if (error) return failWith("CHECK_FAILED", error);

  revalidatePath(`/team/${teamId}/schedule`);
  return { success: true };
}
