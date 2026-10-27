import type { Metadata } from "next";
import Link from "next/link";

// K-AV-POLISH: หน้า 404 ภาษาไทย · คง noindex · ไม่แสดงข้อมูลทีม/ผู้เล่น
export const metadata: Metadata = {
  title: "ไม่พบหน้านี้",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-sm tracking-[0.2em] text-ink-muted">ERROR 404</p>
      <h1 className="font-display text-3xl font-bold text-ink">ไม่พบหน้านี้</h1>
      <p className="text-base text-ink-muted">หน้าที่คุณต้องการอาจถูกย้ายหรือไม่มีอยู่แล้ว</p>
      <Link
        href="/mlbb/tournaments"
        className="rounded-lg border border-cyan px-5 py-3 text-base font-bold text-cyan hover:bg-cyan/10"
      >
        กลับไปทัวร์นาเมนต์
      </Link>
    </main>
  );
}
