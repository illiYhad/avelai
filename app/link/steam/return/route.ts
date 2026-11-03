import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { isUserSuspended } from "@/lib/auth/suspension";
import { processSteamReturn, readStateCookie, resolveSiteUrl, STATE_COOKIE, STATE_COOKIE_PATH } from "@/lib/game-accounts/steam";

// K-AV-LINK: Steam ส่งกลับมาที่นี่ · ตรวจกับ Steam ฝั่ง server → link_steam_verified (service role · เฉพาะหลังตรวจผ่าน)
// user id มาจาก session เท่านั้น — ไม่รับจาก query · state ต้องตรงกับ cookie ของผู้ใช้คนนี้ แล้วลบ cookie ทุกกรณี (ใช้ได้ครั้งเดียว)
export async function GET(request: Request) {
  const siteUrl = resolveSiteUrl(process.env, request.url);
  if (!siteUrl) return NextResponse.redirect(new URL("/me?link_error=unavailable", request.url));
  const db = await getServerDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/me")}`, siteUrl));

  const path = await processSteamReturn({
    params: new URL(request.url).searchParams,
    siteUrl,
    userId: user.id,
    suspended: await isUserSuspended(db, user.id),
    admin: getAdminDb(),
    expectedState: readStateCookie(request.headers.get("cookie"), user.id),
  });
  const res = NextResponse.redirect(new URL(path, siteUrl));
  res.cookies.set(STATE_COOKIE, "", { path: STATE_COOKIE_PATH, maxAge: 0 });
  return res;
}
