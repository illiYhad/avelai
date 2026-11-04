import type { PlayerHistory } from "./swissPairing";

// K-AV-POLISH.2 A1: แปลงแถว tournament_participants (คอลัมน์ snake_case) → PlayerHistory ที่เอนจิน Swiss ใช้
// ใช้ร่วมกันทั้ง generate-pairing และ finalize-top8 — เดิม finalize-top8 ส่งแถวดิบเข้าเอนจินตรง ๆ
// ทำให้ userId เป็น undefined และ opponentsFaced.reduce พัง (500)

/** คอลัมน์ที่ต้อง select จาก tournament_participants */
export const PARTICIPANT_COLUMNS = "player_id, score, has_received_bye, previous_opponent_ids";

export type ParticipantRow = {
  player_id?: string | null;
  userId?: string | null;
  id?: string | null;
  score?: unknown;
  has_received_bye?: unknown;
  hasReceivedBye?: unknown;
  previous_opponent_ids?: unknown;
  opponentsFaced?: unknown;
};

export function participantToPlayerHistory(p: ParticipantRow): PlayerHistory {
  return {
    userId: String(p.player_id || p.userId || p.id),
    hasWeeklyPass: true, // query กรอง has_weekly_pass = true มาแล้ว
    score: typeof p.score === "number" ? p.score : 0,
    hasReceivedBye: Boolean(p.has_received_bye ?? p.hasReceivedBye ?? false),
    opponentsFaced: Array.isArray(p.previous_opponent_ids)
      ? (p.previous_opponent_ids as string[])
      : Array.isArray(p.opponentsFaced)
        ? (p.opponentsFaced as string[])
        : [],
  };
}
