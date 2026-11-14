"use client";

import { useEffect } from "react";
import Link from "next/link";
import { dict } from "@/lib/i18n";

// K-AV-COMPLETE.1: หน้า 500 · ภาษาเลือกจาก <html lang> · ห้ามแสดงรายละเอียด error/stack ให้ผู้ใช้ (log แค่ digest)
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error] digest", error.digest);
  }, [error]);
  const lang = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "th";
  const t = dict(lang).errors;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="font-display text-5xl tracking-[0.15em] text-gold">500</p>
      <h1 className="font-display text-2xl tracking-[0.15em] text-white">{t.serverError}</h1>
      <div className="flex gap-3">
        <button type="button" onClick={() => reset()} className="rounded-lg bg-gold px-6 py-2 text-sm font-bold text-black hover:bg-[#E8C05A] transition-colors cursor-pointer">
          {t.tryAgain}
        </button>
        <Link href={lang === "en" ? "/en" : "/"} className="rounded-lg border border-gold px-6 py-2 text-sm font-bold text-gold">
          {t.backHome}
        </Link>
      </div>
    </main>
  );
}
