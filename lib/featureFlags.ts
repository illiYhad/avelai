// Feature flags (K-AV-R เฟส 0): ปิดเส้นทางที่ยังไม่เปิดใช้ — เก็บโค้ดเดิมไว้ทั้งหมด ไม่ลบ
// payments: ระบบจ่ายเงิน (wallet/cashout · rewards/redeem · หน้า subscribe) — ไม่ทำในใบ K-AV-R
// dotaApi : Dota 2 API (app/api/dota/*) — รอโดเมน avelai.ai · เกมแรกคือ MLBB กรอกมือ
export const FEATURES = {
  payments: false,
  dotaApi: false,
} as const;

/** ข้อความตอบกลับมาตรฐานเมื่อฟีเจอร์ถูกปิด */
export const FEATURE_DISABLED_MESSAGE =
  "ฟีเจอร์นี้ยังไม่เปิดใช้งาน (feature disabled)";
