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

export function calculateTournamentPayouts(params: PrizeDistributionParams): PayoutResult[] {
  const { tierPrizePoolThb, rankedUserIds } = params;

  const percentageMap: Record<number, number> = {
    1: 0.50,
    2: 0.30,
    3: 0.20,
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