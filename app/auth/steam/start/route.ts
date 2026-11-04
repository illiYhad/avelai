import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { safeNext } from "@/lib/auth/validate";
import {
  buildStartUrl, loginStateCookieValue, resolveSiteUrl,
  LOGIN_RETURN_PATH, LOGIN_STATE_COOKIE, LOGIN_STATE_COOKIE_PATH,
} from "@/lib/game-accounts/steam";

// K-AV-STEAMLOGIN: เริ่มล็อกอินด้วย Steam (OpenID 2.0) · ไม่ต้องล็อกอิน
// มี session อยู่แล้ว → ไปทางผูกบัญชี (/link/steam/start) ไม่สลับ/ไม่สร้างบัญชี
// state สุ่มอยู่ใน cookie HttpOnly (พร้อม next ที่ผ่าน safeNext) และใน return_to ที่ Steam เซ็น → กัน CSRF แบบเดียวกับการผูก
export async function GET(request: Request) {
  const siteUrl = resolveSiteUrl(process.env, request.url);
  if (!siteUrl) return NextResponse.redirect(new URL("/login?steam_error=unavailable", request.url));
  const next = safeNext(new URL(request.url).searchParams.get("next"));

  const db = await getServerDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (user) return NextResponse.redirect(new URL("/link/steam/start", siteUrl));

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildStartUrl(siteUrl, state, LOGIN_RETURN_PATH));
  res.cookies.set(LOGIN_STATE_COOKIE, loginStateCookieValue(state, next), {
    httpOnly: true,
    sameSite: "lax", // ต้อง lax: Steam พากลับมาเป็น GET ข้ามเว็บ
    secure: siteUrl.startsWith("https://"),
    path: LOGIN_STATE_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
