// K-AV-INTEG.1b: กติกากรอก Dota Match ID ในห้องแมตช์ทัวร์ (ฟังก์ชันล้วน · ทดสอบได้ไม่ต้องมีฐาน)
// ใครกรอกได้: หัวหน้าทีม 2 ฝั่งในแมตช์ (กรอกครั้งแรกเท่านั้น) · สตาฟทัวร์/ADMIN (กรอก + เขียนทับ)
// ค่า 6–12 หลัก · 1 ค่าต่อ game_number · id เดียวกันใช้ซ้ำในเกมอื่น/แมตช์อื่นไม่ได้ (กันเอาแมตช์คนอื่นมาลงโทษ)

export const DOTA_MATCH_ID = /^\d{6,12}$/;

export type DotaIdError = "NOT_DOTA" | "FORBIDDEN" | "BAD_FORMAT" | "BAD_GAME" | "ALREADY_SET" | "DUPLICATE";

export type DotaIdInput = {
  game: string; // tournaments.game
  isStaff: boolean; // tournamentStaffLevel !== "NONE" (ผู้จัด · สตาฟ/REFEREE · ADMIN)
  isLeader: boolean; // หัวหน้าทีมฝั่ง A หรือ B ของแมตช์นี้
  bestOf: number;
  gameNumber: number;
  dotaMatchId: string;
  existing: string | null; // external_match_id ของห้อง game_number นี้ (ถ้ามี)
  usedElsewhere: boolean; // id นี้อยู่ในห้องอื่น (เกมอื่นของแมตช์นี้ หรือแมตช์อื่น)
};

export type DotaIdDecision = { ok: true; overwrite: boolean; noop: boolean } | { ok: false; error: DotaIdError };

export function decideDotaMatchId(i: DotaIdInput): DotaIdDecision {
  if (i.game !== "DOTA2") return { ok: false, error: "NOT_DOTA" };
  if (!i.isStaff && !i.isLeader) return { ok: false, error: "FORBIDDEN" };
  const id = i.dotaMatchId.trim();
  if (!DOTA_MATCH_ID.test(id)) return { ok: false, error: "BAD_FORMAT" };
  if (!Number.isInteger(i.gameNumber) || i.gameNumber < 1 || i.gameNumber > Math.min(7, Math.max(1, i.bestOf))) return { ok: false, error: "BAD_GAME" };
  if (i.existing === id) return { ok: true, overwrite: false, noop: true };
  if (i.usedElsewhere) return { ok: false, error: "DUPLICATE" };
  if (i.existing && !i.isStaff) return { ok: false, error: "ALREADY_SET" };
  return { ok: true, overwrite: !!i.existing, noop: false };
}
