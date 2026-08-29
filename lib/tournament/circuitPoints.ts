// ============================================================================
// 1. TYPE DEFINITIONS & INTERFACES
// ============================================================================

export type CircuitPointSource =
  | 'weekly_champion'
  | 'runner_up'
  | 'top4'
  | 'top8'
  | 'swiss';

export interface WeeklyPlacementInput {
  userId: string;
  rank: number;
  swissWins: number;
  swissWinRate: number; // สำหรับ Tiebreaker กรณี CP เท่ากัน
  totalScore: number;
}

export interface CircuitPointAward {
  userId: string;
  seasonId: string;
  weeklyTournamentId: string;
  pointsEarned: number;
  source: CircuitPointSource;
  awardedAt: string;
}

export interface MonthlyQualifiedPlayer {
  userId: string;
  circuitPoints: number;
  weeklyWinRate: number;
  seed: number;
  hasMonthlyPass: boolean;
}

// ============================================================================
// 2. CIRCUIT POINTS ALLOCATION MATRIX
// ============================================================================

/**
 * เกณฑ์การแปลงอันดับจาก Weekly Tournament เป็นคะแนน Circuit Points (CP)
 * อ้างอิงตามเอกสารสเปก FEATURE-4300 / Circuit Phase
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
  } else {
    // ผู้เข้าร่วมรอบ Swiss Phase ที่ไม่ติด Top 8
    return { points: 5, source: 'swiss' };
  }
}

// ============================================================================
// 3. ENGINE: AWARDING & EVALUATION
// ============================================================================

/**
 * ประมวลผลแจกแต้ม Circuit Points ให้แก่ผู้เข้าแข่งขัน Weekly ทุกคน
 */
export function processWeeklyCircuitPoints(
  seasonId: string,
  weeklyTournamentId: string,
  placements: WeeklyPlacementInput[]
): CircuitPointAward[] {
  return placements.map((placement) => {
    const { points, source } = getCircuitPointsByRank(placement.rank);
    return {
      userId: placement.userId,
      seasonId,
      weeklyTournamentId,
      pointsEarned: points,
      source,
      awardedAt: new Date().toISOString(),
    };
  });
}

/**
 * Snapshot คัดเลือก Top 16 ผู้เล่นเข้าสู่ Monthly Championship (Week 4 Final)
 * ใช้คะแนน Circuit Points สะสมเป็นเกณฑ์หลัก และใช้ Weekly Win Rate เป็น Tiebreaker
 */
export function evaluateMonthlyQualifiers(
  leaderboard: Array<{
    userId: string;
    totalCircuitPoints: number;
    weeklyWinRate: number;
  }>
): MonthlyQualifiedPlayer[] {
  // เรียงลำดับ: CP สะสม (มากไปน้อย) -> Tiebreaker ด้วย Win Rate รวม
  const sorted = [...leaderboard].sort((a, b) => {
    if (b.totalCircuitPoints !== a.totalCircuitPoints) {
      return b.totalCircuitPoints - a.totalCircuitPoints;
    }
    return b.weeklyWinRate - a.weeklyWinRate;
  });

  // ล็อกสิทธิ์ Top 16 เพื่อแจกจ่าย Monthly Pass สู่ Double Elimination
  return sorted.slice(0, 16).map((player, index) => ({
    userId: player.userId,
    circuitPoints: player.totalCircuitPoints,
    weeklyWinRate: player.weeklyWinRate,
    seed: index + 1,
    hasMonthlyPass: true,
  }));
}