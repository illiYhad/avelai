import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { buildStartUrl, resolveSiteUrl, stateCookieValue, STATE_COOKIE, STATE_COOKIE_PATH } from "@/lib/game-accounts/steam";

// K-AV-LINK: เริ่มผูก Steam (OpenID 2.0) · ต้องล็อกอิน (middleware เด้ง /login ให้ + เช็กซ้ำที่นี่)
// state สุ่มอยู่ใน cookie HttpOnly (ผูกกับ user id) และใน return_to ที่ Steam เซ็น → กันคนอื่นส่งลิงก์ return ของตัวเองให้เหยื่อกด (CSRF)
export async function GET(request: Request) {
  const siteUrl = resolveSiteUrl(process.env, request.url);
  if (!siteUrl) return NextResponse.redirect(new URL("/me?link_error=unavailable", request.url));
  const db = await getServerDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/link/steam/start")}`, siteUrl));

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildStartUrl(siteUrl, state));
  res.cookies.set(STATE_COOKIE, stateCookieValue(state, user.id), {
    httpOnly: true,
    sameSite: "lax", // ต้อง lax: Steam พากลับมาเป็น GET ข้ามเว็บ
    secure: siteUrl.startsWith("https://"),
    path: STATE_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
