"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/db/admin";
import { getServerDb } from "@/lib/db/server";
import type { SteamLinkError } from "@/lib/game-accounts/steam";
import { buildLinkPendingDeps, buildPersonaDeps, buildSteamLoginDeps } from "@/lib/game-accounts/steam-deps";
import {
  createFromPending, linkPendingToUser, pendingSecret, readPending,
  CHOOSE_MESSAGES, OTP_BAD_CODE_MESSAGE, OTP_BAD_EMAIL_MESSAGE, OTP_RESEND_SEC, OTP_SENT_COOKIE, OTP_SENT_MESSAGE, OTP_WAIT_MESSAGE,
  PENDING_COOKIE, PENDING_COOKIE_PATH, type ChooseError, type Pending,
} from "@/lib/game-accounts/steam-pending";

// K-AV-STEAMLOGIN.2: action ของหน้า /login/steam/choose
// ทุก action อ่าน cookie pending ใหม่และตรวจลายเซ็นเองทุกครั้ง — ไม่เชื่อค่าใดจากฟอร์มว่าเป็น Steam ID
// ห้าม log อีเมล · รหัส · ค่า cookie · ไม่สะท้อน error ดิบของ Supabase

export type ChooseState = { ok: boolean; message: string; step?: "email" | "code"; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

type Jar = Awaited<ReturnType<typeof cookies>>;

function pendingFrom(jar: Jar): Pending | null {
  return readPending(jar.get(PENDING_COOKIE)?.value, pendingSecret(process.env));
}

function clearPending(jar: Jar) {
  jar.set(PENDING_COOKIE, "", { path: PENDING_COOKIE_PATH, maxAge: 0 });
  jar.set(OTP_SENT_COOKIE, "", { path: PENDING_COOKIE_PATH, maxAge: 0 });
}

/** ก. "ฉันเป็นผู้เล่นใหม่" → สร้างบัญชี + ผูก Steam → /me */
export async function newPlayerAction(_prev: ChooseState, _formData: FormData): Promise<ChooseState> {
  void _formData;
  const jar = await cookies();
  const pending = pendingFrom(jar);
  const result = await createFromPending({ pending, deps: buildSteamLoginDeps(await getServerDb(), getAdminDb()), persona: buildPersonaDeps(getAdminDb()) });
  if (!result.ok) {
    // ใช้ไม่ได้แล้ว (หมดอายุ หรือ Steam ถูกผูกไปแล้ว) = ลบ cookie · ล้มชั่วคราว = เก็บไว้ให้ลองใหม่ได้ภายในอายุเดิม
    if (result.error === "expired" || result.error === "taken") clearPending(jar);
    return { ok: false, message: CHOOSE_MESSAGES[result.error] };
  }
  clearPending(jar);
  redirect("/me");
}

/** ข. ขั้น 1: ส่งรหัส 6 หลักไปอีเมล · ข้อความเดียวกันไม่ว่ามีบัญชีหรือไม่ (Q3) · ไม่สร้างบัญชี */
export async function sendCodeAction(_prev: ChooseState, formData: FormData): Promise<ChooseState> {
  const jar = await cookies();
  if (!pendingFrom(jar)) return { ok: false, message: CHOOSE_MESSAGES.expired };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, message: OTP_BAD_EMAIL_MESSAGE, step: "email" };
  if (jar.get(OTP_SENT_COOKIE)) return { ok: false, message: OTP_WAIT_MESSAGE, step: "code", email };

  const db = await getServerDb();
  if (!db) return { ok: false, message: CHOOSE_MESSAGES.unavailable };
  // shouldCreateUser: false → อีเมลที่ไม่มีบัญชีจะไม่ถูกสร้าง · ผลลัพธ์/ข้อผิดพลาดจาก Supabase ไม่ถูกเปิดเผย (กันเดาว่าอีเมลไหนมีบัญชี)
  await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  jar.set(OTP_SENT_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: PENDING_COOKIE_PATH,
    maxAge: OTP_RESEND_SEC,
  });
  return { ok: true, message: OTP_SENT_MESSAGE, step: "code", email };
}

/** ข. ขั้น 2: ตรวจรหัส → ได้ session บัญชีเดิม → ผูก Steam ID จาก cookie → ลบ cookie → /me */
export async function verifyCodeAction(_prev: ChooseState, formData: FormData): Promise<ChooseState> {
  const jar = await cookies();
  const pending = pendingFrom(jar);
  if (!pending) return { ok: false, message: CHOOSE_MESSAGES.expired };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, message: OTP_BAD_EMAIL_MESSAGE, step: "email" };
  if (!CODE_RE.test(code)) return { ok: false, message: OTP_BAD_CODE_MESSAGE, step: "code", email };

  const db = await getServerDb();
  if (!db) return { ok: false, message: CHOOSE_MESSAGES.unavailable };
  const { data, error } = await db.auth.verifyOtp({ email, token: code, type: "email" });
  const userId = data?.user?.id;
  if (error || !userId) return { ok: false, message: OTP_BAD_CODE_MESSAGE, step: "code", email };

  // userId มาจาก session ที่ verifyOtp เพิ่งตั้งเท่านั้น — ไม่รับจากฟอร์ม
  const result = await linkPendingToUser({ pending, userId, deps: buildLinkPendingDeps(getAdminDb()) });
  // K-AV-STEAMLOGIN.2a: ถึงตรงนี้ verifyOtp ตั้ง session แล้ว — ถ้าตอบกลับเข้าฟอร์ม หน้า choose จะ render ใหม่
  // เห็น session แล้วพาไป /link/steam/start ซึ่งเขียนทับ Steam เดิมได้ (ขัด Q4) · จึงลบ cookie pending ทุกกรณีแล้วจบที่ /me
  clearPending(jar);
  if (!result.ok) redirect(`/me?link_error=${REFUSED_TO_LINK_ERROR[result.error]}`);
  redirect("/me?linked=steam");
}

/** ผลปฏิเสธจาก linkPendingToUser → รหัส link_error ที่ /me แสดงข้อความ (LINK_MESSAGES.errors) */
const REFUSED_TO_LINK_ERROR: Record<ChooseError, SteamLinkError> = {
  other_steam: "other_steam",
  taken: "already",
  suspended: "suspended",
  unavailable: "unavailable",
  failed: "failed",
  expired: "failed",
};
