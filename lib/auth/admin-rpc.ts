// K-AV-FIX2: แปลรหัส error จาก RPC แอดมินใน 211 (RAISE EXCEPTION '<CODE>') เป็นข้อความไทย · pure (เทสด้วย vitest)

const MESSAGES: Record<string, string> = {
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  REASON_REQUIRED: "กรุณากรอกเหตุผล",
  NOT_FOUND: "ไม่พบข้อมูลเป้าหมาย",
  ROLE_ALREADY_ACTIVE: "ผู้ใช้นี้มีสิทธิ์นี้อยู่แล้ว",
  ROLE_ALREADY_REVOKED: "สิทธิ์นี้ถูกถอนไปแล้ว",
  LAST_SUPER_ADMIN: "ถอน SUPER_ADMIN คนสุดท้ายไม่ได้ ต้องมีอย่างน้อย 1 คนเสมอ",
  BAD_GAME: "เกมไม่ถูกต้อง",
  BAD_DELTA: "ค่าที่ปรับไม่ถูกต้อง",
  BAD_EXPIRY: "วันหมดอายุต้องเป็นเวลาในอนาคต",
};

export function adminRpcMessage(error: { message?: string } | null | undefined, fallback: string): string {
  const code = (error?.message ?? "").trim();
  return MESSAGES[code] ?? fallback;
}

/** ADMIN มอบได้เฉพาะ ORGANIZER/REFEREE · SUPER_ADMIN มอบได้ทุก role (DB ตรวจซ้ำใน admin_grant_role) */
export function grantableRoles(isSuper: boolean): string[] {
  return isSuper ? ["PLAYER", "ORGANIZER", "REFEREE", "ADMIN", "SUPER_ADMIN"] : ["ORGANIZER", "REFEREE"];
}
