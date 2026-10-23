// lib/tournament/monthlyDoubleElim.ts

export interface MonthlyQualifierCandidate {
  userId: string;
  circuitPoints: number;
  weeklyWinRate: number;
  bestRank: number;
  seed: number;
  hasMonthlyPass: boolean;
  qualifiedAt: string;
}

export interface BracketMatch {
  matchId: string;
  roundNumber: number;
  seed1: number | null;
  seed2: number | null;
  player1Id?: string | null;
  player2Id?: string | null;
  winnerAdvancesTo?: string | null;
  loserAdvancesTo?: string | null;
  status: 'waiting' | 'ready' | 'completed';
}

export interface BracketRound {
  roundId: string;
  roundNumber: number;
  matches: BracketMatch[];
}

export interface MonthlyDoubleEliminationBracket {
  bracketId: string;
  seasonId: string;
  tournamentId: string;
  winnersTree: { rounds: BracketRound[] };
  losersTree: { rounds: BracketRound[] };
  grandFinal: {
    matchId: string;
    seed1: number | null;
    seed2: number | null;
    requiresReset: boolean;
    status: 'waiting' | 'ready' | 'completed';
  };
  status: 'ready' | 'in_progress' | 'completed';
  createdAt: string;
}

export function createMonthlyDoubleElimination(input: {
  seasonId: string;
  monthlyTournamentId: string;
  qualifiedPlayers: MonthlyQualifierCandidate[];
  startTime?: string;
}): MonthlyDoubleEliminationBracket {
  const { seasonId, monthlyTournamentId, qualifiedPlayers, startTime } = input;
  const playerMap = new Map(qualifiedPlayers.map(p => [p.seed, p.userId]));

  // 1. Winners Bracket (4 Rounds)
  // R1: 8 Matches
  const wbR1SeedPairings = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [6, 11], [3, 14], [7, 10], [2, 15]
  ];

  const wbR1Matches: BracketMatch[] = wbR1SeedPairings.map((pair, idx) => ({
    matchId: `WB_R1_M${idx + 1}`,
    roundNumber: 1,
    seed1: pair[0],
    seed2: pair[1],
    player1Id: playerMap.get(pair[0]) || null,
    player2Id: playerMap.get(pair[1]) || null,
    winnerAdvancesTo: `WB_R2_M${Math.floor(idx / 2) + 1}`,
    loserAdvancesTo: `LB_R1_M${Math.floor(idx / 2) + 1}`,
    status: 'ready'
  }));

  // R2: 4 Matches (แก้ Crossover ให้ตรงตาม Slot ของ LB R2)
  const wbR2Matches: BracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
    matchId: `WB_R2_M${i + 1}`,
    roundNumber: 2,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `WB_R3_M${Math.floor(i / 2) + 1}`,
    loserAdvancesTo: `LB_R2_M${i + 1}`,
    status: 'waiting'
  }));

  // R3: 2 Matches (Semi-Finals)
  const wbR3Matches: BracketMatch[] = Array.from({ length: 2 }, (_, i) => ({
    matchId: `WB_R3_M${i + 1}`,
    roundNumber: 3,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `WB_R4_M1`,
    loserAdvancesTo: `LB_R4_M${2 - i}`,
    status: 'waiting'
  }));

  // R4: 1 Match (Winners Final)
  const wbR4Matches: BracketMatch[] = [{
    matchId: `WB_R4_M1`,
    roundNumber: 4,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `GF_GAME1`,
    loserAdvancesTo: `LB_R6_M1`,
    status: 'waiting'
  }];

  // 2. Losers Bracket (6 Rounds - 14 Matches total)
  // LB R1: กำหนด loserAdvancesTo เป็น null ชัดเจน (แพ้ = ตกรอบ)
  const lbR1Matches: BracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
    matchId: `LB_R1_M${i + 1}`,
    roundNumber: 1,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `LB_R2_M${i + 1}`,
    loserAdvancesTo: null,
    status: 'waiting'
  }));

  const lbR2Matches: BracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
    matchId: `LB_R2_M${i + 1}`,
    roundNumber: 2,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `LB_R3_M${Math.floor(i / 2) + 1}`,
    loserAdvancesTo: null,
    status: 'waiting'
  }));

  const lbR3Matches: BracketMatch[] = Array.from({ length: 2 }, (_, i) => ({
    matchId: `LB_R3_M${i + 1}`,
    roundNumber: 3,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `LB_R4_M${i + 1}`,
    loserAdvancesTo: null,
    status: 'waiting'
  }));

  const lbR4Matches: BracketMatch[] = Array.from({ length: 2 }, (_, i) => ({
    matchId: `LB_R4_M${i + 1}`,
    roundNumber: 4,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `LB_R5_M1`,
    loserAdvancesTo: null,
    status: 'waiting'
  }));

  const lbR5Matches: BracketMatch[] = [{
    matchId: `LB_R5_M1`,
    roundNumber: 5,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `LB_R6_M1`,
    loserAdvancesTo: null,
    status: 'waiting'
  }];

  const lbR6Matches: BracketMatch[] = [{
    matchId: `LB_R6_M1`,
    roundNumber: 6,
    seed1: null,
    seed2: null,
    winnerAdvancesTo: `GF_GAME1`,
    loserAdvancesTo: null,
    status: 'waiting'
  }];

  return {
    bracketId: `BRACKET_${seasonId}_${monthlyTournamentId}`,
    seasonId,
    tournamentId: monthlyTournamentId,
    winnersTree: {
      rounds: [
        { roundId: 'WB_R1', roundNumber: 1, matches: wbR1Matches },
        { roundId: 'WB_R2', roundNumber: 2, matches: wbR2Matches },
        { roundId: 'WB_R3', roundNumber: 3, matches: wbR3Matches },
        { roundId: 'WB_R4', roundNumber: 4, matches: wbR4Matches },
      ]
    },
    losersTree: {
      rounds: [
        { roundId: 'LB_R1', roundNumber: 1, matches: lbR1Matches },
        { roundId: 'LB_R2', roundNumber: 2, matches: lbR2Matches },
        { roundId: 'LB_R3', roundNumber: 3, matches: lbR3Matches },
        { roundId: 'LB_R4', roundNumber: 4, matches: lbR4Matches },
        { roundId: 'LB_R5', roundNumber: 5, matches: lbR5Matches },
        { roundId: 'LB_R6', roundNumber: 6, matches: lbR6Matches },
      ]
    },
    grandFinal: {
      matchId: 'GF_GAME1',
      seed1: null,
      seed2: null,
      requiresReset: true,
      status: 'waiting'
    },
    status: 'ready',
    createdAt: startTime || new Date().toISOString()
  };
}