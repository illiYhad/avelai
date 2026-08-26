// lib/tournament/bracketEngine.ts
// v3 (26-08-2026) — QA fix: เพิ่ม adapter createTop8SingleElimination
// เพื่อเชื่อม route.ts (create-weekly) เข้ากับ engine เดิม โดยไม่แก้ logic เดิมที่ QA ผ่านแล้ว

// ============================================================
// ORIGINAL TYPES (unchanged — QA'd 26-08-2026)
// ============================================================

export type Team = {
  id: string;
  name: string;
  seed: number;
};

export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export type Match = {
  id: string;
  round: number;
  matchNumber: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  nextMatchId: string | null;
  status: MatchStatus;
};

export type Bracket = {
  id: string;
  tournamentId: string;
  rounds: Match[][];
};

// ============================================================
// ORIGINAL CORE LOGIC (unchanged — QA'd 26-08-2026)
// ============================================================

const getNextPowerOfTwo = (num: number): number => {
  return Math.pow(2, Math.ceil(Math.log2(num)));
};

const generateStandardSeedOrder = (slots: number): number[] => {
  if (slots === 1) return [1];
  if (slots === 2) return [1, 2];

  const prevOrder = generateStandardSeedOrder(slots / 2);
  const newOrder: number[] = [];

  prevOrder.forEach((seed) => {
    newOrder.push(seed);
    newOrder.push(slots + 1 - seed);
  });

  return newOrder;
};

export const generateSingleEliminationBracket = (
  tournamentId: string,
  teams: Team[]
): Bracket => {
  const sortedTeams = [...teams].sort((a, b) => a.seed - b.seed);

  const totalSlots = getNextPowerOfTwo(sortedTeams.length);
  const totalRounds = Math.log2(totalSlots);

  const rounds: Match[][] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = totalSlots / Math.pow(2, r);
    const roundMatches: Match[] = [];

    for (let m = 1; m <= matchesInRound; m++) {
      roundMatches.push({
        id: `match_${r}_${m}`,
        round: r,
        matchNumber: m,
        team1: null,
        team2: null,
        winner: null,
        nextMatchId: r < totalRounds ? `match_${r + 1}_${Math.ceil(m / 2)}` : null,
        status: 'pending',
      });
    }
    rounds.push(roundMatches);
  }

  const seedOrder = generateStandardSeedOrder(totalSlots);

  const slotTeams: (Team | null)[] = seedOrder.map((seedNum) => {
    return sortedTeams[seedNum - 1] ?? null;
  });

  for (let i = 0; i < rounds[0].length; i++) {
    const match = rounds[0][i];
    const team1 = slotTeams[i * 2];
    const team2 = slotTeams[i * 2 + 1];

    match.team1 = team1;
    match.team2 = team2;

    if (match.team1 && !match.team2) {
      match.winner = match.team1;
      match.status = 'completed';
    } else if (!match.team1 && match.team2) {
      match.winner = match.team2;
      match.status = 'completed';
    }
  }

  rounds[0].forEach((match) => {
    if (match.winner && match.nextMatchId) {
      const nextRoundIndex = match.round;
      const nextMatch = rounds[nextRoundIndex].find(m => m.id === match.nextMatchId);

      if (nextMatch) {
        if (match.matchNumber % 2 !== 0) {
          nextMatch.team1 = match.winner;
        } else {
          nextMatch.team2 = match.winner;
        }
      }
    }
  });

  return {
    id: `bracket_${Date.now()}`,
    tournamentId,
    rounds,
  };
};

export const advanceWinner = (
  bracket: Bracket,
  matchId: string,
  winnerId: string
): Bracket => {
  const newBracket = { ...bracket, rounds: [...bracket.rounds.map(r => [...r])] };

  let targetMatch: Match | undefined;

  for (const round of newBracket.rounds) {
    targetMatch = round.find(m => m.id === matchId);
    if (targetMatch) break;
  }

  if (!targetMatch) throw new Error("Match not found");
  if (targetMatch.status === 'completed') throw new Error("Match already completed");

  const winner =
    targetMatch.team1?.id === winnerId ? targetMatch.team1 :
    targetMatch.team2?.id === winnerId ? targetMatch.team2 : null;

  if (!winner) throw new Error("Winner must be one of the participating teams");

  targetMatch.winner = winner;
  targetMatch.status = 'completed';

  if (targetMatch.nextMatchId) {
    const nextRoundIndex = targetMatch.round;
    const nextMatch = newBracket.rounds[nextRoundIndex].find(m => m.id === targetMatch?.nextMatchId);

    if (nextMatch) {
      if (targetMatch.matchNumber % 2 !== 0) {
        nextMatch.team1 = winner;
      } else {
        nextMatch.team2 = winner;
      }
    }
  }

  return newBracket;
};

// ============================================================
// ADAPTER — เพิ่มใหม่ 26-08-2026
// เชื่อม route.ts (create-weekly) เข้ากับ engine เดิมด้านบน
// รับ DB rows (bracket_slots) → คืนค่าเป็น flat array พร้อม upsert กลับ Supabase
// ============================================================

type DbBracketSlotRow = {
  id?: string;
  tournament_id: string;
  seed_rank: number;
  player_id: string;
  [key: string]: any;
};

type DbBracketNode = {
  id: string;
  tournament_id: string;
  round: number;
  slot_type: string;
  player1_id: string | null;
  player2_id: string | null;
};

/**
 * Adapter: แปลง Top 8 seed rows จาก Supabase → bracket nodes พร้อม upsert
 * ใช้ generateSingleEliminationBracket ภายใน (ไม่แก้ logic เดิม) แล้ว map ผลลัพธ์
 * กลับเป็น shape ที่ route.ts (create-weekly) ต้องการ: { id, round, player1_id, player2_id, ... }
 */
export const createTop8SingleElimination = (
  tournamentId: string,
  top8Slots: DbBracketSlotRow[]
): DbBracketNode[] => {
  // แปลง DB row → Team object ที่ engine เดิมต้องการ
  const teams: Team[] = top8Slots.map((slot) => ({
    id: slot.player_id,
    name: slot.player_id, // ไม่มีชื่อจาก DB row นี้ ใช้ id แทนชั่วคราว
    seed: slot.seed_rank,
  }));

  const bracket = generateSingleEliminationBracket(tournamentId, teams);

  // แปลง Bracket (nested rounds) → flat array ของ DB nodes
  const nodes: DbBracketNode[] = [];

  bracket.rounds.forEach((roundMatches) => {
    roundMatches.forEach((match) => {
      nodes.push({
        id: match.id,
        tournament_id: tournamentId,
        round: match.round,
        slot_type: 'MATCH',
        player1_id: match.team1?.id ?? null,
        player2_id: match.team2?.id ?? null,
      });
    });
  });

  return nodes;
};