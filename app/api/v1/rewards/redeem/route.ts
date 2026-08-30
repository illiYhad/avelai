import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RedeemPayload {
  itemId: string;
  costPoints: number;
  idempotencyKey: string;
}

/**
 * API Route Handler: Atomic Reward Redemption & Token Ledger Logging
 * Tables affected: user_token_wallets, token_transactions, user_inventory
 */
export async function POST(req: NextRequest) {
  try {
    const body: RedeemPayload = await req.json();
    const { itemId, costPoints, idempotencyKey } = body;

    // TODO: ดึง user_id จาก authenticated session (auth.uid())
    const userId = '00000000-0000-0000-0000-000000000001'; // Simulated authenticated user ID

    if (!itemId || !costPoints || costPoints <= 0 || !idempotencyKey) {
      return NextResponse.json(
        { success: false, error: 'พารามิเตอร์ไม่ถูกต้องหรือข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // 1. Idempotency Check: ป้องกันการหักแต้มซ้ำซ้อน
    const { data: existingTx, error: txCheckErr } = await supabase
      .from('token_transactions')
      .select('transaction_id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (txCheckErr) {
      return NextResponse.json({ success: false, error: 'Database check failed' }, { status: 500 });
    }

    if (existingTx) {
      return NextResponse.json({
        success: true,
        message: 'รายการนี้ได้รับการดำเนินการไปแล้ว (Idempotent execution)',
        transaction_id: existingTx.transaction_id,
      });
    }

    // 2. ตรวจสอบยอดคงเหลือใน user_token_wallets
    const { data: wallet, error: walletErr } = await supabase
      .from('user_token_wallets')
      .select('wallet_id, balance')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) {
      return NextResponse.json({ success: false, error: 'ไม่พบกระเป๋าเงินของผู้ใช้' }, { status: 404 });
    }

    if (Number(wallet.balance) < costPoints) {
      return NextResponse.json(
        { success: false, error: 'ยอด Reward Points คงเหลือไม่เพียงพอ' },
        { status: 400 }
      );
    }

    const updatedBalance = Number(wallet.balance) - costPoints;

    // 3. ปรับลดยอดแต้มใน Wallet
    const { error: walletUpdateErr } = await supabase
      .from('user_token_wallets')
      .update({ balance: updatedBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (walletUpdateErr) {
      return NextResponse.json({ success: false, error: 'ไม่สามารถอัปเดตยอดคงเหลือได้' }, { status: 500 });
    }

    // 4. บันทึกประวัติธุรกรรม (Ledger Entry)
    await supabase.from('token_transactions').insert({
      user_id: userId,
      amount: -costPoints,
      transaction_type: 'REWARD_REDEEM',
      status: 'SUCCESS',
      reference_id: itemId,
      idempotency_key: idempotencyKey,
      metadata: { item_id: itemId, cost: costPoints },
      created_at: new Date().toISOString(),
    });

    // 5. ส่งมอบไอเทมเข้า user_inventory
    await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: itemId,
      quantity: 1,
      source: 'REWARD_REDEEM',
      granted_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'แลกรับรางวัลสำเร็จ',
      item_id: itemId,
      new_balance: updatedBalance,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}