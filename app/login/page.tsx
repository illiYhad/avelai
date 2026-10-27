import { readClientConfig } from "@/lib/db/config";
import { safeNext } from "@/lib/auth/validate";
import LoginForm from "./LoginForm";

export const metadata = { title: "เข้าสู่ระบบ — AVELAi" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);
  const configured = readClientConfig() !== null;

  // K-AV-UX2A: หน้าตาตามหน้า login ชุดเดิม (การ์ดกลาง · เส้นทองบน · สโลแกน · บรรทัดสถานะ) — ลอจิกเดิมทั้งหมด
  return (
    <main className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-10 md:min-h-[calc(100dvh-4rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-gold)_8%,transparent)_0%,transparent_70%)]"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gold/25 bg-surface-2 p-6 sm:p-10">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-bold tracking-[0.15em] text-ink">
            AVEL<span className="text-gold">Ai</span>
          </h1>
          <p className="mt-2 font-mono text-sm tracking-[0.2em] text-cyan/70">— PRECISION IS FREEDOM —</p>
        </div>
        <div className="mb-6 flex items-center justify-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
          <span className="font-mono text-sm tracking-[0.15em] text-cyan/70">AVE ONLINE // ARENA READY</span>
        </div>
        <div aria-hidden className="mb-6 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        <h2 className="mb-4 text-center text-lg font-semibold text-ink">เข้าสู่ระบบ</h2>
        {configured ? (
          <LoginForm next={target} />
        ) : (
          <p className="text-center text-sm text-white/60">ระบบล็อกอินยังไม่เปิด</p>
        )}
      </div>
    </main>
  );
}
