"use client";
// K-AV-TOUR.1: ทัวร์สอนใช้หน้าทัวร์ครั้งแรก 5 ขั้น (หัวทัวร์ → นาฬิกา → Timeline → กล่องจำนวน → ปุ่มหลัก)
// รูป AVE: main ยังไม่มี public\brand\home\ave-face-320.png → ใช้วงกลมตัวอักษร "AVE" (ไม่มี <img> ไฟล์ที่ไม่มีจริง)
import StepTour, { type TourStep } from "@/components/onboarding/StepTour";

export const TOURNAMENT_TOUR_KEY = "avelai.tour.tournament-detail.v1";

export const TOURNAMENT_TOUR_STEPS: TourStep[] = [
  { target: "hero", title: "หน้าทัวร์นาเมนต์", body: "ชื่อทัวร์ เกม รูปแบบ และสถานะอยู่ตรงนี้ทั้งหมด" },
  { target: "countdown", title: "นาฬิกานับถอยหลัง", body: "บอกเวลาที่เหลือก่อนเริ่มแข่ง เดินทุกวินาที" },
  { target: "timeline", title: "Timeline", body: "เปิดรับสมัคร → ปิดรับสมัคร → เปิดเช็กอิน → เริ่มแข่ง · จุดสีทองคือช่วงที่อยู่ตอนนี้" },
  { target: "teams", title: "จำนวนทีม", body: "ดูว่าสมัครแล้วกี่ทีม ยืนยันแล้วกี่ทีม และยังเหลือช่องเท่าไร" },
  { target: "cta", title: "ปุ่มหลัก", body: "ปุ่มเดียวที่ต้องกด: สมัครทีม เช็กอิน หรือดูสาย ตามช่วงของทัวร์" },
];

function AveBadge() {
  return (
    <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full border border-gold/60 bg-gold/15 font-display text-xs font-bold tracking-[0.08em] text-gold">
      AVE
    </span>
  );
}

export default function FirstVisitTour({ hasCta }: { hasCta: boolean }) {
  const steps = hasCta ? TOURNAMENT_TOUR_STEPS : TOURNAMENT_TOUR_STEPS.filter((s) => s.target !== "cta");
  return <StepTour steps={steps} storageKey={TOURNAMENT_TOUR_KEY} avatar={<AveBadge />} />;
}
