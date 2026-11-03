/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser, activeRoles, isSuspended } from "@/lib/auth/roles";
import { signOutAction } from "@/app/auth/actions";
import ProfileForm from "./ProfileForm";
import GameAccountsCard, { type DotaAccount, type MlbbAccount } from "./GameAccountsCard";
import { routes } from "@/lib/routes";

export const metadata = { title: "โปรไฟล์ — AVELAi" };
// หน้า session ต้องไม่ถูก prerender เป็น static (ตอน build ไม่มี env จะหลุดเป็น static ได้)
export const dynamic = "force-dynamic";

function thaiTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ linked?: string; link_error?: string }> }) {
  const { db, user } = await requireUser("/me");
  const sp = await searchParams;

  const [{ data: profile }, { data: roleRows }, dotaRes] = await Promise.all([
    db
      .from("users")
      .select("username, avatar_url, suspended_until")
      .eq("id", user.id)
      .single(),
    db.from("user_roles").select("role, revoked_at, expires_at").eq("user_id", user.id),
    // K-AV-D1/K-AV-LINK: game_accounts (SQL 130 · คอลัมน์ zone_id/verified_via มาจาก 213) · 213 ยังไม่รัน → อ่านแบบเดิมต่อ ไม่ล้ม
    db.from("game_accounts").select("game, external_id, status, zone_id, verified_via").eq("user_id", user.id),
  ]);
  type AccRow = { game: string; external_id: string; status: string; zone_id?: string | null; verified_via?: string | null };
  let accRows = dotaRes.data as AccRow[] | null;
  let accError = Boolean(dotaRes.error);
  if (dotaRes.error) {
    const legacy = await db.from("game_accounts").select("game, external_id, status").eq("user_id", user.id);
    accRows = legacy.data as AccRow[] | null;
    accError = Boolean(legacy.error);
  }
  const dotaRow = accRows?.find((r) => r.game === "DOTA2") ?? null;
  const mlbbRow = accRows?.find((r) => r.game === "MLBB") ?? null;
  const dotaAccount: DotaAccount = dotaRow
    ? { external_id: dotaRow.external_id, verified: dotaRow.status === "VERIFIED", viaSteam: dotaRow.verified_via === "STEAM_OPENID" }
    : null;
  const mlbbAccount: MlbbAccount = mlbbRow ? { external_id: mlbbRow.external_id, zone_id: mlbbRow.zone_id ?? null } : null;

  const roles = activeRoles(roleRows ?? []);
  const suspended = profile ? isSuspended(profile) : false;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-gold">โปรไฟล์</h1>
        <form action={signOutAction}>
          <button className="rounded border border-white/30 px-3 py-1.5 text-sm text-white/80">
            ออกจากระบบ
          </button>
        </form>
      </div>

      {suspended && profile?.suspended_until ? (
        <p className="rounded border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          บัญชีถูกระงับถึง {thaiTime(profile.suspended_until)}
        </p>
      ) : null}

      {/* K-AV-LINK.1: การ์ดบัญชีเกมเป็นการ์ดแรก · Dota 2 ผูกผ่าน Steam อย่างเดียว (ฟอร์มกรอกเลข Dota เอาออกแล้ว) */}
      <GameAccountsCard
        dota={dotaAccount}
        mlbb={mlbbAccount}
        linked={sp.linked ?? null}
        linkError={sp.link_error ?? null}
        unavailable={accError}
      />

      <section className="flex items-center gap-4">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border border-white/20 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 text-white/40">
            —
          </div>
        )}
        <div>
          <p className="font-numeric text-lg text-white">{profile?.username ?? "—"}</p>
          <p className="text-sm text-white/60">
            role: {roles.length > 0 ? roles.join(" · ") : "ยังไม่มี"}
          </p>
          {profile?.username ? <p className="text-xs">Passport ของฉัน (ELO · Karma · สถิติ): <Link href={routes.passport("mlbb", profile.username)} className="text-cyan underline">MLBB</Link> · <Link href={routes.passport("dota2", profile.username)} className="text-cyan underline">Dota 2</Link></p> : null}
        </div>
      </section>

      <ProfileForm
        username={profile?.username ?? ""}
        avatarUrl={profile?.avatar_url ?? ""}
      />
    </main>
  );
}
