// K-AV-HUB1: ค่าภาพรวมของหน้า Tournament Hub ที่ยังไม่ต่อข้อมูลจริง — รวมไว้ที่ไฟล์นี้ไฟล์เดียว
// ทุกส่วนที่อ่านค่าจากไฟล์นี้ต้องแสดงชิป "ข้อมูลตัวอย่าง" (SampleChip) · ห้ามใส่ค่าที่ติดตัวผู้ใช้ (Token · Cash · อันดับ · ตั๋ว · CP) ที่นี่
// เมื่อต่อข้อมูลจริงแล้ว ให้ลบค่าออกจากไฟล์นี้และเอาชิปออกจากส่วนนั้น

export const HUB_SAMPLE = {
  seasonName: "Season Finale 2026",
  totalPrizePoolThb: 300_000,
  allocation: [
    { key: "daily", label: "Daily", percent: 15, poolThb: 45_000 },
    { key: "weekly", label: "Weekly", percent: 25, poolThb: 75_000 },
    { key: "monthly", label: "Monthly", percent: 40, poolThb: 120_000 },
    { key: "season", label: "Season", percent: 20, poolThb: 60_000 },
  ],
  tiers: {
    daily: { participants: 1_240, startsIn: null },
    weekly: { participants: 256, startsIn: "5 วัน 12 ชม." },
    monthly: { participants: 64, startsIn: "18 วัน" },
    season: { participants: null, startsIn: null },
  },
  mercenary: { roomCode: "MERC-8841", entryFeeTokens: 1, potThb: 90, filledSeats: 7, maxSeats: 10 },
} as const;

export type HubTierKey = keyof typeof HUB_SAMPLE.tiers;
