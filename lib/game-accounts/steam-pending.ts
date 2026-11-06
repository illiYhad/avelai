import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { steamLoginEmail, toDotaAccountId, type SteamLoginDeps } from "@/lib/game-accounts/steam";
import type { SteamPersona } from "@/lib/game-accounts/steam-persona";

// K-AV-STEAMLOGIN.2: ล็อกอิน Steam ครั้งแรก "ถามก่อนสร้างบัญชี"
// Steam ตรวจผ่านแล้วแต่ไม่รู้จัก Steam ID → จำ Steam ID ไว้ใน cookie มีลายเซ็น 10 นาที แล้วให้ผู้ใช้เลือกที่ /login/steam/choose
//   ก. ผู้เล่นใหม่ → createFromPending (สร้างบัญชี + ผูก Steam)
//   ข. มีบัญชีอยู่แล้ว → ยืนยันอีเมลด้วยรหัส 6 หลัก แล้ว linkPendingToUser (ผูกเข้าบัญชีเดิม)
// ไฟล์นี้ไม่แตะ DB/Auth เอง — ทุกอย่างฉีดผ่าน deps (เทสได้ ไม่ยิงจริง) · ห้าม log ค่า cookie · secret · อีเมล
//
// ข้อจำกัดที่รู้: "ใช้ได้ครั้งเดียว" ไม่มีที่เก็บ nonce ฝั่ง server (ใบสั่งไม่แตะฐานข้อมูล)
//   กันใช้ซ้ำด้วย (1) ลบ cookie ทันทีเมื่อใช้สำเร็จ (2) ทั้งสองทางปฏิเสธเมื่อ Steam ID ถูกผูกไปแล้ว (3) อายุ 10 นาที

export const PENDING_COOKIE = "steam_pending";
/** path แคบที่สุดที่ใช้ได้: หน้าเลือกและ server action ของหน้านั้นอยู่ใต้ /login/steam ทั้งหมด */
export const PENDING_COOKIE_PATH = "/login/steam";
export const PENDING_TTL_SEC = 600;
export const CHOOSE_PATH = "/login/steam/choose";
/** กันกดส่งรหัสรัว: มี cookie นี้ = เพิ่งส่งไปไม่เกิน 60 วินาที (ต่อเบราว์เซอร์) */
export const OTP_SENT_COOKIE = "steam_otp_sent";
export const OTP_RESEND_SEC = 60;
const SECRET_MIN_LENGTH = 32;
const VERSION = "v1";

/** STEAM_PENDING_SECRET · ไม่มีหรือสั้นกว่า 32 ตัวอักษร = null → ปิดทาง Steam ครั้งแรกทั้งหมด (fail closed)
 *  ไม่มีค่าสำรองในโค้ด และไม่มีข้อยกเว้นให้ dev */
export function pendingSecret(env: Record<string, string | undefined>): string | null {
  const s = env.STEAM_PENDING_SECRET?.trim();
  return s && s.length >= SECRET_MIN_LENGTH ? s : null;
}

const sign = (payload: string, secret: string): string => createHmac("sha256", secret).update(payload).digest("hex");

/** ค่า cookie = v1.<steam64>.<หมดอายุ unix วินาที>.<nonce 32 hex>.<HMAC-SHA256 hex ของสี่ส่วนแรก> */
export function signPending(steam64: string, secret: string, now: Date = new Date(), nonce: string = randomBytes(16).toString("hex")): string {
  const exp = Math.floor(now.getTime() / 1000) + PENDING_TTL_SEC;
  const payload = `${VERSION}.${steam64}.${exp}.${nonce}`;
  return `${payload}.${sign(payload, secret)}`;
}

export type Pending = { steam64: string; accountId: string; exp: number };

const PENDING_RE = /^(v1\.(7656119\d{10})\.(\d{10})\.([0-9a-f]{32}))\.([0-9a-f]{64})$/;

/** ตรวจค่า cookie · รูปแบบผิด · ลายเซ็นผิด · หมดอายุ · ไม่มี secret = null (ไม่บอกเหตุผล) · เทียบลายเซ็นแบบ timing-safe */
export function readPending(value: string | null | undefined, secret: string | null, now: Date = new Date()): Pending | null {
  if (!secret || typeof value !== "string") return null;
  const m = PENDING_RE.exec(value);
  if (!m) return null;
  const expected = Buffer.from(sign(m[1], secret), "hex");
  const given = Buffer.from(m[5], "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const exp = Number(m[3]);
  const nowSec = Math.floor(now.getTime() / 1000);
  // หมดอายุแล้ว หรืออายุยาวเกินที่เราออกให้ (ไม่ควรเกิดถ้า secret ไม่รั่ว) = ปฏิเสธ
  if (exp <= nowSec || exp > nowSec + PENDING_TTL_SEC) return null;
  const accountId = toDotaAccountId(m[2]);
  return accountId ? { steam64: m[2], accountId, exp } : null;
}

/** อ่านค่า cookie ตามชื่อจาก header Cookie · ไม่มี = null */
export function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [n, ...rest] = part.trim().split("=");
    if (n === name) return rest.join("=");
  }
  return null;
}

export type ChooseError = "expired" | "unavailable" | "taken" | "other_steam" | "suspended" | "failed";

export const CHOOSE_MESSAGES: Record<ChooseError, string> = {
  expired: "หมดเวลาแล้ว กรุณากดเข้าสู่ระบบด้วย Steam ใหม่อีกครั้ง",
  unavailable: "ล็อกอินด้วย Steam ยังไม่เปิดใช้งาน ใช้อีเมลหรือ Google แทนได้",
  taken: "บัญชี Steam นี้ผูกกับบัญชีอื่นแล้ว กรุณากดเข้าสู่ระบบด้วย Steam ใหม่อีกครั้ง",
  other_steam: "บัญชีนี้ผูก Steam อื่นไว้แล้ว ถ้าต้องการเปลี่ยน ให้เข้าไปเปลี่ยนเองที่หน้าบัญชีของฉัน",
  suspended: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถผูกบัญชีได้",
  failed: "ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

/** Q3: ข้อความเดียวกันทุกกรณีหลังกดส่งรหัส — ห้ามบอกว่าอีเมลนี้มีบัญชีหรือไม่ */
export const OTP_SENT_MESSAGE = "ถ้ามีบัญชีนี้ รหัสจะถูกส่งไปที่อีเมล";
export const OTP_WAIT_MESSAGE = "เพิ่งส่งรหัสไป กรุณารอ 60 วินาทีก่อนกดส่งอีกครั้ง";
export const OTP_BAD_EMAIL_MESSAGE = "กรอกอีเมลให้ถูกต้อง";
export const OTP_BAD_CODE_MESSAGE = "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่";

export type ChooseResult = { ok: true; userId: string } | { ok: false; error: ChooseError };
const fail = (error: ChooseError): ChooseResult => ({ ok: false, error });
const alreadyLinked = (e: { message?: string }) => (e.message ?? "").includes("STEAM_ALREADY_LINKED");

/**
 * ทาง ก. "ฉันเป็นผู้เล่นใหม่" — โค้ดสร้างบัญชีเดิมของ K-AV-STEAMLOGIN ย้ายมาเรียกจากที่นี่
 * Steam ID ถูกผูกไปแล้ว (ก่อนหรือระหว่างทำ) = ปฏิเสธ ไม่เข้าบัญชีนั้นให้ · ผูกไม่สำเร็จ = ลบเฉพาะบัญชีที่เพิ่งสร้าง
 */
/** K-AV-STEAMLOGIN.4: ตั้งชื่อเล่น/รูปตั้งต้นจาก Steam หลังสร้างบัญชีทาง ก. · เลือกใส่ · ล้มได้โดยไม่กระทบการสร้างบัญชี */
export type PersonaDeps = {
  fetchPersona: (steam64: string) => Promise<SteamPersona | null>;
  setProfile: (userId: string, p: SteamPersona) => Promise<void>;
};

export async function createFromPending(a: { pending: Pending | null; deps: SteamLoginDeps | null; persona?: PersonaDeps | null }): Promise<ChooseResult> {
  if (!a.pending) return fail("expired");
  const d = a.deps;
  if (!d) return fail("unavailable");

  const existing = await d.findVerifiedUserId(a.pending.accountId);
  if (existing === undefined) return fail("failed");
  if (existing) return fail("taken");

  const created = await d.createUser(steamLoginEmail());
  if (!created) return fail("failed");
  const { error } = await d.linkSteam(created, a.pending.accountId);
  if (error) {
    await d.deleteUser(created);
    return fail(alreadyLinked(error) ? "taken" : "failed");
  }
  // K-AV-STEAMLOGIN.4: ชื่อเล่น/รูปตั้งต้นจาก Steam · ไม่มี persona · ดึงไม่ได้ · เขียนไม่ได้ · throw = ข้ามเงียบ ๆ (ห้าม log)
  if (a.persona) {
    try {
      const p = await a.persona.fetchPersona(a.pending.steam64);
      if (p) await a.persona.setProfile(created, p);
    } catch {
      // ตั้งใจข้าม: บัญชีต้องสร้างและล็อกอินต่อได้เหมือนเดิม
    }
  }
  if (await d.isSuspended(created)) return fail("suspended");
  return (await d.signIn(created)) ? { ok: true, userId: created } : fail("failed");
}

export type LinkPendingDeps = Pick<SteamLoginDeps, "findVerifiedUserId" | "linkSteam" | "isSuspended"> & {
  /** Steam ที่บัญชีนี้ผูกและยืนยันไว้แล้ว (DOTA2 + VERIFIED + STEAM_OPENID) → external_id · ไม่มี = null · อ่านไม่ได้ = undefined */
  findUserVerifiedSteam: (userId: string) => Promise<string | null | undefined>;
};

/**
 * ทาง ข. หลังยืนยันรหัสอีเมลผ่านแล้ว — ผูก Steam ID จาก cookie เข้าบัญชีเดิม (userId ต้องมาจาก session ที่ verifyOtp เพิ่งตั้งเท่านั้น)
 * ลำดับตรวจก่อนเขียน: ระงับ → Q4 บัญชีนี้ผูก Steam อื่นแล้ว → Steam ID นี้เป็นของบัญชีอื่นแล้ว · ไม่ผ่านข้อใด = ไม่เรียก linkSteam
 * link_steam_verified เป็น RPC ตัวเดียวกับที่ /link/steam/return ใช้ (ON CONFLICT จะเขียนทับ จึงต้องตรวจ Q4 ก่อนเรียก)
 */
export async function linkPendingToUser(a: { pending: Pending | null; userId: string; deps: LinkPendingDeps | null }): Promise<ChooseResult> {
  if (!a.pending) return fail("expired");
  const d = a.deps;
  if (!d) return fail("unavailable");
  if (await d.isSuspended(a.userId)) return fail("suspended");

  const mine = await d.findUserVerifiedSteam(a.userId);
  if (mine === undefined) return fail("failed");
  if (mine !== null && mine !== a.pending.accountId) return fail("other_steam");

  const owner = await d.findVerifiedUserId(a.pending.accountId);
  if (owner === undefined) return fail("failed");
  if (owner && owner !== a.userId) return fail("taken");
  if (owner === a.userId) return { ok: true, userId: a.userId }; // ผูกอยู่แล้วกับบัญชีนี้เอง ไม่ต้องเขียนซ้ำ

  const { error } = await d.linkSteam(a.userId, a.pending.accountId);
  if (error) return fail(alreadyLinked(error) ? "taken" : "failed");
  return { ok: true, userId: a.userId };
}
