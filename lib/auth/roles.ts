import { redirect, notFound } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// ส่วน pure (เทสด้วย vitest) + ยามฝั่ง server (requireUser / requireAdmin)
// หมายเหตุ: import lib/db/server แบบ dynamic ภายในฟังก์ชัน เพื่อให้ไฟล์นี้ import ใน vitest ได้
// (db/server มี "server-only" + next/headers ซึ่งรันนอก Next ไม่ได้)

export const PLATFORM_ROLES = ["PLAYER", "ORGANIZER", "REFEREE", "ADMIN", "SUPER_ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type RoleRow = { role: string; revoked_at: string | null; expires_at?: string | null };

/** ตัดแถวที่ถูกถอนสิทธิ์ (revoked_at ไม่ว่าง) หรือหมดอายุ (expires_at ≤ now) — ตามสเปกหมวด 1 + K-AV-FIX2
 *  SUPER_ADMIN นับเป็น ADMIN ด้วย (ตรงกับ is_admin() ใน 211) → จุดที่เช็ก includes("ADMIN") ไม่ต้องแก้ทีละที่ */
export function activeRoles(rows: RoleRow[], now: Date = new Date()): string[] {
  const roles = rows
    .filter((r) => r.revoked_at === null && (!r.expires_at || new Date(r.expires_at).getTime() > now.getTime()))
    .map((r) => r.role);
  if (roles.includes("SUPER_ADMIN") && !roles.includes("ADMIN")) roles.push("ADMIN");
  return roles;
}

export function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role);
}

/** suspended_until > now = ถูกระงับ · null/อดีต/เท่ากับตอนนี้พอดี = ไม่ถูกระงับ */
export function isSuspended(
  user: { suspended_until: string | null },
  now: Date = new Date(),
): boolean {
  if (!user.suspended_until) return false;
  return new Date(user.suspended_until).getTime() > now.getTime();
}

export type SessionContext = { db: SupabaseClient; user: User };

/** ต้องล็อกอิน — ไม่ล็อกอิน (หรือไม่มี env) = redirect ไป /login?next=<path> */
export async function requireUser(nextPath: string): Promise<SessionContext> {
  const { getServerDb } = await import("@/lib/db/server");
  const db = await getServerDb();
  if (!db) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const { data } = await db.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { db, user: data.user };
}

/** ต้องเป็น ADMIN (เช็กที่ DB ผ่าน rpc is_admin ด้วย session ผู้ใช้) — ไม่ใช่ = 404 */
export async function requireAdmin(nextPath: string): Promise<SessionContext> {
  const ctx = await requireUser(nextPath);
  const { data, error } = await ctx.db.rpc("is_admin");
  if (error || data !== true) notFound();
  return ctx;
}

/** SUPER_ADMIN ไหม (rpc is_super_admin) — error = false (fail closed) */
export async function isSuperAdmin(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc("is_super_admin");
  return !error && data === true;
}

/** ต้องเป็น SUPER_ADMIN (K-AV-FIX2) — ไม่ใช่ = 404 */
export async function requireSuperAdmin(nextPath: string): Promise<SessionContext> {
  const ctx = await requireUser(nextPath);
  if (!(await isSuperAdmin(ctx.db))) notFound();
  return ctx;
}
