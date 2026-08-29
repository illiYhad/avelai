// Path: lib/tournament/prizeCalculator.ts

export interface PrizeDistributionParams {
  tier?: string;
  tierPrizePoolThb: number;
  rankedUserIds: string[];
}

export interface PayoutResult {
  userId: string;
  rank: number;
  amount: number;
  payoutAmount: number;
}

/**
 * คำนวณส่วนแบ่งรางวัลตาม AVELAi Tiered Prize Matrix:
 * - Rank 1 (Champion): 40% (1 คน)
 * - Rank 2 (Runner-up): 25% (1 คน)
 * - Rank 3 - 4 (Top 4): 20% แบ่งเท่ากันคนละ 10% (0.10)
 * - Rank 5 - 8 (Top 8): 15% แบ่งเท่ากันคนละ 3.75% (0.0375)
 */
export function calculateTournamentPayouts(params: PrizeDistributionParams): PayoutResult[] {
  const { tierPrizePoolThb, rankedUserIds } = params;

  // กำหนดสัดส่วนเงินรางวัลตามลำดับ Rank จริงของแต่ละบุคคล
  const percentageMap: Record<number, number> = {
    1: 0.40,   // 40%
    2: 0.25,   // 25%
    3: 0.10,   // 20% / 2
    4: 0.10,   // 20% / 2
    5: 0.0375, // 15% / 4
    6: 0.0375, // 15% / 4
    7: 0.0375, // 15% / 4
    8: 0.0375, // 15% / 4
  };

  return (rankedUserIds || []).map((userId, index) => {
    const rank = index + 1;
    const share = percentageMap[rank] || 0;
    const calculatedAmount = Number((tierPrizePoolThb * share).toFixed(2));

    return {
      userId,
      rank,
      amount: calculatedAmount,
      payoutAmount: calculatedAmount,
    };
  });
}