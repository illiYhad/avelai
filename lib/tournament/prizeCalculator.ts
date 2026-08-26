export interface PrizeDistributionParams {
  totalPrizePool: number;
  rankings: { userId: string; rank: number }[];
}

export interface PayoutResult {
  userId: string;
  rank: number;
  payoutAmount: number;
}

export function calculateTournamentPayouts(params: PrizeDistributionParams): PayoutResult[] {
  const { totalPrizePool, rankings } = params;
  
  const percentageMap: Record<number, number> = {
    1: 0.50,
    2: 0.30,
    3: 0.20
  };

  return (rankings || []).map((player) => {
    const share = percentageMap[player.rank] || 0;
    return {
      userId: player.userId,
      rank: player.rank,
      payoutAmount: Number((totalPrizePool * share).toFixed(2))
    };
  });
}