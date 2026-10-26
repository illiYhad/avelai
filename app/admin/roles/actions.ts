"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  isSuspended,
  PLATFORM_ROLES,
  type PlatformRole,
} from "@/lib/auth/roles";
import { adminRpcMessage } from "@/lib/auth/admin-rpc";

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

/** ให้สิทธิ์ — rpc admin_grant_role (K-AV-FIX2) · สิทธิ์ ADMIN/SUPER_ADMIN ตรวจที่ DB · เหตุผลบังคับ */
export async function grantRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const ctx = await guardAdminNotSuspended();
  if (!ctx) return { ok: false, message: "บัญชีถูกระงับ ไม่สามารถทำรายการได้" };

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || !(PLATFORM_ROLES as readonly string[]).includes(role)) {
    return { ok: false, message: "ข้อมูลไม่ครบถ้วน" };
  }
  if (!reason) return { ok: false, message: "กรุณากรอกเหตุผล" };

  const { error } = await ctx.db.rpc("admin_grant_role", {
    p_user_id: userId,
    p_role: role as PlatformRole,
    p_reason: reason,
  });
  if (error) return { ok: false, message: adminRpcMessage(error, "ให้สิทธิ์ไม่สำเร็จ กรุณาลองใหม่") };
  revalidatePath("/admin/roles");
  return { ok: true, message: "ให้สิทธิ์แล้ว" };
}

/** ถอนสิทธิ์ — rpc admin_revoke_role (ตั้ง revoked_at · ห้ามลบแถว · ห้ามถอน SUPER_ADMIN คนสุดท้าย) · ห้ามถอน ADMIN ของตัวเอง */
export async function revokeRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const ctx = await guardAdminNotSuspended();
  if (!ctx) return { ok: false, message: "บัญชีถูกระงับ ไม่สามารถทำรายการได้" };

  const roleRowId = String(formData.get("role_row_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!roleRowId) return { ok: false, message: "ข้อมูลไม่ครบถ้วน" };
  if (!reason) return { ok: false, message: "กรุณากรอกเหตุผล" };

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

  const { error } = await ctx.db.rpc("admin_revoke_role", { p_role_id: roleRowId, p_reason: reason });
  if (error) return { ok: false, message: adminRpcMessage(error, "ถอนสิทธิ์ไม่สำเร็จ กรุณาลองใหม่") };

  revalidatePath("/admin/roles");
  return { ok: true, message: "ถอนสิทธิ์แล้ว" };
}
