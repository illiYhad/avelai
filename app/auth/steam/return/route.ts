import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { safeNext } from "@/lib/auth/validate";
import {
  processSteamLogin, readLoginStateCookie, resolveSiteUrl,
  LOGIN_STATE_COOKIE, LOGIN_STATE_COOKIE_PATH,
} from "@/lib/game-accounts/steam";
import { buildSteamLoginDeps } from "@/lib/game-accounts/steam-deps";
import {
  pendingSecret, signPending, CHOOSE_PATH, PENDING_COOKIE, PENDING_COOKIE_PATH, PENDING_TTL_SEC,
} from "@/lib/game-accounts/steam-pending";

// K-AV-STEAMLOGIN: Steam ส่งกลับมาที่นี่ · ตรวจกับ Steam ฝั่ง server → หาบัญชี → ตั้ง session
// K-AV-STEAMLOGIN.2: Steam ID ที่ไม่รู้จัก = ไม่สร้างบัญชีที่นี่ · ตั้ง cookie pending มีลายเซ็น 10 นาที แล้วไปหน้าเลือก
// ⚠ service role ใช้เฉพาะหลัง Steam ตรวจผ่าน และผ่าน deps ของ lib/game-accounts/steam-deps.ts เท่านั้น
// ห้าม log token / hashed_token / อีเมล · cookie state ลบทุกกรณี (ใช้ได้ครั้งเดียว)
export async function GET(request: Request) {
  const siteUrl = resolveSiteUrl(process.env, request.url);
  if (!siteUrl) return NextResponse.redirect(new URL("/login?steam_error=unavailable", request.url));

  const db = await getServerDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const cookie = readLoginStateCookie(request.headers.get("cookie"));
  const next = safeNext(cookie?.next);

  // (1) มี session อยู่แล้ว → ทางผูกบัญชี · ห้ามสลับหรือสร้างบัญชี
  if (user) return clear(NextResponse.redirect(new URL("/link/steam/start", siteUrl)));

  const result = await processSteamLogin({
    params: new URL(request.url).searchParams,
    siteUrl,
    expectedState: cookie?.state ?? null,
    deps: buildSteamLoginDeps(db, getAdminDb()),
  });

  if (result.ok === "pending") {
    // ไม่มี STEAM_PENDING_SECRET = ปิดทาง Steam ครั้งแรกทั้งหมด (fail closed) · ไม่มีค่าสำรอง
    const secret = pendingSecret(process.env);
    if (!secret) return clear(NextResponse.redirect(new URL("/login?steam_error=unavailable", siteUrl)));
    const res = clear(NextResponse.redirect(new URL(CHOOSE_PATH, siteUrl)));
    res.cookies.set(PENDING_COOKIE, signPending(result.steam64, secret), {
      httpOnly: true,
      sameSite: "lax",
      secure: siteUrl.startsWith("https://"),
      path: PENDING_COOKIE_PATH,
      maxAge: PENDING_TTL_SEC,
    });
    return res;
  }

  const path = result.ok ? next : `/login?steam_error=${result.error}`;
  return clear(NextResponse.redirect(new URL(path, siteUrl)));
}

function clear(res: NextResponse): NextResponse {
  res.cookies.set(LOGIN_STATE_COOKIE, "", { path: LOGIN_STATE_COOKIE_PATH, maxAge: 0 });
  return res;
}
