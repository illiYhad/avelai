// K-AV-4: แปลง Slot (เอนจิน) ↔ แถว DB (tournament_bracket_slots) — pure · ใช้ใน action และ T5
import type { Slot, SlotLink, SlotSource, SlotStatus } from "./types";

export type SlotRow = {
  tournament_id: string;
  bracket: string; round: number; position: number;
  team_a_id: string | null; team_b_id: string | null;
  winner_to: string | null; winner_to_side: string | null;
  loser_to: string | null; loser_to_side: string | null;
  source_a: string | null; source_b: string | null;
  is_grand_final_reset: boolean;
  winner_team_id: string | null;
  status: string;
  match_id?: string | null;
};

const src = (s: SlotSource | null) => (s ? `${s.from}:${s.take}` : null);
const parseSrc = (v: string | null): SlotSource | null => {
  if (!v) return null;
  const i = v.lastIndexOf(":");
  const take = v.slice(i + 1);
  return take === "winner" || take === "loser" ? { from: v.slice(0, i), take } : null;
};
const parseLink = (to: string | null, side: string | null): SlotLink | null => (to && (side === "A" || side === "B") ? { to, side } : null);

export function slotToRow(tournamentId: string, s: Slot): SlotRow {
  return {
    tournament_id: tournamentId, bracket: s.bracket, round: s.round, position: s.position,
    team_a_id: s.teamA, team_b_id: s.teamB,
    winner_to: s.winnerTo?.to ?? null, winner_to_side: s.winnerTo?.side ?? null,
    loser_to: s.loserTo?.to ?? null, loser_to_side: s.loserTo?.side ?? null,
    source_a: src(s.sourceA), source_b: src(s.sourceB),
    is_grand_final_reset: s.isGrandFinalReset, winner_team_id: s.winnerId, status: s.status,
  };
}

export function rowToSlot(r: SlotRow): Slot {
  return {
    key: `${r.bracket}-${r.round}-${r.position}`,
    bracket: r.bracket as Slot["bracket"], round: r.round, position: r.position,
    teamA: r.team_a_id, teamB: r.team_b_id,
    winnerTo: parseLink(r.winner_to, r.winner_to_side), loserTo: parseLink(r.loser_to, r.loser_to_side),
    sourceA: parseSrc(r.source_a), sourceB: parseSrc(r.source_b),
    isGrandFinalReset: r.is_grand_final_reset, winnerId: r.winner_team_id, status: r.status as SlotStatus,
  };
}

/** แมตช์ที่ต้องสร้างจากสล็อต: READY = แข่งได้ · BYE ที่มีทีม = แมตช์ผ่านอัตโนมัติ (status BYE · ไม่คิด ELO) */
export function matchRowsFromSlots(tournamentId: string, bestOf: number, slots: Slot[]) {
  return slots
    .filter((s) => (s.status === "READY" || (s.status === "BYE" && s.winnerId)) && !s.isGrandFinalReset)
    .map((s) => ({
      tournament_id: tournamentId, stage: s.bracket, round: s.round, position: s.position,
      team_a_id: s.teamA, team_b_id: s.teamB, best_of: bestOf,
      status: s.status === "BYE" ? "BYE" : "SCHEDULED",
      winner_team_id: s.status === "BYE" ? s.winnerId : null,
      result_source: s.status === "BYE" ? "BYE" : null,
    }));
}
