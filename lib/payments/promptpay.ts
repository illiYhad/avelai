// K-AV-3: payload PromptPay ตามมาตรฐาน EMVCo (Thai QR Payment) — pure · ไม่ยิงเครือข่าย
// รองรับ ID: เบอร์มือถือ 10 หลัก (0xxxxxxxxx) · เลขบัตรประชาชน/เลขประจำตัวผู้เสียภาษี 13 หลัก · e-Wallet 15 หลัก
// ใช้กับ PromptPay ID ของ "ผู้จัด" หรือของแพลตฟอร์มเท่านั้น — ไม่เก็บเลขบัญชี/เลขบัตรของผู้เล่น

export type PromptPayId = { type: "MSISDN" | "NATID" | "EWALLET"; value: string };

/** ตรวจ/จัดรูป PromptPay ID · ไม่ถูกต้อง = null */
export function parsePromptPayId(input: unknown): PromptPayId | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/[\s-]/g, "");
  if (/^\+?66\d{9}$/.test(digits)) return { type: "MSISDN", value: `0066${digits.replace(/^\+?66/, "")}` };
  if (/^0\d{9}$/.test(digits)) return { type: "MSISDN", value: `0066${digits.slice(1)}` };
  if (/^\d{13}$/.test(digits)) return { type: "NATID", value: digits };
  if (/^\d{15}$/.test(digits)) return { type: "EWALLET", value: digits };
  return null;
}

/** CRC-16/CCITT-FALSE (poly 0x1021 · init 0xFFFF) — "123456789" → 0x29B1 */
export function crc16ccitt(text: string): number {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(text);
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

/** payload สำหรับสร้าง QR · amount เป็นบาท (> 0 · ทศนิยม 2 ตำแหน่ง) · ID/จำนวนไม่ถูกต้อง = null */
export function buildPromptPayPayload(id: unknown, amountThb: number): string | null {
  const pp = parsePromptPayId(id);
  if (!pp || !Number.isFinite(amountThb) || amountThb <= 0 || amountThb > 9_999_999) return null;
  const subTag = pp.type === "MSISDN" ? "01" : pp.type === "NATID" ? "02" : "03";
  const merchant = tlv("00", "A000000677010111") + tlv(subTag, pp.value);
  const body =
    tlv("00", "01") + // payload format
    tlv("01", "12") + // dynamic (มีจำนวนเงิน)
    tlv("29", merchant) +
    tlv("53", "764") + // THB
    tlv("54", amountThb.toFixed(2)) +
    tlv("58", "TH") +
    "6304";
  return body + crc16ccitt(body).toString(16).toUpperCase().padStart(4, "0");
}

/** ตรวจว่า payload ลงท้ายด้วย CRC ที่ถูกต้อง */
export function verifyPromptPayPayload(payload: string): boolean {
  if (payload.length < 8 || !payload.slice(-8).startsWith("6304")) return false;
  const body = payload.slice(0, -4);
  return crc16ccitt(body).toString(16).toUpperCase().padStart(4, "0") === payload.slice(-4);
}
