// Path: lib/performanceCalculator.ts

// ==========================================
// 1. PLAYER FORM MODULE (5-Match History)
// ==========================================

export interface MatchResultInput {
  isWin: boolean;
  matchDifficultyWeight?: number; // default 1.0
}

/**
 * คำนวณคะแนน Form จากผลงาน 5 นัดล่าสุด (Module 02)
 * สเกล: 0.00 (แพ้ 5) ถึง 5.00 (ชนะ 5)
 * ผู้เล่นใหม่: Default 2.80 (AVELAi Baseline)
 */
export function calculatePerformanceScore(recentResults: ('W' | 'L')[]): number {
  if (!recentResults || recentResults.length === 0) {
    return 2.80; // Newbie Default Assignment (Updated from 2.75)
  }

  const last5 = recentResults.slice(-5);
  const winCount = last5.filter((r) => r === 'W').length;

  // แปลงอัตราการชนะ 5 เกมเป็นสเกล 0.00 - 5.00
  const score = (winCount / 5) * 5.0;
  return Number(score.toFixed(2));
}

/**
 * อัปเดตประวัติ 5 นัดล่าสุดเมื่อจบแมตช์
 */
export function appendMatchResult(
  currentResults: ('W' | 'L')[],
  newResult: 'W' | 'L'
): { updatedResults: ('W' | 'L')[]; newScore: number } {
  const updatedResults = [...currentResults, newResult].slice(-5);
  const newScore = calculatePerformanceScore(updatedResults);
  return { updatedResults, newScore };
}

// ==========================================
// 2. AVELAi SCORING & KILL POINT (KP) ENGINE
// ==========================================

export interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  netWorth?: number;
  heroDamage?: number;
}

export type MatchResult = 'WIN' | 'LOSS' | 'DRAW';

export interface PerformanceScoreResult {
  baseKp: number;
  resultMultiplier: number;
  adjustedKp: number;
  matchScore: number;
}

export const SCORING_BASELINE = {
  KDA_BASELINE: 2.80,
  WIN_MULTIPLIER: 1.25,
  LOSS_MULTIPLIER: 0.85,
  DRAW_MULTIPLIER: 1.00,
} as const;

/**
 * คำนวณ Base KP อิงจาก KDA เทียบกับ Baseline 2.80
 */
export function calculateBaseKP(stats: PlayerStats): number {
  const safeDeaths = stats.deaths === 0 ? 1 : stats.deaths;
  const rawKDA = (stats.kills + stats.assists) / safeDeaths;
  
  const kp = ((rawKDA - SCORING_BASELINE.KDA_BASELINE) / SCORING_BASELINE.KDA_BASELINE) * 100;
  return Number(kp.toFixed(2));
}

/**
 * คำนวณ Result Multiplier ตามผลการแข่งขัน
 */
export function getResultMultiplier(result: MatchResult): number {
  switch (result) {
    case 'WIN':
      return SCORING_BASELINE.WIN_MULTIPLIER;
    case 'LOSS':
      return SCORING_BASELINE.LOSS_MULTIPLIER;
    case 'DRAW':
    default:
      return SCORING_BASELINE.DRAW_MULTIPLIER;
  }
}

/**
 * แปลง Adjusted KP ให้เป็นคะแนน Match Score สำหรับสะสมใน Tournament
 */
export function convertToMatchScore(adjustedKp: number): number {
  const baseMatchPoints = 1000;
  const finalScore = baseMatchPoints + (adjustedKp * 10);
  return Math.max(0, Math.round(finalScore));
}

/**
 * ฟังก์ชันหลักคำนวณและสรุปคะแนนแมตช์ (Final Pipeline)
 */
export function computeAndFinalizeMatchScore(
  stats: PlayerStats,
  result: MatchResult
): PerformanceScoreResult {
  const baseKp = calculateBaseKP(stats);
  const resultMultiplier = getResultMultiplier(result);
  
  // ปรับปรุงเงื่อนไข: คูณ Multiplier เฉพาะกรณี Base KP เป็นบวก (> 0)
  const rawAdjustedKp = baseKp > 0 ? baseKp * resultMultiplier : baseKp;
  const adjustedKp = Number(rawAdjustedKp.toFixed(2));
  
  const matchScore = convertToMatchScore(adjustedKp);

  return {
    baseKp,
    resultMultiplier,
    adjustedKp,
    matchScore,
  };
}