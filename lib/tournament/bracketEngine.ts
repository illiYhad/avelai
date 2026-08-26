// ============================================================================
// lib/tournament/bracketEngine.ts
// FEATURE-4201 & FEATURE-4201B: FULL TOURNAMENT BRACKET ENGINE
// ============================================================================

export type BracketType = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION';
export type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'WALKOVER';
export type BracketSide = 'WINNER' | 'LOSER' | 'UPPER' | 'LOWER' | 'GRAND_FINAL' | 'GRAND_FINAL_RESET';

export interface SeededPlayer {
  userId: string;
  seed: number;
  totalScore: number;
  formIndex: number;
  [key: string]: any;
}

export interface Team {
  id: string;
  name: string;
  seed?: number;
  [key: string]: any;
}

export interface DbBracketSlotRow {
  slot_id: string;
  user_id: string;
  seed: number;
  display_name?: string;
  [key: string]: any;
}

export interface DbBracketNode {
  slotId: string;
  tournamentId: string;
  roundNumber: number;
  side: BracketSide;
  matchIndex: number;
  player1: any;
  player2: any;
  winnerId: string | null;
  loserId: string | null;
  status: MatchStatus;
  nextUpperSlotId?: string | null;
  nextLowerSlotId?: string | null;
  isGrandFinalReset?: boolean;
}

export interface BracketNode {
  slotId: string;
  tournamentId: string;
  roundNumber: number;
  side: BracketSide;
  matchIndex: number;
  player1: SeededPlayer | null;
  player2: SeededPlayer | null;
  winnerId: string | null;
  loserId: string | null;
  status: MatchStatus;
  nextUpperSlotId?: string;
  nextLowerSlotId?: string;
  isGrandFinalReset?: boolean;
}

export interface TournamentBracketState {
  tournamentId: string;
  bracketType: BracketType;
  totalRounds: number;
  nodes: Record<string, BracketNode>;
  grandFinalSlotId: string;
  grandFinalResetSlotId?: string;
}

export interface DEMatch {
  id: string;
  side: 'WINNER' | 'LOSER' | 'GRAND_FINAL';
  round: number;
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

// ============================================================================
// 1. SEEDING LOGIC (FORMULA A + B)
// ============================================================================
export function generateSeeding(players: SeededPlayer[]): SeededPlayer[] {
  return [...players]
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.formIndex - a.formIndex;
    })
    .map((p, index) => ({
      ...p,
      seed: index + 1,
    }));
}

// ============================================================================
// 2. WEEKLY TOURNAMENT: SINGLE ELIMINATION (TOP 8) - คงเดิมห้ามแก้
// ============================================================================
export function createTop8SingleElimination(
  tournamentId: string,
  players: SeededPlayer[]
): TournamentBracketState {
  const seeds = generateSeeding(players).slice(0, 8);
  const nodes: Record<string, BracketNode> = {};

  const qfPairings = [
    [0, 7], // Seed 1 vs Seed 8
    [3, 4], // Seed 4 vs Seed 5
    [1, 6], // Seed 2 vs Seed 7
    [2, 5], // Seed 3 vs Seed 6
  ];

  for (let i = 0; i < 4; i++) {
    const slotId = `SE_R1_M${i + 1}`;
    nodes[slotId] = {
      slotId,
      tournamentId,
      roundNumber: 1,
      side: 'UPPER',
      matchIndex: i + 1,
      player1: seeds[qfPairings[i][0]] || null,
      player2: seeds[qfPairings[i][1]] || null,
      winnerId: null,
      loserId: null,
      status: 'PENDING',
      nextUpperSlotId: i < 2 ? 'SE_R2_M1' : 'SE_R2_M2',
    };
  }

  nodes['SE_R2_M1'] = {
    slotId: 'SE_R2_M1',
    tournamentId,
    roundNumber: 2,
    side: 'UPPER',
    matchIndex: 1,
    player1: null,
    player2: null,
    winnerId: null,
    loserId: null,
    status: 'PENDING',
    nextUpperSlotId: 'SE_R3_FINAL',
  };

  nodes['SE_R2_M2'] = {
    slotId: 'SE_R2_M2',
    tournamentId,
    roundNumber: 2,
    side: 'UPPER',
    matchIndex: 2,
    player1: null,
    player2: null,
    winnerId: null,
    loserId: null,
    status: 'PENDING',
    nextUpperSlotId: 'SE_R3_FINAL',
  };

  nodes['SE_R3_FINAL'] = {
    slotId: 'SE_R3_FINAL',
    tournamentId,
    roundNumber: 3,
    side: 'GRAND_FINAL',
    matchIndex: 1,
    player1: null,
    player2: null,
    winnerId: null,
    loserId: null,
    status: 'PENDING',
  };

  return {
    tournamentId,
    bracketType: 'SINGLE_ELIMINATION',
    totalRounds: 3,
    nodes,
    grandFinalSlotId: 'SE_R3_FINAL',
  };
}

export function advanceMatchWinner(
  state: TournamentBracketState,
  currentSlotId: string,
  winnerId: string,
  isWalkover: boolean = false
): TournamentBracketState {
  const current = state.nodes[currentSlotId];
  if (!current || !current.player1 || !current.player2) return state;

  const winner = current.player1.userId === winnerId ? current.player1 : current.player2;
  const loser = current.player1.userId === winnerId ? current.player2 : current.player1;

  current.winnerId = winner.userId;
  current.loserId = loser.userId;
  current.status = isWalkover ? 'WALKOVER' : 'COMPLETED';

  if (current.nextUpperSlotId && state.nodes[current.nextUpperSlotId]) {
    const nextSlot = state.nodes[current.nextUpperSlotId];
    if (!nextSlot.player1) {
      nextSlot.player1 = winner;
    } else if (!nextSlot.player2) {
      nextSlot.player2 = winner;
    }
  }

  return { ...state };
}

// Alias ให้ตรงกับชื่อที่ route เก่าเรียกใช้
export const advanceWinner = advanceMatchWinner as any;
export const generateSingleEliminationBracket = createTop8SingleElimination as any;

// ============================================================================
// 3. MONTHLY TOURNAMENT: FULL DOUBLE ELIMINATION (16 TEAMS) - FEATURE-4201B
// ============================================================================
export const generateDoubleEliminationBracket = (
  tournamentId: string,
  teams: Team[]
): DoubleEliminationBracket => {
  const wbSeedPairings = [
    [0, 15], [7, 8], [3, 12], [4, 11],
    [1, 14], [6, 9], [2, 13], [5, 10]
  ];

  const sortedTeams = [...teams].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
  const wb: DEMatch[][] = [];

  // WB R1 (8 Matches)
  const wbR1: DEMatch[] = [];
  for (let i = 0; i < 8; i++) {
    wbR1.push({
      id: `WB_R1_M${i + 1}`,
      side: 'WINNER',
      round: 1,
      matchNumber: i + 1,
      team1: sortedTeams[wbSeedPairings[i][0]] ?? null,
      team2: sortedTeams[wbSeedPairings[i][1]] ?? null,
      winner: null,
      loser: null,
      nextMatchIdOnWin: `WB_R2_M${Math.floor(i / 2) + 1}`,
      nextMatchIdOnLose: `LB_R1_M${Math.floor(i / 2) + 1}`,
      isGrandFinalReset: false,
      status: 'PENDING',
    });
  }
  wb.push(wbR1);

  // WB R2 (4 Matches)
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

  // WB R3 (2 Matches)
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

  // WB R4 (WB Final)
  wb.push([{
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
  }]);

  // Loser Bracket (7 Rounds)
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

  // LB R5 (1 Match)
  lb.push([{
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
  }]);

  // LB R6 (1 Match - LB Final)
  lb.push([{
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
  }]);

  // LB R7 (1 Match - Final Decider)
  lb.push([{
    id: `LB_R7_M1`,
    side: 'LOSER',
    round: 7,
    matchNumber: 1,
    team1: null,
    team2: null,
    winner: null,
    loser: null,
    nextMatchIdOnWin: `GF_M1`,
    nextMatchIdOnLose: null,
    isGrandFinalReset: false,
    status: 'PENDING',
  }]);

  // Grand Final
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
    }
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

  const isTeam1Winner = currentMatch.team1.id === winnerId;
  const winner = isTeam1Winner ? currentMatch.team1 : currentMatch.team2;
  const loser = isTeam1Winner ? currentMatch.team2 : currentMatch.team1;

  currentMatch.winner = winner;
  currentMatch.loser = loser;
  currentMatch.status = 'COMPLETED';

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
    slotId: m.id,
    tournamentId,
    roundNumber: m.round,
    side: m.side,
    matchIndex: m.matchNumber,
    player1: m.team1,
    player2: m.team2,
    winnerId: m.winner ? m.winner.id : null,
    loserId: m.loser ? m.loser.id : null,
    status: m.status,
    nextUpperSlotId: m.nextMatchIdOnWin,
    nextLowerSlotId: m.nextMatchIdOnLose,
    isGrandFinalReset: m.isGrandFinalReset,
  }));
};