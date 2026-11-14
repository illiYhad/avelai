import Link from "next/link";
import { dict, type Locale } from "@/lib/i18n";

// K-AV-R2.4: Footer (โทนเดียวกับ Navbar · border-line · ink-muted) · หน้า /obs ถูกซ่อนด้วย CSS ของ app/obs/layout.tsx อยู่แล้ว
export default function Footer({ locale }: { locale: Locale }) {
  const t = dict(locale).legal;
  const L = (p: string) => (locale === "en" ? `/en${p}` : p);
  return (
    <footer data-site-footer className="mt-12 border-t border-line px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 font-mono text-xs text-ink-muted sm:flex-row">
        <p>© 2026 AVELAi · Balehm Tech Studio</p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href={L("/privacy")} className="hover:text-white">{t.privacy}</Link>
          <Link href={L("/terms")} className="hover:text-white">{t.terms}</Link>
          <Link href={L("/help")} className="hover:text-white">{t.help}</Link>
        </nav>
      </div>
    </footer>
  );
}
