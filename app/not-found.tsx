import Link from "next/link";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

// K-AV-COMPLETE.1: หน้า 404 (ไทย/อังกฤษตามเส้นทาง) · โทนเดียวกับหน้า /dota2/pass
export default async function NotFound() {
  const locale = await getLocale();
  const t = dict(locale).errors;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="font-display text-5xl tracking-[0.15em] text-gold">404</p>
      <h1 className="font-display text-2xl tracking-[0.15em] text-white">{t.notFound}</h1>
      <Link href={locale === "en" ? "/en" : "/"} className="rounded-lg bg-gold px-6 py-2 text-sm font-bold text-black hover:bg-[#E8C05A] transition-colors">
        {t.backHome}
      </Link>
    </main>
  );
}
