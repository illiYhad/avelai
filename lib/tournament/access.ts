import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerDb } from "@/lib/db/server";
import { isUserSuspended } from "@/lib/auth/suspension";
import { activeRoles } from "@/lib/auth/roles";

// K-AV-3: ยามฝั่ง server สำหรับ action ของทัวร์ — ล็อกอิน → ไม่ถูกระงับ → สิทธิ์ (ตรวจจาก DB ไม่เชื่อ client)
// ใช้ client ของผู้ใช้เอง (RLS คุมอีกชั้น) · ไม่ใช้ service role

export type Ctx = { db: SupabaseClient; userId: string };
export type Guard<T = Ctx> = { ok: true; ctx: T } | { ok: false; message: string };

export async function requireActiveUser(): Promise<Guard> {
  const db = await getServerDb();
  if (!db) return { ok: false, message: "ยังไม่ต่อฐานข้อมูล" };
  const { data } = await db.auth.getUser();
  if (!data.user) return { ok: false, message: "กรุณาเข้าสู่ระบบก่อน" };
  if (await isUserSuspended(db, data.user.id)) return { ok: false, message: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถทำรายการได้" };
  return { ok: true, ctx: { db, userId: data.user.id } };
}

export async function platformRoles(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await db.from("user_roles").select("role, revoked_at").eq("user_id", userId);
  return activeRoles((data ?? []) as { role: string; revoked_at: string | null }[]);
}

export type TournamentRow = {
  id: string; organizer_id: string; name: string; game: string; format: string; team_size: number; best_of: number;
  status: string; reg_open_at: string | null; reg_close_at: string | null; check_in_minutes: number; start_at: string | null;
  max_teams: number | null; entry_type: string; entry_fee_thb: number | string; rules: string | null;
};
export const TOURNAMENT_COLS = "id, organizer_id, name, game, format, team_size, best_of, status, reg_open_at, reg_close_at, check_in_minutes, start_at, max_teams, entry_type, entry_fee_thb, rules";

/** PromptPay ของผู้จัด (ตาราง tournament_promptpay · RLS: staff/ADMIN/หัวหน้าทีมที่สมัครแล้ว) · อ่านไม่ได้/ไม่มี = null */
export async function tournamentPromptPay(db: SupabaseClient, tournamentId: string): Promise<string | null> {
  const { data } = await db.from("tournament_promptpay").select("promptpay_id").eq("tournament_id", tournamentId).maybeSingle();
  return (data as { promptpay_id: string } | null)?.promptpay_id ?? null;
}

export type StaffLevel = "ORGANIZER" | "STAFF" | "NONE";

/** ผู้จัดเจ้าของ = ORGANIZER · อยู่ใน tournament_staff (REFEREE/STAFF) หรือ ADMIN = STAFF */
export async function tournamentStaffLevel(db: SupabaseClient, userId: string, t: { id: string; organizer_id: string }): Promise<StaffLevel> {
  if (t.organizer_id === userId) return "ORGANIZER";
  if ((await platformRoles(db, userId)).includes("ADMIN")) return "ORGANIZER";
  const { data } = await db.from("tournament_staff").select("role").eq("tournament_id", t.id).eq("user_id", userId).maybeSingle();
  return data ? "STAFF" : "NONE";
}

/** ทีมที่ผู้ใช้เป็นหัวหน้า (OWNER/CAPTAIN/MANAGER) · กรองเกมได้ */
export async function leaderTeams(db: SupabaseClient, userId: string, game?: string): Promise<{ id: string; name: string; tag: string; game: string }[]> {
  const { data } = await db
    .from("team_members")
    .select("role, teams!inner(id, name, tag, game, deleted_at)")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .in("role", ["OWNER", "CAPTAIN", "MANAGER"]);
  type T = { id: string; name: string; tag: string; game: string | null; deleted_at: string | null };
  return (data ?? [])
    .map((m) => (Array.isArray(m.teams) ? m.teams[0] : m.teams) as T)
    .filter((t) => t && !t.deleted_at && (!game || (t.game ?? "MLBB") === game))
    .map((t) => ({ id: t.id, name: t.name, tag: t.tag, game: t.game ?? "MLBB" }));
}

/** แปลง error จาก DB เป็นข้อความไทย (ไม่สะท้อนข้อความดิบ) */
export function dbMessage(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.message?.includes("TOURNAMENT_INVALID_TRANSITION")) return "เปลี่ยนสถานะข้ามขั้นไม่ได้";
  if (error.message?.includes("TOURNAMENT_PAID_NEEDS_PROMPTPAY")) return "ทัวร์แบบจ่ายค่าเข้าต้องตั้ง PromptPay ของผู้จัดก่อนเปิดรับสมัคร";
  if (error.message?.includes("REGISTRATION_INVALID_TRANSITION") || error.message?.includes("REGISTRATION_IMMUTABLE")) return "เปลี่ยนสถานะใบสมัครแบบนี้ไม่ได้";
  if (error.message?.includes("PAYMENT_ALREADY_DECIDED")) return "รายการนี้ถูกตัดสินไปแล้ว";
  if (error.message?.includes("PAYMENT_IMMUTABLE") || error.message?.includes("PAYMENT_VERIFIER_MISMATCH")) return "แก้รายการชำระแบบนี้ไม่ได้";
  // K-AV-3F: trigger ฝั่ง DB (140) — ข้อความดิบไม่สะท้อนออกไป
  if (error.message?.includes("PAYMENT_AMOUNT_MISMATCH")) return "ยอดโอนไม่ตรงค่าเข้าของทัวร์/ราคา Pass";
  if (error.message?.includes("PAYMENT_SLIP_MISSING")) return "ไม่พบไฟล์สลิปที่อ้างถึง กรุณาอัปโหลดใหม่";
  if (error.message?.includes("PAYMENT_INSERT_NOT_PENDING") || error.message?.includes("PAYMENT_PAYER_MISMATCH") || error.message?.includes("PAYMENT_REGISTRATION_NOT_FOUND")) return "ส่งสลิปไม่ได้ (ข้อมูลรายการชำระไม่ถูกต้อง)";
  if (error.message?.includes("PASS_PAYMENT_INVALID") || error.message?.includes("PASS_WINDOW_INVALID")) return "สร้าง Pass ไม่ได้ — ต้องอ้างสลิป Pass ที่ยืนยันแล้วของผู้ใช้/เกมเดียวกัน และอายุ 28 วัน";
  if (error.message?.includes("TOURNAMENT_LOCKED_FIELD")) return "พ้นช่วงร่างแล้ว แก้เกม/รูปแบบ/ขนาดทีม/best-of/ค่าเข้า/เจ้าของทัวร์ไม่ได้";
  if (error.message?.includes("TOURNAMENT_MAX_TEAMS_BELOW_REGISTERED")) return "ลดจำนวนทีมสูงสุดให้ต่ำกว่าจำนวนที่สมัครแล้วไม่ได้";
  if (error.code === "23505") return "มีรายการนี้อยู่แล้ว";
  if (error.code === "42501") return "ไม่มีสิทธิ์ทำรายการนี้";
  return fallback;
}
