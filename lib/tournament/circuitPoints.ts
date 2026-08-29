// ============================================================================
// 1. TYPE DEFINITIONS & INTERFACES (FEATURE-4203 COMPLIANT)
// ============================================================================

export type CircuitPointSource =
  | 'weekly_champion'
  | 'runner_up'
  | 'top4'
  | 'top8'
  | 'swiss'
  | 'unranked';

export interface WeeklyPlacementInput {
  userId: string;
  rank: number;
  swissWins: number;
  swissWinRate: number;
  totalScore: number;
}

export interface CircuitPointAward {
  idempotencyKey: string;
  userId: string;
  seasonId: string;
  weeklyTournamentId: string;
  pointsEarned: number;
  source: CircuitPointSource;
  awardedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  totalCircuitPoints: number;
  weeklyWinRate: number;
  bestRank: number;
  achievedAt: string; // ISO Timestamp สำหรับ Tiebreaker ลำดับที่ 4
}

export interface MonthlyQualifierCandidate {
  userId: string;
  circuitPoints: number;
  weeklyWinRate: number;
  bestRank: number;
  seed: number;
  hasMonthlyPass: boolean;
  qualifiedAt: string;
}

// ============================================================================
// 2. CIRCUIT POINTS ALLOCATION MATRIX
// ============================================================================

/**
 * เกณฑ์การแปลงอันดับจาก Weekly Tournament เป็นคะแนน Circuit Points (CP)
 * สเปก FEATURE-4203:
 * - Rank 1: 100 CP
 * - Rank 2: 60 CP
 * - Rank 3-4: 35 CP
 * - Rank 5-8: 20 CP
 * - Rank 9-16: 5 CP
 * - Rank 17+: 0 CP
 */
export function getCircuitPointsByRank(rank: number): { points: number; source: CircuitPointSource } {
  if (rank === 1) {
    return { points: 100, source: 'weekly_champion' };
  } else if (rank === 2) {
    return { points: 60, source: 'runner_up' };
  } else if (rank <= 4) {
    return { points: 35, source: 'top4' };
  } else if (rank <= 8) {
    return { points: 20, source: 'top8' };
  } else if (rank <= 16) {
    return { points: 5, source: 'swiss' };
  } else {
    // Rank 17+ ไม่ได้รับ Circuit Points
    return { points: 0, source: 'unranked' };
  }
}

// ============================================================================
// 3. ENGINE: AWARDING & EVALUATION
// ============================================================================

/**
 * ประมวลผลแจกแต้ม Circuit Points ให้แก่ผู้เข้าแข่งขัน Weekly
 * รองรับ Idempotency ป้องกันการแจกแต้มซ้ำด้วย Key และ Set ตรวจสอบ
 */
export function processWeeklyCircuitPoints(
  seasonId: string,
  weeklyTournamentId: string,
  placements: WeeklyPlacementInput[],
  processedKeys: Set<string> = new Set<string>()
): { awards: CircuitPointAward[]; skippedCount: number } {
  const awards: CircuitPointAward[] = [];
  let skippedCount = 0;
  const now = new Date().toISOString();

  for (const placement of placements) {
    const idempotencyKey = `${seasonId}_${weeklyTournamentId}_${placement.userId}`;

    // ตรวจสอบ Idempotency เพื่อกันแจกซ้ำ
    if (processedKeys.has(idempotencyKey)) {
      skippedCount++;
      continue;
    }

    const { points, source } = getCircuitPointsByRank(placement.rank);

    awards.push({
      idempotencyKey,
      userId: placement.userId,
      seasonId,
      weeklyTournamentId,
      pointsEarned: points,
      source,
      awardedAt: now,
    });
  }

  return { awards, skippedCount };
}

/**
 * Snapshot คัดเลือก Top 16 ผู้เล่นเข้าสู่ Monthly Championship (Week 4 Final)
 * Tiebreaker 4 ชั้น:
 * 1. Total Circuit Points (มากไปน้อย)
 * 2. Weekly Win Rate (มากไปน้อย)
 * 3. Best Rank (น้อยไปมาก เช่น Rank 1 ชนะ Rank 2)
 * 4. Qualification Timestamp (ใครทำเวลาได้ก่อน ชนะ)
 */
export function evaluateMonthlyQualifiers(
  leaderboard: LeaderboardEntry[]
): MonthlyQualifierCandidate[] {
  const sorted = [...leaderboard].sort((a, b) => {
    // Tier 1: Total Circuit Points
    if (b.totalCircuitPoints !== a.totalCircuitPoints) {
      return b.totalCircuitPoints - a.totalCircuitPoints;
    }

    // Tier 2: Weekly Win Rate
    if (b.weeklyWinRate !== a.weeklyWinRate) {
      return b.weeklyWinRate - a.weeklyWinRate;
    }

    // Tier 3: Best Rank (Lower number is better)
    if (a.bestRank !== b.bestRank) {
      return a.bestRank - b.bestRank;
    }

    // Tier 4: Timestamp (First-to-achieve wins)
    return new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime();
  });

  const evaluationTime = new Date().toISOString();

  // ล็อกสิทธิ์ Top 16 ผู้มีสิทธิ์เข้ารอบ Monthly Qualifier
  return sorted.slice(0, 16).map((player, index) => ({
    userId: player.userId,
    circuitPoints: player.totalCircuitPoints,
    weeklyWinRate: player.weeklyWinRate,
    bestRank: player.bestRank,
    seed: index + 1,
    hasMonthlyPass: true,
    qualifiedAt: evaluationTime,
  }));
}