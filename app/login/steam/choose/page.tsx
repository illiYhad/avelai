import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { CHOOSE_MESSAGES, pendingSecret, readPending, PENDING_COOKIE } from "@/lib/game-accounts/steam-pending";
import ChooseForm from "./ChooseForm";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

// K-AV-STEAMLOGIN.2: หน้าเลือกหลังล็อกอิน Steam ครั้งแรก (Steam ตรวจผ่านแล้ว แต่ยังไม่มีบัญชีที่ผูก Steam นี้)
// cookie pending ไม่มี · หมดอายุ · ลายเซ็นผิด · ไม่มี secret = ไม่แสดงปุ่ม บอกให้กดล็อกอิน Steam ใหม่ (ไม่เดา)
export async function generateMetadata() {
  return { title: `${dict(await getLocale()).login.chooseTitle} — AVELAi`, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function SteamChoosePage() {
  const db = await getServerDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  // มี session อยู่แล้ว = ใช้ทางผูกบัญชีปกติ (เหมือน /auth/steam/start) ไม่ให้เลือกสร้างบัญชีซ้อน
  if (user) redirect("/link/steam/start");

  const jar = await cookies();
  const secret = pendingSecret(process.env);
  const pending = readPending(jar.get(PENDING_COOKIE)?.value, secret);
  const locale = await getLocale();
  const t = dict(locale).login; // K-AV-R2.7

  return (
    <main className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-10 md:min-h-[calc(100dvh-4rem)]">
      <div className="hud-panel hud-panel-gold ci-corners relative z-10 w-full max-w-md rounded-xl p-6 sm:p-10">
        <h1 className="mb-2 text-center text-lg font-semibold text-ink">{pending ? t.chooseVerified : t.chooseSignIn}</h1>
        {pending ? (
          <>
            <p className="mb-6 text-center text-sm text-ink-muted">
              {t.chooseIntro}
            </p>
            <ChooseForm locale={locale} />
          </>
        ) : (
          <>
            <p role="alert" className="mb-4 rounded border border-gold/40 px-4 py-3 text-sm text-white/80">
              {secret ? CHOOSE_MESSAGES.expired : CHOOSE_MESSAGES.unavailable}
            </p>
            <a href={secret ? "/auth/steam/start" : "/login"} className="btn-ghost flex min-h-12 w-full items-center justify-center rounded-md px-4 py-2 text-base">
              {secret ? t.chooseRestart : t.chooseBackToLogin}
            </a>
          </>
        )}
      </div>
    </main>
  );
}
