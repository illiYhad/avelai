import { routes } from "@/lib/routes";

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

export const HOME_SLIDES: readonly HomeSlide[] = [
  {
    id: "ultimate-solo",
    // ต้นแบบ :117 ป้าย "PRECISION IS FREEDOM"
    eyebrow: "// PRECISION IS FREEDOM",
    title: "AVELAi : ULTIMATE SOLO",
    // ต้นแบบ :122 (หัวเรื่องรองของ Hero) ตรงตัว
    body: "สุ่มทีมทุกรอบ ถ่วงน้ำหนักคะแนนสมบูรณ์แบบ",
    // ใบ HOME.2 จะเปลี่ยนเป็นหน้าลีก
    cta: { label: "เข้าแข่ง", href: routes.tournaments("dota2") },
    image: { src: "/brand/home/avelai-full-640.png", width: 640, height: 905, alt: "AVELAi" },
  },
  {
    id: "arena-pass",
    eyebrow: null,
    title: "ARENA PASS",
    // ต้นแบบ :457 กล่องกองรางวัล · ตัดถึง "Season/รายเดือน 25%" (ส่วนตั๋วทายผลไม่เกี่ยวกับ Pass)
    // "380 บาท/เดือน" → "380 บาท / 28 วัน (4 สัปดาห์)" ตามซอง ALICH-PACKET-022 ข้อ 4 (เซ็นครบ 3 คน 2026-11-08 06:20)
    body: "Arena Pass 380 บาท / 28 วัน (4 สัปดาห์) → 75% เข้ากองรางวัล (285 บาท/คน) · แบ่ง รายวัน 40% · Weekend 35% · Season/รายเดือน 25%",
    cta: { label: "ซื้อ Pass", href: routes.pass("dota2") },
    // K-AV-HOME.1b: Pass = AVEL (เอเวล · ต้องซื้อ Pass · สีทอง) ไม่ใช่ AVE (ใบรวมอลิส TO_NOVA_20261108-0648 · พี่หยัด 07:38/08:0x)
    image: { src: "/brand/home/avel-half-480.png", width: 480, height: 679, alt: "AVEL (เอเวล)" },
    glow: "gold",
  },
];

/** หมุนเองทุก 6 วินาที */
export const SLIDE_INTERVAL_MS = 6000;
