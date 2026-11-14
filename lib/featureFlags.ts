// Feature flags (K-AV-R เฟส 0): ปิดเส้นทางที่ยังไม่เปิดใช้ — เก็บโค้ดเดิมไว้ทั้งหมด ไม่ลบ
// payments: ระบบจ่ายเงิน (wallet/cashout · rewards/redeem · หน้า subscribe) — ไม่ทำในใบ K-AV-R
// dotaApi : Dota 2 API (app/api/dota/*) — รอโดเมน avelai.ai · เกมแรกคือ MLBB กรอกมือ
// legacyApi: API เก่าสาย Zodiac (bracket · swiss · circuit · mercenary · draft · integrity · matches) — ไม่มีหน้า Phase 1 เรียก
//            และไม่มีการเช็กสิทธิ์ (K-AV-H2) → ปิดไว้จนกว่าจะเขียนใหม่ให้มี auth
export const FEATURES = {
  payments: false,
  dotaApi: false,
  legacyApi: false,
  // K-AV-R3B.1 / R3C.1: ตู้กาชา + กรอบโปรไฟล์ — ปิดจนกว่าหน้าเว็บ + ซองพี่ศิลา (220/221) ผ่าน
  gacha: false,
  frames: false,
} as const;

/** ข้อความตอบกลับมาตรฐานเมื่อฟีเจอร์ถูกปิด */
export const FEATURE_DISABLED_MESSAGE =
  "ฟีเจอร์นี้ยังไม่เปิดใช้งาน (feature disabled)";
