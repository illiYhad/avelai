"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/validate";

export type LoginState = { ok: boolean; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** กัน host header poisoning: ใช้ SITE_URL ที่ตั้งค่าไว้ก่อนเสมอ · fallback เป็น header เฉพาะ dev ในเครื่อง
 *  ชั้นสุดท้ายคือ Redirect URLs allowlist ใน Supabase (พี่หยัดตั้งตามใบตอบข้อ URL Configuration) */
async function resolveOrigin(): Promise<string> {
  const fixed = process.env.SITE_URL?.replace(/\/$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

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

  const redirectTo = `${await resolveOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;

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

/** K-AV-AUTH-G: ล็อกอินด้วย Google (OAuth) — สำเร็จ = redirect ไปหน้าขอสิทธิ์ของ Google · callback เดิมแลก code เป็น session
 *  ไม่สะท้อน error ดิบ (เช่น provider ยังไม่เปิดใน Supabase) */
export async function signInWithGoogle(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const next = safeNext(formData.get("next"));
  const { getServerDb } = await import("@/lib/db/server");
  const db = await getServerDb();
  if (!db) return { ok: false, message: "ระบบล็อกอินยังไม่เปิด" };

  const redirectTo = `${await resolveOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error || !data?.url) {
    return { ok: false, message: "ล็อกอินด้วย Google ยังไม่เปิดใช้งาน ใช้อีเมลแทนได้" };
  }
  redirect(data.url); // throw NEXT_REDIRECT — ต้องอยู่นอก try/catch
}
