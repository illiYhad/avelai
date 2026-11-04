import { readClientConfig } from "@/lib/db/config";
import { safeNext } from "@/lib/auth/validate";
import { steamLoginMessage } from "@/lib/game-accounts/steam";
import LoginForm from "./LoginForm";
import Logo3D from "@/components/ui/Logo3D";
import HudScan from "@/components/ui/HudScan";

export const metadata = { title: "เข้าสู่ระบบ — AVELAi" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; steam_error?: string }>;
}) {
  const { next, steam_error } = await searchParams;
  const target = safeNext(next);
  const configured = readClientConfig() !== null;
  // K-AV-STEAMLOGIN: ข้อความจากรายการคงที่เท่านั้น · รหัสที่ไม่รู้จัก = ไม่แสดง
  const steamError = steamLoginMessage(steam_error);

  // K-AV-UX2A: หน้าตาตามหน้า login ชุดเดิม (การ์ดกลาง · เส้นทองบน · สโลแกน · บรรทัดสถานะ) — ลอจิกเดิมทั้งหมด
  return (
    <main className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-10 md:min-h-[calc(100dvh-4rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-gold)_8%,transparent)_0%,transparent_70%)]"
      />
      {/* K-AV-UX4: การ์ด HUD ทอง + วงเล็บมุม + แสงสแกน · โลโก้ 3D หมุน (h1 เดิมคงไว้สำหรับโปรแกรมอ่านจอ) */}
      <div className="hud-panel hud-panel-gold ci-corners relative z-10 w-full max-w-md rounded-xl p-6 sm:p-10">
        <HudScan />
        <div className="mb-6 text-center">
          <h1 className="sr-only">AVELAi</h1>
          <Logo3D />
          <p className="mt-3 font-mono text-sm tracking-[0.2em] text-cyan/70">— PRECISION IS FREEDOM —</p>
        </div>
        <div className="mb-6 flex items-center justify-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
          <span className="font-mono text-sm tracking-[0.15em] text-cyan/70">AVE ONLINE // ARENA READY</span>
        </div>
        <div aria-hidden className="mb-6 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        <h2 className="mb-4 text-center text-lg font-semibold text-ink">เข้าสู่ระบบ</h2>
        {steamError ? (
          <p role="alert" className="mb-4 rounded border border-gold/40 px-4 py-3 text-sm text-white/80">
            {steamError}
          </p>
        ) : null}
        {configured ? (
          <LoginForm next={target} />
        ) : (
          <p className="text-center text-sm text-white/60">ระบบล็อกอินยังไม่เปิด</p>
        )}
      </div>
    </main>
  );
}
