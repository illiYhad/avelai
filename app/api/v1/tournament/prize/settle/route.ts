import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RankedParticipant {
  userId: string;
  rank: number;
  calculatedAmountThb: number;
}

export interface PrizeSettlePayload {
  tournamentId: string;
  tier: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'SEASON_FINALE' | 'MERCENARY';
  idempotencyKey: string;
  rankedParticipants: RankedParticipant[];
}

export interface UserTokenWallet {
  wallet_id: string;
  balance: number;
  locked_balance?: number;
  kyc_status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'UNVERIFIED';
}

export async function POST(req: NextRequest) {
  try {
    const body: PrizeSettlePayload = await req.json();
    const { tournamentId, tier, idempotencyKey, rankedParticipants } = body;

    // 1. ตรวจสอบความสมบูรณ์ของ Payload
    if (!tournamentId || !tier || !idempotencyKey || !Array.isArray(rankedParticipants) || rankedParticipants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน: ต้องระบุ tournamentId, tier, idempotencyKey และ rankedParticipants' },
        { status: 400 }
      );
    }

    // 2. Idempotency Guard: ตรวจสอบว่าเคยจ่ายรางวัลด้วย Key นี้แล้วหรือยัง
    const { data: existingPayout, error: checkError } = await supabase
      .from('prize_payouts')
      .select('payout_id, tournament_id, created_at')
      .eq('idempotency_key', idempotencyKey)
      .limit(1);

    if (checkError) {
      console.error('[/api/v1/tournament/prize/settle Check Error]:', checkError);
      return NextResponse.json({ success: false, error: 'ตรวจสอบประวัติธุรกรรมล้มเหลว' }, { status: 500 });
    }

    if (existingPayout && existingPayout.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'รายการนี้ได้รับการประมวลผลไปแล้ว (Idempotent Response)',
        idempotencyKey,
        settled_at: existingPayout[0].created_at,
      }, { status: 200 });
    }

    const payoutRecords = [];
    const transactionRecords = [];

    // 3. ประมวลผลแจกจ่ายยอดเงินรางวัลเข้ากระเป๋าแต่ละคน
    for (const p of rankedParticipants) {
      if (p.calculatedAmountThb <= 0) continue;

      // 3.1 ดึง Wallet เดิมของผู้เล่น (รวม locked_balance)
      const { data: walletData, error: walletFetchError } = await supabase
        .from('user_token_wallets')
        .select('wallet_id, balance, locked_balance, kyc_status')
        .eq('user_id', p.userId)
        .maybeSingle();

      if (walletFetchError) {
        console.error(`Fetch wallet error for user ${p.userId}:`, walletFetchError);
        continue;
      }

      const wallet = walletData as UserTokenWallet | null;
      const payoutStatus = wallet?.kyc_status === 'APPROVED' ? 'COMPLETED' : 'PENDING_KYC';
      const userUniqueIdempKey = `${idempotencyKey}_${p.userId}`;

      // 3.2 ข้อมูลบันทึก prize_payouts
      payoutRecords.push({
        tournament_id: tournamentId,
        user_id: p.userId,
        tier,
        rank: p.rank,
        calculated_amount: p.calculatedAmountThb,
        payout_amount: p.calculatedAmountThb,
        status: payoutStatus,
        idempotency_key: userUniqueIdempKey,
      });

      // 3.3 ข้อมูลบันทึก token_transactions
      transactionRecords.push({
        user_id: p.userId,
        amount: p.calculatedAmountThb,
        transaction_type: 'PRIZE_PAYOUT',
        status: payoutStatus === 'COMPLETED' ? 'SUCCESS' : 'PENDING_KYC',
        reference_id: tournamentId,
        idempotency_key: userUniqueIdempKey,
        metadata: { tier, rank: p.rank, tournament_id: tournamentId },
      });

      // 3.4 อัปเดตหรือสร้างกระเป๋าเงิน
      if (wallet) {
        const updateField = payoutStatus === 'COMPLETED'
          ? { balance: Number(wallet.balance) + p.calculatedAmountThb }
          : { locked_balance: Number(wallet.locked_balance || 0) + p.calculatedAmountThb };

        await supabase
          .from('user_token_wallets')
          .update(updateField)
          .eq('user_id', p.userId);
      } else {
        await supabase
          .from('user_token_wallets')
          .insert({
            user_id: p.userId,
            balance: payoutStatus === 'COMPLETED' ? p.calculatedAmountThb : 0.00,
            locked_balance: payoutStatus === 'PENDING_KYC' ? p.calculatedAmountThb : 0.00,
            currency: 'THB',
          });
      }
    }

    // 4. บันทึกแบบ Batch
    if (payoutRecords.length > 0) {
      await supabase.from('prize_payouts').insert(payoutRecords);
      await supabase.from('token_transactions').insert(transactionRecords);
    }

    return NextResponse.json({
      success: true,
      message: `ประมวลผลแจกจ่ายรางวัลสำหรับทัวร์นาเมนต์ ${tournamentId} เรียบร้อยแล้ว`,
      total_payouts: payoutRecords.length,
      settled_at: new Date().toISOString(),
    }, { status: 201 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[/api/v1/tournament/prize/settle Fatal Error]:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}