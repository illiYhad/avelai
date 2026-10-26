// K-AV-7: ELO (pure) — เริ่ม 1000 · E = 1/(1+10^((Rb−Ra)/400)) · K = 40 (<20 เกม) → 32 (<60) → 24
// โหมดทีม (มติพี่ศิลา Q4): rating ทีม = ค่าเฉลี่ย · ใช้ K_team เดียวทั้งแมตช์ → ΔA = −ΔB เสมอ · ทุกคนในทีมได้ delta เท่ากัน
// K_team เลือกจาก "ค่าเฉลี่ย games_played ของผู้เล่นทั้งสองทีมรวมกัน" (ไม่ใช่ 32 คงที่) — เหตุผล: ทีมหน้าใหม่ควรขยับเร็ว ทีมเก๋าควรนิ่ง · ยังเป็นค่าเดียวต่อแมตช์จึงสมมาตร
// ไม่คิด: WALKOVER · BYE · CANCELLED (ไม่มีการแข่งจริง) · คิดปกติ: NORMAL · FORFEIT · ADMIN_DECISION
// ห้ามสุ่ม/ห้ามอ่านเวลาในไฟล์นี้

export const ELO_START = 1000;
export const ELO_K = { NEW: 40, MID: 32, VET: 24 } as const;
export const ELO_SKIP_OUTCOMES = ["WALKOVER", "BYE", "CANCELLED"] as const;

export type EloPlayer = { userId: string; rating: number; gamesPlayed: number };
export type EloResult = {
  k: number;
  expectedA: number;
  deltaA: number;
  deltaB: number; // = −deltaA เสมอ
  players: { userId: string; before: number; after: number; k: number; won: boolean }[];
};

/** K ตามประสบการณ์ (จำนวนเกมที่นับแล้ว) */
export function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < 20) return ELO_K.NEW;
  if (gamesPlayed < 60) return ELO_K.MID;
  return ELO_K.VET;
}

/** โอกาสชนะของ A ต่อ B */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function countsForElo(outcome: string | null | undefined, status: string): boolean {
  if (status !== "COMPLETED") return false;
  return !(ELO_SKIP_OUTCOMES as readonly string[]).includes(outcome ?? "");
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * คำนวณผลแมตช์ทีม A vs ทีม B · winner = "A" | "B"
 * delta ปัดเป็นจำนวนเต็มครั้งเดียวจากฝั่ง A แล้วให้ B = −deltaA → ผลรวมเป็นศูนย์เสมอ (ไม่ปัดสองครั้ง)
 * rating ไม่ต่ำกว่า 0 (clamp ฝั่งผู้เล่นรายคน — หากชน 0 ผลรวมอาจไม่เป็นศูนย์ ซึ่งเกิดได้เฉพาะ rating ใกล้ 0 มาก ๆ)
 */
export function computeTeamElo(teamA: EloPlayer[], teamB: EloPlayer[], winner: "A" | "B"): EloResult {
  if (teamA.length === 0 || teamB.length === 0) throw new Error("ELO: ทีมว่าง");
  const rA = avg(teamA.map((p) => p.rating)), rB = avg(teamB.map((p) => p.rating));
  const k = kFactor(Math.floor(avg([...teamA, ...teamB].map((p) => p.gamesPlayed))));
  const eA = expectedScore(rA, rB);
  const sA = winner === "A" ? 1 : 0;
  const deltaA = Math.round(k * (sA - eA));
  const deltaB = -deltaA;
  const apply = (ps: EloPlayer[], d: number, won: boolean) => ps.map((p) => ({ userId: p.userId, before: p.rating, after: Math.max(0, p.rating + d), k, won }));
  return { k, expectedA: eA, deltaA, deltaB, players: [...apply(teamA, deltaA, winner === "A"), ...apply(teamB, deltaB, winner === "B")] };
}

/** Win rate คำนวณสด (ไม่เก็บในตาราง) · 0–100 ทศนิยม 1 ตำแหน่ง */
export function winRate(wins: number, matches: number): number {
  if (matches <= 0) return 0;
  return Math.round((wins / matches) * 1000) / 10;
}
