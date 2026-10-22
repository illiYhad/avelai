"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  isSuspended,
  PLATFORM_ROLES,
  type PlatformRole,
} from "@/lib/auth/roles";

export type RoleActionState = { ok: boolean; message: string };

async function guardAdminNotSuspended() {
  const ctx = await requireAdmin("/admin/roles");
  const { data: me } = await ctx.db
    .from("users")
    .select("suspended_until")
    .eq("id", ctx.user.id)
    .single();
  if (me && isSuspended(me)) return null;
  return ctx;
}

/** ให้สิทธิ์ — insert user_roles (granted_by = ตัวเอง) · ห้ามลบแถวเดิม */
export async function grantRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const ctx = await guardAdminNotSuspended();
  if (!ctx) return { ok: false, message: "บัญชีถูกระงับ ไม่สามารถทำรายการได้" };

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !(PLATFORM_ROLES as readonly string[]).includes(role)) {
    return { ok: false, message: "ข้อมูลไม่ครบถ้วน" };
  }

  const { error } = await ctx.db.from("user_roles").insert({
    user_id: userId,
    role: role as PlatformRole,
    granted_by: ctx.user.id,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "ผู้ใช้นี้มีสิทธิ์นี้อยู่แล้ว" };
    }
    return { ok: false, message: "ให้สิทธิ์ไม่สำเร็จ กรุณาลองใหม่" };
  }
  revalidatePath("/admin/roles");
  return { ok: true, message: "ให้สิทธิ์แล้ว" };
}

/** ถอนสิทธิ์ — update revoked_at = now() (ห้ามลบแถว) · ห้ามถอน ADMIN ของตัวเอง */
export async function revokeRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const ctx = await guardAdminNotSuspended();
  if (!ctx) return { ok: false, message: "บัญชีถูกระงับ ไม่สามารถทำรายการได้" };

  const roleRowId = String(formData.get("role_row_id") ?? "");
  if (!roleRowId) return { ok: false, message: "ข้อมูลไม่ครบถ้วน" };

  const { data: row } = await ctx.db
    .from("user_roles")
    .select("user_id, role, revoked_at")
    .eq("id", roleRowId)
    .single();
  if (!row) return { ok: false, message: "ไม่พบแถวสิทธิ์นี้" };
  if (row.revoked_at) return { ok: false, message: "สิทธิ์นี้ถูกถอนไปแล้ว" };
  if (row.user_id === ctx.user.id && row.role === "ADMIN") {
    return { ok: false, message: "ถอน ADMIN ของตัวเองไม่ได้" };
  }

  const { error } = await ctx.db
    .from("user_roles")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", roleRowId);
  if (error) return { ok: false, message: "ถอนสิทธิ์ไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/admin/roles");
  return { ok: true, message: "ถอนสิทธิ์แล้ว" };
}
