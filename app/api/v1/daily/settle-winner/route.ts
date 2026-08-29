import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ================================================================================
// SYSTEM ARCHITECTURE: MATCHMAKING & TIER EVALUATION ENGINE
// ================================================================================

// --------------------------------------------------------------------------------
// 1. DATA TYPES & INTERFACES
// --------------------------------------------------------------------------------

export interface MatchScoreMapping {
  score: number;
  matrixRank: number; // Rank 1-20 ตามผล Win/Lose
  winCount: number;
  loseCount: number;
}

export interface FormTierConfig {
  formLevel: number;       // Level 1 ถึง 20
  tierCode: string;        // SSS+, SSS, SS+, ..., E, Unranked
  minScore: number;        // ขอบเขตคะแนนล่าง (Inclusive)
  maxScore: number;        // ขอบเขตคะแนนบน (Inclusive)
  searchTolerance: number; // ค่าบวกลบระดับในการค้นหาห้อง (Matchmaking Tolerance)
}

// --------------------------------------------------------------------------------
// 2. LAYER 1: RAW MATCH RESULTS MATRIX (ตารางคำนวณผลแพ้-ชนะ)
// --------------------------------------------------------------------------------

export const MATCH_RESULT_MATRIX: MatchScoreMapping[] = [
  { score: 0.00, matrixRank: 20, winCount: 0, loseCount: 5 },
  { score: 0.25, matrixRank: 19, winCount: 0, loseCount: 4 },
  { score: 0.50, matrixRank: 18, winCount: 0, loseCount: 3 },
  { score: 0.75, matrixRank: 17, winCount: 0, loseCount: 2 },
  { score: 1.00, matrixRank: 16, winCount: 0, loseCount: 1 },
  { score: 1.25, matrixRank: 15, winCount: 1, loseCount: 4 },
  { score: 1.50, matrixRank: 14, winCount: 1, loseCount: 3 },
  { score: 1.75, matrixRank: 13, winCount: 1, loseCount: 2 },
  { score: 2.00, matrixRank: 12, winCount: 1, loseCount: 1 },
  { score: 2.50, matrixRank: 11, winCount: 1, loseCount: 0 },
  { score: 2.75, matrixRank: 10, winCount: 2, loseCount: 0 },
  { score: 3.00, matrixRank: 9,  winCount: 2, loseCount: 1 },
  { score: 3.25, matrixRank: 8,  winCount: 2, loseCount: 2 },
  { score: 3.50, matrixRank: 7,  winCount: 2, loseCount: 3 },
  { score: 3.75, matrixRank: 6,  winCount: 3, loseCount: 2 },
  { score: 4.00, matrixRank: 5,  winCount: 3, loseCount: 1 },
  { score: 4.25, matrixRank: 4,  winCount: 3, loseCount: 0 },
  { score: 4.50, matrixRank: 3,  winCount: 4, loseCount: 1 },
  { score: 4.75, matrixRank: 2,  winCount: 4, loseCount: 0 },
  { score: 5.00, matrixRank: 1,  winCount: 5, loseCount: 0 },
];

// --------------------------------------------------------------------------------
// 3. LAYER 2: RANKED SCRIM TIER CONFIGURATION (ตารางจัดระดับ 20 Tiers)
// --------------------------------------------------------------------------------

export const SCRIM_TIER_CONFIGS: FormTierConfig[] = [
  { formLevel: 20, tierCode: 'SSS+ (God Tier)',        minScore: 4.80, maxScore: 5.00, searchTolerance: 1 },
  { formLevel: 19, tierCode: 'SSS',                    minScore: 4.60, maxScore: 4.79, searchTolerance: 1 },
  { formLevel: 18, tierCode: 'SS+',                    minScore: 4.40, maxScore: 4.59, searchTolerance: 2 },
  { formLevel: 17, tierCode: 'SS',                     minScore: 4.20, maxScore: 4.39, searchTolerance: 2 },
  { formLevel: 16, tierCode: 'S+',                     minScore: 4.00, maxScore: 4.19, searchTolerance: 2 },
  { formLevel: 15, tierCode: 'S',                      minScore: 3.80, maxScore: 3.99, searchTolerance: 2 },
  { formLevel: 14, tierCode: 'A+',                     minScore: 3.60, maxScore: 3.79, searchTolerance: 3 },
  { formLevel: 13, tierCode: 'A',                      minScore: 3.40, maxScore: 3.59, searchTolerance: 3 },
  { formLevel: 12, tierCode: 'A-',                     minScore: 3.20, maxScore: 3.39, searchTolerance: 3 },
  { formLevel: 11, tierCode: 'B+ (Top Average)',        minScore: 3.00, maxScore: 3.19, searchTolerance: 3 },
  { formLevel: 10, tierCode: 'B (Default Midpoint: 2.80)', minScore: 2.80, maxScore: 2.99, searchTolerance: 3 },
  { formLevel: 9,  tierCode: 'B-',                     minScore: 2.60, maxScore: 2.79, searchTolerance: 3 },
  { formLevel: 8,  tierCode: 'C+',                     minScore: 2.40, maxScore: 2.59, searchTolerance: 3 },
  { formLevel: 7,  tierCode: 'C',                      minScore: 2.20, maxScore: 2.39, searchTolerance: 3 },
  { formLevel: 6,  tierCode: 'C-',                     minScore: 2.00, maxScore: 2.19, searchTolerance: 3 },
  { formLevel: 5,  tierCode: 'D+',                     minScore: 1.75, maxScore: 1.99, searchTolerance: 4 },
  { formLevel: 4,  tierCode: 'D',                      minScore: 1.50, maxScore: 1.74, searchTolerance: 4 },
  { formLevel: 3,  tierCode: 'D-',                     minScore: 1.25, maxScore: 1.49, searchTolerance: 4 },
  { formLevel: 2,  tierCode: 'E',                      minScore: 1.00, maxScore: 1.24, searchTolerance: 5 },
  { formLevel: 1,  tierCode: 'Unranked / Calibrating', minScore: 0.00, maxScore: 0.99, searchTolerance: 5 },
];

// --------------------------------------------------------------------------------
// 4. BUSINESS LOGIC & INTEGRATION PIPELINE
// --------------------------------------------------------------------------------

export function evaluatePlayerTierProfile(winCount: number, loseCount: number) {
  const matchResult = MATCH_RESULT_MATRIX.find(
    (m) => m.winCount === winCount && m.loseCount === loseCount
  );

  const rawScore = matchResult ? matchResult.score : 0.00;

  const tierProfile = SCRIM_TIER_CONFIGS.find(
    (t) => rawScore >= t.minScore && rawScore <= t.maxScore
  ) || SCRIM_TIER_CONFIGS[SCRIM_TIER_CONFIGS.length - 1];

  return {
    inputStats: { winCount, loseCount },
    evaluatedScore: rawScore,
    matrixRank: matchResult ? matchResult.matrixRank : 20,
    tierProfile: {
      level: tierProfile.formLevel,
      tierCode: tierProfile.tierCode,
      searchTolerance: tierProfile.searchTolerance,
      minMatchableLevel: Math.max(1, tierProfile.formLevel - tierProfile.searchTolerance),
      maxMatchableLevel: Math.min(20, tierProfile.formLevel + tierProfile.searchTolerance),
    },
  };
}

// ============================================================================
// FEATURE-4210: DAILY ARENA MATCHMAKING & FILL BONUS TYPES & ENGINE
// ============================================================================

export type DotaPosition = 1 | 2 | 3 | 4 | 5;

export interface DailyQueuePlayer {
  userId: string;
  primaryPosition: DotaPosition;
  secondaryPosition: DotaPosition;
  queuedAt: number;
  tierProfile: ReturnType<typeof evaluatePlayerTierProfile>;
}

export interface FormedTeamMember {
  userId: string;
  assignedPosition: DotaPosition;
  isSecondaryFill: boolean;
  formLevel: number;
  tierCode: string;
}

export interface DailyArenaMatchFormation {
  matchId: string;
  teamA: FormedTeamMember[];
  teamB: FormedTeamMember[];
  averageFormLevelTeamA: number;
  averageFormLevelTeamB: number;
  formLevelDelta: number;
  secondaryFillUserIds: string[];
  matchedAt: string;
}

export interface DailyRewardSettlementPayload {
  userId: string;
  isSecondaryFill: boolean;
  bonusRewardPoints: number;
}

const SECONDARY_FILL_BONUS_POINTS = 20;

export function processDailyArenaQueue(
  queuePool: DailyQueuePlayer[]
): DailyArenaMatchFormation | null {
  const positions: DotaPosition[] = [1, 2, 3, 4, 5];
  const assignedPlayersPerPos: Record<DotaPosition, FormedTeamMember[]> = {
    1: [], 2: [], 3: [], 4: [], 5: []
  };

  const usedUserIds = new Set<string>();

  for (const pos of positions) {
    const primaryCandidates = queuePool.filter(
      p => !usedUserIds.has(p.userId) && p.primaryPosition === pos
    );
    for (const p of primaryCandidates) {
      if (assignedPlayersPerPos[pos].length < 2) {
        assignedPlayersPerPos[pos].push({
          userId: p.userId,
          assignedPosition: pos,
          isSecondaryFill: false,
          formLevel: p.tierProfile.tierProfile.level,
          tierCode: p.tierProfile.tierProfile.tierCode
        });
        usedUserIds.add(p.userId);
      }
    }
  }

  for (const pos of positions) {
    if (assignedPlayersPerPos[pos].length < 2) {
      const secondaryCandidates = queuePool.filter(
        p => !usedUserIds.has(p.userId) && p.secondaryPosition === pos
      );
      for (const p of secondaryCandidates) {
        if (assignedPlayersPerPos[pos].length < 2) {
          assignedPlayersPerPos[pos].push({
            userId: p.userId,
            assignedPosition: pos,
            isSecondaryFill: true,
            formLevel: p.tierProfile.tierProfile.level,
            tierCode: p.tierProfile.tierProfile.tierCode
          });
          usedUserIds.add(p.userId);
        }
      }
    }
  }

  const isComplete = positions.every(pos => assignedPlayersPerPos[pos].length === 2);
  if (!isComplete) return null;

  const teamA: FormedTeamMember[] = [];
  const teamB: FormedTeamMember[] = [];

  positions.forEach((pos, idx) => {
    const pair = assignedPlayersPerPos[pos].sort((a, b) => b.formLevel - a.formLevel);
    if (idx % 2 === 0) {
      teamA.push(pair[0]);
      teamB.push(pair[1]);
    } else {
      teamB.push(pair[0]);
      teamA.push(pair[1]);
    }
  });

  const avgFormA = Number((teamA.reduce((sum, p) => sum + p.formLevel, 0) / 5).toFixed(2));
  const avgFormB = Number((teamB.reduce((sum, p) => sum + p.formLevel, 0) / 5).toFixed(2));

  const secondaryFillUserIds = [...teamA, ...teamB]
    .filter(p => p.isSecondaryFill)
    .map(p => p.userId);

  return {
    matchId: `daily_${Date.now()}`,
    teamA,
    teamB,
    averageFormLevelTeamA: avgFormA,
    averageFormLevelTeamB: avgFormB,
    formLevelDelta: Math.abs(avgFormA - avgFormB),
    secondaryFillUserIds,
    matchedAt: new Date().toISOString()
  };
}

export function calculateDailyFillBonus(isSecondaryFill: boolean): number {
  return isSecondaryFill ? SECONDARY_FILL_BONUS_POINTS : 0;
}

// ============================================================================
// 5. NEXT.JS APP ROUTER HTTP HANDLER
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { matchId, winningTeam, players } = body;

    if (!matchId || !winningTeam || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'Invalid payload. matchId, winningTeam, and players are required.' },
        { status: 400 }
      );
    }

    const settlements: DailyRewardSettlementPayload[] = players.map((player: any) => {
      const isSecondaryFill = Boolean(player.isSecondaryFill);
      const bonusPoints = calculateDailyFillBonus(isSecondaryFill);

      return {
        userId: String(player.userId),
        isSecondaryFill,
        bonusRewardPoints: bonusPoints,
      };
    });

    return NextResponse.json(
      {
        success: true,
        matchId,
        winningTeam,
        settlements,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}