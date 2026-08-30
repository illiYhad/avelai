// ============================================================================
// lib/tournament/bracketEngine.ts
// FEATURE-4201 (Weekly Single Elimination) & FEATURE-4201B (Monthly Double Elimination)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. BASE / WEEKLY TYPES (LOCKED SYSTEM - VERIFIED)
// ----------------------------------------------------------------------------
// lib/tournament/bracketEngine.ts

// Export Tournament Engines
export * from './monthlyDoubleElim';
export * from './swissPairing';
// export * from './annualFinals'; (ในอนาคต)
export type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'WALKOVER';

export interface Team {
  id: string;
  name: string;
  seed: number;
}

export interface Match {
  id: string;
  round: number;
  matchNumber: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  status: MatchStatus;
}

export interface Bracket {
  id: string;
  tournamentId: string;
  rounds: Match[][];
}

export interface DbBracketSlotRow {
  slot_id: string;
  user_id: string;
  seed: number;
  display_name?: string;
  [key: string]: unknown;
}

export interface DbBracketNode {
  slot_id: string;
  tournament_id: string;
  round_number: number;
  match_index: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  status: MatchStatus;
  next_upper_slot_id: string | null;
  next_lower_slot_id: string | null;
  is_grand_final_reset: boolean;
}

// ----------------------------------------------------------------------------
// 2. FEATURE-4201B TYPE EXTENSIONS (MONTHLY DOUBLE ELIMINATION)
// ----------------------------------------------------------------------------
export type BracketSide = 'WINNER' | 'LOSER' | 'GRAND_FINAL';

export interface DEMatch {
  id: string;
  side: BracketSide;
  round: number; // นับแยกอิสระต่อ side (Winner round 1..4 / Loser round 1..6 / GF 1..2)
  matchNumber: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  loser: Team | null;
  nextMatchIdOnWin: string | null;
  nextMatchIdOnLose: string | null;
  isGrandFinalReset: boolean;
  status: MatchStatus;
}

export interface DoubleEliminationBracket {
  id: string;
  tournamentId: string;
  winnerBracket: DEMatch[][];
  loserBracket: DEMatch[][];
  grandFinal: DEMatch[];
}

// ----------------------------------------------------------------------------
// 3. SEEDING ALGORITHM (STANDARD RECURSIVE)
// ----------------------------------------------------------------------------
export function generateStandardSeedOrder(numTeams: number): number[] {
  const rounds = Math.log2(numTeams) - 1;
  let pls = [1, 2];
  for (let i = 0; i < rounds; i++) {
    const nextPls: number[] = [];
    const length = pls.length * 2 + 1;
    for (const d of pls) {
      nextPls.push(d);
      nextPls.push(length - d);
    }
    pls = nextPls;
  }
  return pls;
}

// ----------------------------------------------------------------------------
// 4. WEEKLY SINGLE ELIMINATION (LOCKED CORE - ORIGINAL RESTORED)
// ----------------------------------------------------------------------------
export function generateSingleEliminationBracket(
  tournamentId: string,
  teams: Team[]
): Bracket {
  const seedOrder = generateStandardSeedOrder(8);
  const teamMap = new Map<number, Team>();
  teams.forEach((t) => teamMap.set(t.seed, t));

  const rounds: Match[][] = [];

  // Round 1 (QF: 4 Matches)
  const r1Matches: Match[] = [];
  for (let i = 0; i < 4; i++) {
    const s1 = seedOrder[i * 2];
    const s2 = seedOrder[i * 2 + 1];
    r1Matches.push({
      id: `SE_R1_M${i + 1}`,
      round: 1,
      matchNumber: i + 1,
      team1: teamMap.get(s1) ?? null,
      team2: teamMap.get(s2) ?? null,
      winner: null,
      status: 'PENDING',
    });
  }
  rounds.push(r1Matches);

  // Round 2 (SF: 2 Matches)
  const r2Matches: Match[] = [];
  for (let i = 0; i < 2; i++) {
    r2Matches.push({
      id: `SE_R2_M${i + 1}`,
      round: 2,
      matchNumber: i + 1,
      team1: null,
      team2: null,
      winner: null,
      status: 'PENDING',
    });
  }
  rounds.push(r2Matches);

  // Round 3 (Final: 1 Match)
  rounds.push([
    {
      id: `SE_R3_FINAL`,
      round: 3,
      matchNumber: 1,
      team1: null,
      team2: null,
      winner: null,
      status: 'PENDING',
    },
  ]);

  return {
    id: `SE_BRACKET_${tournamentId}`,
    tournamentId,
    rounds,
  };
}

export function advanceWinner(
  bracket: Bracket,
  matchId: string,
  winnerId: string
): Bracket {
  const allMatches = bracket.rounds.flat();
  const currentMatch = allMatches.find((m) => m.id === matchId);

  if (!currentMatch || !currentMatch.team1 || !currentMatch.team2) {
    return bracket;
  }

  // 🛑 [GUARD 1] Idempotency Protection: ป้องกันการประมวลผลแมตช์ซ้ำ
  if (currentMatch.status === 'COMPLETED' || currentMatch.status === 'WALKOVER') {
    throw new Error(`[Idempotency Guard] Match ${matchId} has already been completed.`);
  }

  const winner = currentMatch.team1.id === winnerId ? currentMatch.team1 : currentMatch.team2;
  currentMatch.winner = winner;
  currentMatch.status = 'COMPLETED';

  // Advance to next round in Single Elimination
  if (currentMatch.round === 1) {
    const nextMatchId = currentMatch.matchNumber <= 2 ? 'SE_R2_M1' : 'SE_R2_M2';
    const nextMatch = allMatches.find((m) => m.id === nextMatchId);
    if (nextMatch) {
      if (currentMatch.matchNumber % 2 !== 0) {
        nextMatch.team1 = winner;
      } else {
        nextMatch.team2 = winner;
      }
    }
  } else if (currentMatch.round === 2) {
    const finalMatch = allMatches.find((m) => m.id === 'SE_R3_FINAL');
    if (finalMatch) {
      if (currentMatch.matchNumber === 1) {
        finalMatch.team1 = winner;
      } else {
        finalMatch.team2 = winner;
      }
    }
  }

  return { ...bracket };
}

export function createTop8SingleElimination(
  tournamentId: string,
  top8Slots: DbBracketSlotRow[]
): DbBracketNode[] {
  const teams: Team[] = top8Slots.map((slot) => ({
    id: slot.user_id,
    name: slot.display_name ?? `Seed #${slot.seed}`,
    seed: slot.seed,
  }));

  const bracket = generateSingleEliminationBracket(tournamentId, teams);
  const allMatches = bracket.rounds.flat();

  return allMatches.map((m) => {
    let nextUpperSlotId: string | null = null;
    if (m.round === 1) {
      nextUpperSlotId = m.matchNumber <= 2 ? 'SE_R2_M1' : 'SE_R2_M2';
    } else if (m.round === 2) {
      nextUpperSlotId = 'SE_R3_FINAL';
    }

    return {
      slot_id: m.id,
      tournament_id: tournamentId,
      round_number: m.round,
      match_index: m.matchNumber,
      player1_id: m.team1 ? m.team1.id : null,
      player2_id: m.team2 ? m.team2.id : null,
      winner_id: m.winner ? m.winner.id : null,
      loser_id: null,
      status: m.status,
      next_upper_slot_id: nextUpperSlotId,
      next_lower_slot_id: null,
      is_grand_final_reset: false,
    };
  });
}

// ----------------------------------------------------------------------------
// 5. MONTHLY DOUBLE ELIMINATION (16 TEAMS - FEATURE-4201B)
// ----------------------------------------------------------------------------
export const generateDoubleEliminationBracket = (
  tournamentId: string,
  teams: Team[]
): DoubleEliminationBracket => {
  const seedOrder16 = generateStandardSeedOrder(16);
  const teamMap = new Map<number, Team>();
  teams.forEach((t) => teamMap.set(t.seed, t));

  // --- WINNER BRACKET (4 Rounds: 8 -> 4 -> 2 -> 1) ---
  const wb: DEMatch[][] = [];

  // WB R1 (8 Matches)
  const wbR1: DEMatch[] = [];
  for (let i = 0; i < 8; i++) {
    const s1 = seedOrder16[i * 2];
    const s2 = seedOrder16[i * 2 + 1];
    wbR1.push({
      id: `WB_R1_M${i + 1}`,
      side: 'WINNER',
      round: 1,
      matchNumber: i + 1,
      team1: teamMap.get(s1) ?? null,
      team2: teamMap.get(s2) ?? null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `WB_R2_M${Math.floor(i / 2) + 1}`,
      nextMatchIdOnLose: `LB_R1_M${Math.floor(i / 2) + 1}`,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  wb.push(wbR1);

  // WB R2 (4 Matches - Quarter Finals)
  const wbR2: DEMatch[] = [];
  for (let i = 0; i < 4; i++) {
    wbR2.push({
      id: `WB_R2_M${i + 1}`,
      side: 'WINNER',
      round: 2,
      matchNumber: i + 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `WB_R3_M${Math.floor(i / 2) + 1}`,
      nextMatchIdOnLose: `LB_R2_M${i + 1}`,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  wb.push(wbR2);

  // WB R3 (2 Matches - Semi Finals)
  const wbR3: DEMatch[] = [];
  for (let i = 0; i < 2; i++) {
    wbR3.push({
      id: `WB_R3_M${i + 1}`,
      side: 'WINNER',
      round: 3,
      matchNumber: i + 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `WB_R4_M1`,
      nextMatchIdOnLose: `LB_R4_M${i + 1}`,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  wb.push(wbR3);

  // WB R4 (1 Match - WB Final)
  wb.push([
    {
      id: `WB_R4_M1`,
      side: 'WINNER',
      round: 4,
      matchNumber: 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `GF_M1`,
      nextMatchIdOnLose: `LB_R6_M1`,
      isGrandFinalReset: false,
      status: 'PENDING',
    },
  ]);

  // --- LOSER BRACKET (6 Rounds: 2*(4)-2 = 6 Rounds) ---
  const lb: DEMatch[][] = [];

  // LB R1 (4 Matches)
  const lbR1: DEMatch[] = [];
  for (let i = 0; i < 4; i++) {
    lbR1.push({
      id: `LB_R1_M${i + 1}`,
      side: 'LOSER',
      round: 1,
      matchNumber: i + 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `LB_R2_M${i + 1}`,
      nextMatchIdOnLose: null,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  lb.push(lbR1);

  // LB R2 (4 Matches)
  const lbR2: DEMatch[] = [];
  for (let i = 0; i < 4; i++) {
    lbR2.push({
      id: `LB_R2_M${i + 1}`,
      side: 'LOSER',
      round: 2,
      matchNumber: i + 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `LB_R3_M${Math.floor(i / 2) + 1}`,
      nextMatchIdOnLose: null,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  lb.push(lbR2);

  // LB R3 (2 Matches)
  const lbR3: DEMatch[] = [];
  for (let i = 0; i < 2; i++) {
    lbR3.push({
      id: `LB_R3_M${i + 1}`,
      side: 'LOSER',
      round: 3,
      matchNumber: i + 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `LB_R4_M${i + 1}`,
      nextMatchIdOnLose: null,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  lb.push(lbR3);

  // LB R4 (2 Matches)
  const lbR4: DEMatch[] = [];
  for (let i = 0; i < 2; i++) {
    lbR4.push({
      id: `LB_R4_M${i + 1}`,
      side: 'LOSER',
      round: 4,
      matchNumber: i + 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `LB_R5_M1`,
      nextMatchIdOnLose: null,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  lb.push(lbR4);

  // LB R5 (1 Match - LB Semi Final)
  lb.push([
    {
      id: `LB_R5_M1`,
      side: 'LOSER',
      round: 5,
      matchNumber: 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `LB_R6_M1`,
      nextMatchIdOnLose: null,
      isGrandFinalReset: false,
      status: 'PENDING',
    },
  ]);

  // LB R6 (1 Match - LB Final)
  lb.push([
    {
      id: `LB_R6_M1`,
      side: 'LOSER',
      round: 6,
      matchNumber: 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `GF_M1`,
      nextMatchIdOnLose: null,
      isGrandFinalReset: false,
      status: 'PENDING',
    },
  ]);

  // --- GRAND FINAL (GF_M1) ---
  const grandFinal: DEMatch[] = [
    {
      id: `GF_M1`,
      side: 'GRAND_FINAL',
      round: 1,
      matchNumber: 1,
      team1: null,
      team2: null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: null,
      nextMatchIdOnLose: null,
      isGrandFinalReset: false,
      status: 'PENDING',
    },
  ];

  return {
    id: `DE_BRACKET_${tournamentId}`,
    tournamentId,
    winnerBracket: wb,
    loserBracket: lb,
    grandFinal,
  };
};

export const advanceDoubleEliminationWinner = (
  bracket: DoubleEliminationBracket,
  matchId: string,
  winnerId: string
): DoubleEliminationBracket => {
  const allMatches: DEMatch[] = [
    ...bracket.winnerBracket.flat(),
    ...bracket.loserBracket.flat(),
    ...bracket.grandFinal,
  ];

  const currentMatch = allMatches.find((m) => m.id === matchId);
  if (!currentMatch || !currentMatch.team1 || !currentMatch.team2) {
    return bracket;
  }

  // 🛑 [GUARD 2] Idempotency Protection: ป้องกันการประมวลผล Double Elimination แมตช์ซ้ำ
  if (currentMatch.status === 'COMPLETED' || currentMatch.status === 'WALKOVER') {
    throw new Error(`[Idempotency Guard] DEMatch ${matchId} has already been completed.`);
  }

  const isTeam1Winner = currentMatch.team1.id === winnerId;
  const winner = isTeam1Winner ? currentMatch.team1 : currentMatch.team2;
  const loser = isTeam1Winner ? currentMatch.team2 : currentMatch.team1;

  currentMatch.winner = winner;
  currentMatch.loser = loser;
  currentMatch.status = 'COMPLETED';

  // 1. Advance Winner
  if (currentMatch.nextMatchIdOnWin) {
    const nextWinMatch = allMatches.find((m) => m.id === currentMatch.nextMatchIdOnWin);
    if (nextWinMatch) {
      if (!nextWinMatch.team1) {
        nextWinMatch.team1 = winner;
      } else if (!nextWinMatch.team2) {
        nextWinMatch.team2 = winner;
      }
    }
  }

  // 2. Drop Loser to LB
  if (currentMatch.nextMatchIdOnLose) {
    const nextLoseMatch = allMatches.find((m) => m.id === currentMatch.nextMatchIdOnLose);
    if (nextLoseMatch) {
      if (!nextLoseMatch.team1) {
        nextLoseMatch.team1 = loser;
      } else if (!nextLoseMatch.team2) {
        nextLoseMatch.team2 = loser;
      }
    }
  }

  // 3. Grand Final Reset Case
  if (currentMatch.id === 'GF_M1') {
    const isLbChampionWinner = currentMatch.team2?.id === winnerId;
    if (isLbChampionWinner) {
      if (bracket.grandFinal.length === 1) {
        const gfResetMatch: DEMatch = {
          id: `GF_M2_RESET`,
          side: 'GRAND_FINAL',
          round: 2,
          matchNumber: 2,
          team1: currentMatch.team1,
          team2: currentMatch.team2,
          winner: null,
          loser: null,
          nextMatchIdOnWin: null,
          nextMatchIdOnLose: null,
          isGrandFinalReset: true,
          status: 'PENDING',
        };
        bracket.grandFinal.push(gfResetMatch);
      }
    }
  }

  return { ...bracket };
};

export const createMonthlyDoubleElimination = (
  tournamentId: string,
  top16Slots: DbBracketSlotRow[]
): (DbBracketNode & { side: BracketSide })[] => {
  const teams: Team[] = top16Slots.map((slot) => ({
    id: slot.user_id,
    name: slot.display_name ?? `Seed #${slot.seed}`,
    seed: slot.seed,
  }));

  const bracket = generateDoubleEliminationBracket(tournamentId, teams);
  const allMatches: DEMatch[] = [
    ...bracket.winnerBracket.flat(),
    ...bracket.loserBracket.flat(),
    ...bracket.grandFinal,
  ];

  return allMatches.map((m) => ({
    slot_id: m.id,
    tournament_id: tournamentId,
    round_number: m.round,
    side: m.side,
    match_index: m.matchNumber,
    player1_id: m.team1 ? m.team1.id : null,
    player2_id: m.team2 ? m.team2.id : null,
    winner_id: m.winner ? m.winner.id : null,
    loser_id: m.loser ? m.loser.id : null,
    status: m.status,
    next_upper_slot_id: m.nextMatchIdOnWin,
    next_lower_slot_id: m.nextMatchIdOnLose,
    is_grand_final_reset: m.isGrandFinalReset,
  }));
};