import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUserSuspended } from "@/lib/auth/suspension";
import type { SteamLoginDeps } from "@/lib/game-accounts/steam";
import type { LinkPendingDeps, PersonaDeps } from "@/lib/game-accounts/steam-pending";
import { fetchSteamPersona } from "@/lib/game-accounts/steam-persona";

// K-AV-STEAMLOGIN.2: ตัวต่อ DB/Auth ของทางล็อกอิน Steam — ย้ายออกจาก app/auth/steam/return/route.ts ให้หน้าเลือกใช้ชุดเดียวกัน
// ⚠ service role (admin) ใช้เฉพาะหลัง Steam ตรวจผ่านแล้วเท่านั้น: จาก /auth/steam/return โดยตรง หรือจาก cookie pending ที่ลายเซ็นถูกต้อง
// ห้าม log token / hashed_token / อีเมล

const findVerifiedUserId = (admin: SupabaseClient) => async (accountId: string) => {
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
};

const linkSteam = (admin: SupabaseClient) => async (userId: string, accountId: string) => {
  const { error } = await admin.rpc("link_steam_verified", { p_user_id: userId, p_account_id: accountId });
  return { error };
};

/** db = server client ที่ผูก cookie session ของคำขอนี้ · admin = service role · ขาดตัวใดตัวหนึ่ง = null (ปิดฟีเจอร์) */
export function buildSteamLoginDeps(db: SupabaseClient | null, admin: SupabaseClient | null): SteamLoginDeps | null {
  if (!db || !admin) return null;
  return {
    findVerifiedUserId: findVerifiedUserId(admin),
    createUser: async (email) => {
      // อีเมลภายใน · ยืนยันแล้ว · ไม่มีรหัสผ่าน · createUser ไม่ส่งอีเมล
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      return error ? null : data.user?.id ?? null;
    },
    linkSteam: linkSteam(admin),
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
  };
}

/** ชุดของทาง ข. (ผูกเข้าบัญชีเดิมหลังยืนยันรหัสอีเมล) · ไม่มี admin = null */
export function buildLinkPendingDeps(admin: SupabaseClient | null): LinkPendingDeps | null {
  if (!admin) return null;
  return {
    findVerifiedUserId: findVerifiedUserId(admin),
    linkSteam: linkSteam(admin),
    isSuspended: (userId) => isUserSuspended(admin, userId),
    findUserVerifiedSteam: async (userId) => {
      const { data, error } = await admin
        .from("game_accounts")
        .select("external_id")
        .eq("user_id", userId)
        .eq("game", "DOTA2")
        .eq("status", "VERIFIED")
        .eq("verified_via", "STEAM_OPENID")
        .maybeSingle();
      if (error) return undefined;
      return (data as { external_id: string } | null)?.external_id ?? null;
    },
  };
}

/** K-AV-STEAMLOGIN.4: ชุดตั้งชื่อเล่น/รูปตั้งต้นจาก Steam ของบัญชีใหม่ทาง ก. · ไม่มี admin = null · ไม่แตะ username */
export function buildPersonaDeps(admin: SupabaseClient | null): PersonaDeps | null {
  if (!admin) return null;
  return {
    fetchPersona: (steam64) => fetchSteamPersona(steam64),
    setProfile: async (userId, p) => {
      const patch: { display_name: string; avatar_url?: string } = { display_name: p.personaName };
      if (p.avatarUrl !== null) patch.avatar_url = p.avatarUrl;
      await admin.from("users").update(patch).eq("id", userId);
    },
  };
}
