import HomeBanner from "@/components/home/HomeBanner";
import GameCards from "@/components/home/GameCards";
import TournamentsForYou from "@/components/home/TournamentsForYou";
import { LeftRail, RightRail } from "@/components/home/HomeRails";
import type { HomeData } from "@/lib/home/types";
import { defaultLocale, type Locale } from "@/lib/i18n";

// K-AV-HOME.1: หน้า Home ของคนล็อกอิน (โครงจาก challengermode.com/start ภาพ 01/02/04 · หน้าตาโลก AVELAi)
// รับ props ล้วน ไม่อ่าน DB เอง (เทส render ได้)
// เลย์เอาต์: ≥1280 ราวซ้าย 72 · กลาง · ราวขวา 280 | 1024–1279 ซ่อนราวซ้าย | <1024 คอลัมน์เดียว ราวขวาต่อท้าย
// K-AV-I18N.0b: locale (ไม่ส่ง = ไทย) → ข้อความจากพจนานุกรม · ลิงก์ en ขึ้นต้น /en
export default function HomeView({ tournaments, activities, teams, now, locale = defaultLocale }: HomeData & { locale?: Locale }) {
  return (
    <main data-home-main lang={locale} className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 md:pb-6">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-6">
        <LeftRail locale={locale} />
        <div className="flex min-w-0 flex-1 flex-col gap-10">
          <HomeBanner locale={locale} />
          <GameCards locale={locale} />
          <TournamentsForYou items={tournaments} now={now} locale={locale} />
        </div>
        <RightRail activities={activities} teams={teams} now={now} locale={locale} />
      </div>
    </main>
  );
}
