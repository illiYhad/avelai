"use server";

import { headers } from "next/headers";
import { safeNext } from "@/lib/auth/validate";
import { resolveSiteOrigin } from "@/lib/auth/site-origin";

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

  // กัน host header poisoning: ใช้ SITE_URL (https) ก่อนเสมอ · production จริงที่ไม่ตั้ง = ไม่ส่งลิงก์ (K-AV-H8)
  // fallback เป็น header เฉพาะ Preview/dev · ชั้นสุดท้ายคือ Redirect URLs allowlist ใน Supabase
  const h = await headers();
  const origin = resolveSiteOrigin({
    siteUrl: process.env.SITE_URL,
    vercelEnv: process.env.VERCEL_ENV,
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto"),
  });
  if (!origin) return { ok: false, message: "ระบบล็อกอินยังตั้งค่าโดเมนไม่ครบ" };
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

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
