"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isSuspended } from "@/lib/auth/roles";
import { validateUsername, validateAvatarUrl } from "@/lib/auth/validate";

export type ProfileState = { ok: boolean; message: string };

/** แก้โปรไฟล์ — ส่งเฉพาะ username + avatar_url (DB บล็อกคอลัมน์อื่นด้วย GRANT อยู่แล้ว) */
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const { db, user } = await requireUser("/me");

  const { data: profile } = await db
    .from("users")
    .select("suspended_until")
    .eq("id", user.id)
    .single();
  if (profile && isSuspended(profile)) {
    return { ok: false, message: "บัญชีถูกระงับ ไม่สามารถแก้ไขข้อมูลได้" };
  }

  const username = String(formData.get("username") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();

  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, message: usernameError };
  const avatarError = validateAvatarUrl(avatarUrl);
  if (avatarError) return { ok: false, message: avatarError };

  const { error } = await db
    .from("users")
    .update({ username, avatar_url: avatarUrl === "" ? null : avatarUrl })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "ชื่อนี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น" };
    }
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/me");
  return { ok: true, message: "บันทึกแล้ว" };
}
