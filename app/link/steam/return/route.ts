import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { isUserSuspended } from "@/lib/auth/suspension";
import { processSteamReturn, resolveSiteUrl } from "@/lib/game-accounts/steam";

// K-AV-LINK: Steam ส่งกลับมาที่นี่ · ตรวจกับ Steam ฝั่ง server → link_steam_verified (service role · เฉพาะหลังตรวจผ่าน)
// user id มาจาก session เท่านั้น — ไม่รับจาก query
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
  });
  return NextResponse.redirect(new URL(path, siteUrl));
}
