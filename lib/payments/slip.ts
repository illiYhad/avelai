// K-AV-3: ตรวจไฟล์สลิป (pure) — ชนิดจริงจาก magic bytes · ≤ 5MB · นามสกุลตรงชนิด · ชื่อไฟล์ใน storage สร้างเองเสมอ

export const MAX_SLIP_BYTES = 5 * 1024 * 1024;
export type SlipMime = "image/jpeg" | "image/png" | "image/webp";
const EXT: Record<SlipMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function detectImageMime(bytes: Uint8Array): SlipMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

export type SlipCheck = { ok: true; mime: SlipMime; ext: string } | { ok: false; message: string };

export function validateSlip(fileName: string, size: number, bytes: Uint8Array): SlipCheck {
  if (size <= 0 || bytes.length === 0) return { ok: false, message: "กรุณาเลือกไฟล์สลิป" };
  if (size > MAX_SLIP_BYTES || bytes.length > MAX_SLIP_BYTES) return { ok: false, message: "ไฟล์สลิปใหญ่เกิน 5 MB" };
  const mime = detectImageMime(bytes);
  if (!mime) return { ok: false, message: "รองรับเฉพาะรูป JPEG · PNG · WebP" };
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const okExt = mime === "image/jpeg" ? ["jpg", "jpeg"] : [EXT[mime]];
  if (!okExt.includes(ext)) return { ok: false, message: "นามสกุลไฟล์ไม่ตรงกับชนิดรูป" };
  return { ok: true, mime, ext: EXT[mime] };
}
