// K-AV-LINK: ตรวจ MLBB ID + Server ID (กรอกเอง · Moonton ไม่มีระบบยืนยันจากภายนอก) — pure

export type MlbbParse = { ok: true; id: string; zone: string } | { ok: false; message: string };

export function parseMlbb(idRaw: unknown, zoneRaw: unknown): MlbbParse {
  const id = typeof idRaw === "string" ? idRaw.trim() : "";
  const zone = typeof zoneRaw === "string" ? zoneRaw.trim() : "";
  if (!/^[0-9]{5,12}$/.test(id)) return { ok: false, message: "MLBB ID ต้องเป็นตัวเลข 5–12 หลัก" };
  if (!/^[0-9]{3,6}$/.test(zone)) return { ok: false, message: "Server ID ต้องเป็นตัวเลข 3–6 หลัก" };
  return { ok: true, id, zone };
}
