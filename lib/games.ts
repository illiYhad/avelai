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

// K-AV-UX2B: slug ในเส้นทาง /[game]/… — ตัวพิมพ์เล็กเท่านั้น (ไม่ lowercase ให้ · ไม่เดา)
export const GAME_SLUGS = { mlbb: "MLBB", dota2: "DOTA2" } as const satisfies Record<string, GameCode>;
export type GameSlug = keyof typeof GAME_SLUGS;
export const DEFAULT_SLUG: GameSlug = "mlbb";

/** 'mlbb' → 'MLBB' · อื่น ๆ (รวม 'MLBB') → null */
export function gameFromSlug(slug: string | undefined): GameCode | null {
  if (!slug || !Object.prototype.hasOwnProperty.call(GAME_SLUGS, slug)) return null;
  return GAME_SLUGS[slug as GameSlug];
}

/** 'MLBB' → 'mlbb' */
export function slugOf(code: GameCode): GameSlug {
  return code === "DOTA2" ? "dota2" : "mlbb";
}
