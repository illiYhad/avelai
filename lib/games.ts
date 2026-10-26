// K-AV-D1: เกมที่รองรับ (allowlist เดียว) — ค่าที่เก็บใน teams.game = รหัสในนี้เท่านั้น
// pure: ใช้ได้ทั้ง server action · หน้าเว็บ · เทสต์

export const GAMES = {
  MLBB: { label: "Mobile Legends", teamSize: 5 },
  DOTA2: { label: "Dota 2", teamSize: 5 },
} as const;

export type GameCode = keyof typeof GAMES;

/** เกมเริ่มต้น (ทีมเดิมทั้งหมดเป็น MLBB) */
export const DEFAULT_GAME: GameCode = "MLBB";

export function isGameCode(v: unknown): v is GameCode {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(GAMES, v);
}

/** ชื่อเกมสำหรับแสดง · ค่าที่ไม่รู้จัก = แสดงตามที่เก็บ (ไม่เดา) */
export function gameLabel(code: string | null | undefined): string {
  if (!code) return GAMES[DEFAULT_GAME].label;
  return isGameCode(code) ? GAMES[code].label : code;
}

/** เกมของทีมจากค่าใน DB · ว่าง/ไม่รู้จัก = MLBB (ค่าเริ่มต้นของคอลัมน์ teams.game) */
export function teamGame(code: string | null | undefined): GameCode {
  return isGameCode(code) ? code : DEFAULT_GAME;
}
