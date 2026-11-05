import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { isUserSuspended } from "@/lib/auth/suspension";
import { safeNext } from "@/lib/auth/validate";
import {
  processSteamLogin, readLoginStateCookie, resolveSiteUrl, type SteamLoginDeps,
  LOGIN_STATE_COOKIE, LOGIN_STATE_COOKIE_PATH,
} from "@/lib/game-accounts/steam";

// K-AV-STEAMLOGIN: Steam ส่งกลับมาที่นี่ · ตรวจกับ Steam ฝั่ง server → หา/สร้างบัญชี → ตั้ง session
// ⚠ service role ใช้เฉพาะหลัง Steam ตรวจผ่าน และผ่าน deps ที่ประกาศไว้ด้านล่างเท่านั้น
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

  const admin = getAdminDb();
  const deps: SteamLoginDeps | null = db && admin ? {
    findVerifiedUserId: async (accountId) => {
      const { data, error } = await admin
        .from("game_accounts")
        .select("user_id")
        .eq("game", "DOTA2")
        .eq("external_id", accountId)
        .eq("status", "VERIFIED")
        .eq("verified_via", "STEAM_OPENID")
        .maybeSingle();
      if (error) return undefined;
      return (data as { user_id: string } | null)?.user_id ?? null;
    },
    createUser: async (email) => {
      // อีเมลภายใน · ยืนยันแล้ว · ไม่มีรหัสผ่าน · createUser ไม่ส่งอีเมล
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      return error ? null : data.user?.id ?? null;
    },
    linkSteam: async (userId, accountId) => {
      const { error } = await admin.rpc("link_steam_verified", { p_user_id: userId, p_account_id: accountId });
      return { error };
    },
    deleteUser: async (userId) => {
      await admin.auth.admin.deleteUser(userId);
    },
    isSuspended: (userId) => isUserSuspended(admin, userId),
    signIn: async (userId) => {
      // getUserById → generateLink(magiclink) ไม่ส่งอีเมล → verifyOtp ด้วย server client (ตั้ง cookie session)
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
      const email = u?.user?.email;
      if (uErr || !email) return false;
      const { data: l, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const tokenHash = l?.properties?.hashed_token;
      if (lErr || !tokenHash) return false;
      const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      return !error;
    },
  } : null;

  const result = await processSteamLogin({
    params: new URL(request.url).searchParams,
    siteUrl,
    expectedState: cookie?.state ?? null,
    deps,
  });
  const path = result.ok ? next : `/login?steam_error=${result.error}`;
  return clear(NextResponse.redirect(new URL(path, siteUrl)));
}

function clear(res: NextResponse): NextResponse {
  res.cookies.set(LOGIN_STATE_COOKIE, "", { path: LOGIN_STATE_COOKIE_PATH, maxAge: 0 });
  return res;
}
