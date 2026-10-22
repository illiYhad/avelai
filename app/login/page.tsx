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

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <h1 className="font-display text-3xl tracking-[0.15em] text-gold">เข้าสู่ระบบ</h1>
      {configured ? (
        <LoginForm next={target} />
      ) : (
        <p className="text-sm text-white/60">ระบบล็อกอินยังไม่เปิด</p>
      )}
    </main>
  );
}
