import { routes } from "@/lib/routes";
import { defaultLocale, dict, localePath, type Locale } from "@/lib/i18n";

// K-AV-HOME.1: ข้อมูลแบนเนอร์หมุนหน้าแรก (pure · เทสใน tests/k-av-home-1.test.ts)
// ข้อความคัดจาก D:\Balehm_Studio\02_Products\AVELAi\01_Spec\REF_ultimate_solo_อัปเดต_2026-11-07.html
// รูปจาก D:\Balehm_Studio\02_Products\AVELAi\02_Brand\web-home\ (K-AV-HOME.1a · คัดลอกไม่แก้ไฟล์ · สัดส่วนเดิม 992:1403)

export type HomeSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  body: string;
  cta: { label: string; href: string };
  image: { src: string; width: number; height: number; alt: string };
  /** เงาเรืองรอบตัวละคร (สีประจำตัวละคร · AVEL = ทอง --color-gold) */
  glow?: "gold";
};

/** K-AV-I18N.0b: ข้อความจากพจนานุกรม (dict(locale).home.banner) · ลิงก์ en ขึ้นต้น /en · ชื่อเฉพาะ (eyebrow/title) ไม่แปล */
export function homeSlides(locale: Locale = defaultLocale): readonly HomeSlide[] {
  const t = dict(locale).home.banner;
  return [
    {
      id: "ultimate-solo",
      // ต้นแบบ :117 ป้าย "PRECISION IS FREEDOM"
      eyebrow: "// PRECISION IS FREEDOM",
      title: "AVELAi : ULTIMATE SOLO",
      // ต้นแบบ :122 (หัวเรื่องรองของ Hero) ตรงตัว
      body: t.soloBody,
      // K-AV-HOME.2: ปุ่มเข้าแข่ง → หน้าลีก ESTA (เดิม /dota2/tournaments)
      cta: { label: t.soloCta, href: localePath(locale, routes.esta("dota2")) },
      image: { src: "/brand/home/avelai-full-640.png", width: 640, height: 905, alt: "AVELAi" },
    },
    {
      id: "arena-pass",
      eyebrow: null,
      title: "ARENA PASS",
      // ต้นแบบ :457 กล่องกองรางวัล · ตัดถึง "Season/รายเดือน 25%" (ส่วนตั๋วทายผลไม่เกี่ยวกับ Pass)
      // K-AV-HOME.PASS-SLIDE: ตามมติซอง 026 (เดือนปฏิทิน)
      body: t.passBody,
      cta: { label: t.passCta, href: localePath(locale, routes.pass("dota2")) },
      // K-AV-HOME.1b: Pass = AVEL (เอเวล · ต้องซื้อ Pass · สีทอง) ไม่ใช่ AVE (ใบรวมอลิส TO_NOVA_20261108-0648 · พี่หยัด 07:38/08:0x)
      image: { src: "/brand/home/avel-half-480.png", width: 480, height: 679, alt: t.avelAlt },
      glow: "gold",
    },
  ];
}

/** ภาษาไทย (ค่าเดิม · เทส k-av-home-1 ใช้) */
export const HOME_SLIDES: readonly HomeSlide[] = homeSlides("th");

/** หมุนเองทุก 6 วินาที */
export const SLIDE_INTERVAL_MS = 6000;
