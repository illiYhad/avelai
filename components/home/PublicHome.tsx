import Link from "next/link";
import HomeBanner from "@/components/home/HomeBanner";
import PublicMatchLookup from "@/components/home/PublicMatchLookup";
import { defaultLocale, dict, localePath, type Locale } from "@/lib/i18n";

// K-AV-HOME.0: หน้าแรกคนไม่ล็อกอิน (จำกัด) — แบนเนอร์เดิม + ช่อง Match ID + ปุ่มสมัคร/ล็อกอิน
// ไม่มีทัวร์สำหรับคุณ · ทีม · ราวซ้าย/ขวา (คนล็อกอินได้ HomeView เดิมทุกอย่าง) · ชิ้นส่วนและสีจาก Home เดิม ไม่ออกแบบใหม่
export default function PublicHome({ locale = defaultLocale }: { locale?: Locale }) {
  const t = dict(locale).publicHome;
  return (
    <main data-home-main data-public-home lang={locale} className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-6 sm:px-6 md:pb-6">
      <div className="flex min-w-0 flex-col gap-10">
        <HomeBanner locale={locale} />
        <PublicMatchLookup locale={locale} />
        <section data-section="public-cta" className="hud-panel flex flex-col items-start gap-3 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="hud-title text-lg text-ink">{t.ctaTitle}</h2>
            <p className="text-sm text-ink-muted">{t.ctaBody}</p>
          </div>
          <Link href={localePath(locale, "/login")} data-cta="login" className="btn-primary flex min-h-11 shrink-0 items-center rounded-md px-5 font-display tracking-[0.05em]">
            {t.cta}
          </Link>
        </section>
      </div>
    </main>
  );
}
