"use server";

import { headers } from "next/headers";
import { safeNext } from "@/lib/auth/validate";

export type LoginState = { ok: boolean; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ส่ง magic link (OTP) — ข้อความเดียวกันไม่ว่าอีเมลนี้มีบัญชีหรือไม่ */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "กรอกอีเมลให้ถูกต้อง" };
  }

  const { getServerDb } = await import("@/lib/db/server");
  const db = await getServerDb();
  if (!db) return { ok: false, message: "ระบบล็อกอินยังไม่เปิด" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const redirectTo = `${proto}://${host}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    // ไม่สะท้อน error ดิบ และไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่
    return { ok: false, message: "ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  return { ok: true, message: "เช็กอีเมลของคุณ — เราส่งลิงก์เข้าสู่ระบบไปให้แล้ว" };
}
