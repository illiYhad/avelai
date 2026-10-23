// K-AV-H2: ห้ามส่งข้อความ error ดิบจาก DB ไปถึงผู้ใช้ (รั่วชื่อตาราง/policy/โครงสร้าง)
// error จริงลง console.error ฝั่ง server เท่านั้น · ผู้ใช้เห็นข้อความไทยธรรมดา

export const GENERIC_FAIL_MESSAGE = "ทำรายการไม่สำเร็จ กรุณาลองใหม่";

export function failWith(code: string, err: unknown, userMessage: string = GENERIC_FAIL_MESSAGE) {
  console.error(`[${code}]`, err);
  return { error: { code, message: userMessage } } as const;
}
