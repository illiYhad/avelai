import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateTournamentPayouts } from '@/lib/tournament/prizeCalculator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournamentId, tier, tierPrizePoolThb, rankedUserIds, idempotencyKey } = await req.json();

    const { data: existingPayout } = await supabase
      .from('prize_payouts')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .limit(1);

    if (existingPayout && existingPayout.length > 0) {
      return NextResponse.json({ message: 'Payout already processed for this key' }, { status: 200 });
    }

    const distributions = calculateTournamentPayouts({ tier, tierPrizePoolThb, rankedUserIds });

    const { data: usersData } = await supabase
      .from('users')
      .select('id, kyc_status')
      .in('id', rankedUserIds);

    const payoutsToInsert = distributions.map((dist: any) => {
      const user = usersData?.find((u) => u.id === dist.userId);
      const isCash = dist.currency === 'THB';
      const kycPassed = user?.kyc_status === 'VERIFIED';
      
      return {
        tournament_id: tournamentId,
        user_id: dist.userId,
        amount: dist.amount,
        currency: dist.currency,
        status: isCash && !kycPassed ? 'PENDING_KYC' : 'APPROVED',
        idempotency_key: idempotencyKey,
      };
    });

    const { error: payoutErr } = await supabase.from('prize_payouts').insert(payoutsToInsert);
    if (payoutErr) throw payoutErr;

    const tokenDistributions = distributions.filter((d: any) => d.currency === 'TOKEN');
    for (const tokenPayout of tokenDistributions) {
      await supabase.rpc('increment_token_wallet', { 
        x_user_id: tokenPayout.userId, 
        x_amount: tokenPayout.amount 
      });

      await supabase.from('token_transactions').insert({
        user_id: tokenPayout.userId,
        amount: tokenPayout.amount,
        type: 'TOURNAMENT_PRIZE',
        reference_id: idempotencyKey
      });
    }

    return NextResponse.json({ success: true, processedCount: distributions.length }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}