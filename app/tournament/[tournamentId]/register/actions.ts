"use server";

// ยกจาก Zodiac actions/registration.ts (เทสแล้ว) — เฉพาะเส้นสมัครฟรี:
// ตัด AP / entry fee / payment ทั้งหมดตามใบงาน K-AV-R
// idempotent ด้วย UNIQUE (tournament_id, team_id) แทน RPC create_tournament_registration

import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { checkRosterEligibility } from "@/lib/team/rosterEligibility";
import { logAudit } from "@/lib/audit";

export type RegistrationResult =
  | { success: true; status: string; existing: boolean }
  | { error: { code: string; message: string } };

export async function registerTeamAction(
  tournamentId: string,
  teamId: string,
): Promise<RegistrationResult> {
  const db = await getServerDb();
  if (!db) return { error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล (env ไม่ครบ)" } };

  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อนสมัคร" } };
  const userId = auth.user.id;

  const { data: team } = await db
    .from("teams")
    .select("id, owner_id, captain_id")
    .eq("id", teamId)
    .single();

  if (!team) return { error: { code: "TEAM_NOT_FOUND", message: "ไม่พบทีมนี้" } };
  if (team.owner_id !== userId && team.captain_id !== userId) {
    return { error: { code: "FORBIDDEN", message: "เฉพาะเจ้าของทีมหรือกัปตันเท่านั้นที่สมัครแทนทีมได้" } };
  }

  // status ทัวร์ต้อง active และยังไม่เริ่ม (เทียบเวลา server เท่านั้น — ไม่รับเวลาจาก client)
  const { data: tournament } = await db
    .from("tournament_instances")
    .select("id, tier, status, start_at")
    .eq("id", tournamentId)
    .single();

  if (!tournament) return { error: { code: "TOURNAMENT_NOT_FOUND", message: "ไม่พบทัวร์นาเมนต์นี้" } };
  if (tournament.status !== "active" || new Date(tournament.start_at).getTime() <= Date.now()) {
    return { error: { code: "REGISTRATION_CLOSED", message: "ทัวร์นาเมนต์นี้ปิดรับสมัครแล้ว" } };
  }

  const eligibility = await checkRosterEligibility(db, teamId);

  const admin = getAdminDb();
  if (!admin) return { error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล (env ไม่ครบ)" } };

  // เช็คซ้ำก่อน (idempotent เหมือน RPC ของ Zodiac)
  const { data: existing } = await admin
    .from("tournament_registrations")
    .select("id, status")
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (existing) {
    return { success: true, status: existing.status, existing: true };
  }

  // snapshot roster ณ เวลาสมัคร (ตรรกะเดียวกับ create_tournament_registration)
  const { data: snapshot } = await admin
    .from("roster_snapshots")
    .insert({ team_id: teamId, tournament_id: tournamentId })
    .select("id")
    .single();

  if (snapshot) {
    const { data: activeMembers } = await admin
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId)
      .eq("status", "ACTIVE");
    const rows = ((activeMembers ?? []) as { user_id: string; role: string }[]).map((m) => ({
      snapshot_id: snapshot.id,
      user_id: m.user_id,
      role: m.role,
    }));
    if (rows.length > 0) await admin.from("roster_snapshot_members").insert(rows);
  }

  const status = eligibility.isComplete ? "ELIGIBLE" : "PENDING";
  const { data: registration, error: regError } = await admin
    .from("tournament_registrations")
    .insert({
      tournament_id: tournamentId,
      team_id: teamId,
      roster_snapshot_id: snapshot?.id ?? null,
      status,
    })
    .select("id, status")
    .single();

  if (regError || !registration) {
    if (regError?.code === "23505") {
      return { success: true, status: "PENDING", existing: true };
    }
    return { error: { code: "REGISTRATION_FAILED", message: regError?.message ?? "สมัครไม่สำเร็จ" } };
  }

  await logAudit({
    action: "TOURNAMENT_REGISTER",
    table_name: "tournament_registrations",
    record_id: registration.id,
    payload: { tournament_id: tournamentId, team_id: teamId, status: registration.status },
    performed_by: userId,
  });

  revalidatePath(`/tournament/${tournamentId}/register`);
  return { success: true, status: registration.status, existing: false };
}
