import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CashoutPayload {
  userId: string;
  amountThb: number;
  promptpayNumber: string;
  accountName: string;
  idempotencyKey: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CashoutPayload = await req.json();
    const { userId, amountThb, promptpayNumber, accountName, idempotencyKey } = body;

    // 1. ตรวจสอบ Payload
    if (!userId || !amountThb || amountThb <= 0 || !promptpayNumber || !accountName || !idempotencyKey) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลคำขอถอนเงินไม่ถูกต้องหรือระบุไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // 2. Idempotency Check ป้องกันการกดยื่นซ้ำ
    const { data: existingReq, error: checkErr } = await supabase
      .from('cashout_requests')
      .select('request_id, status, created_at')
      .eq('request_id', idempotencyKey)
      .maybeSingle();

    if (checkErr) {
      return NextResponse.json({ success: false, error: 'ตรวจสอบคำขอล้มเหลว' }, { status: 500 });
    }

    if (existingReq) {
      return NextResponse.json({
        success: true,
        message: 'คำขอถอนเงินนี้ได้รับการบันทึกไปแล้ว (Idempotent)',
        request_id: existingReq.request_id,
        status: existingReq.status,
      }, { status: 200 });
    }

    // 3. ตรวจสอบสถานะกระเป๋าเงินและ KYC Gate
    const { data: wallet, error: walletErr } = await supabase
      .from('user_token_wallets')
      .select('wallet_id, balance, kyc_status')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) {
      return NextResponse.json({ success: false, error: 'ไม่พบกระเป๋าเงินของผู้ใช้' }, { status: 404 });
    }

    // กฎ KYC Gate: ต้องผ่านการยืนยันตัวตนก่อนถอนเงินสด
    if (wallet.kyc_status !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถถอนเงินได้: ต้องผ่านการยืนยันตัวตน (KYC Gate) ก่อนทำการถอนเงินครั้งแรก' },
        { status: 403 }
      );
    }

    // ตรวจสอบยอดเงินคงเหลือ
    if (Number(wallet.balance) < amountThb) {
      return NextResponse.json(
        { success: false, error: 'ยอดเงินคงเหลือไม่เพียงพอสำหรับการถอน' },
        { status: 400 }
      );
    }

    // 4. หักยอด Balance ในกระเป๋าเงินทันที
    const newBalance = Number(wallet.balance) - amountThb;
    const { error: updateWalletErr } = await supabase
      .from('user_token_wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateWalletErr) {
      return NextResponse.json({ success: false, error: 'ตัดยอดเงินไม่สำเร็จ' }, { status: 500 });
    }

    // 5. บันทึกคำขอเข้า cashout_requests
    const { data: newCashout, error: insertCashoutErr } = await supabase
      .from('cashout_requests')
      .insert({
        request_id: idempotencyKey,
        user_id: userId,
        amount_reward_points: amountThb, // อัตรา 1:1 หรือแปลงตามโทเคน
        amount_thb: amountThb,
        promptpay_number: promptpayNumber,
        account_name: accountName,
        status: 'PENDING',
      })
      .select('request_id, created_at')
      .single();

    if (insertCashoutErr) {
      // Rollback ยอดเงินกรณีเกิดข้อผิดพลาด
      await supabase.from('user_token_wallets').update({ balance: wallet.balance }).eq('user_id', userId);
      return NextResponse.json({ success: false, error: 'บันทึกคำขอถอนเงินล้มเหลว' }, { status: 500 });
    }

    // 6. บันทึก Ledger ใน token_transactions
    await supabase.from('token_transactions').insert({
      user_id: userId,
      amount: -amountThb,
      transaction_type: 'CASHOUT_PROMPTPAY',
      status: 'PENDING',
      reference_id: newCashout.request_id,
      idempotency_key: idempotencyKey,
      metadata: { promptpay_number: promptpayNumber, account_name: accountName },
    });

    return NextResponse.json({
      success: true,
      message: 'ส่งคำขอถอนเงินสำเร็จ ระบบจะดำเนินการโอนเงินแบบ Batch รอบ 15:00 น. ทุกวันทำการ',
      request_id: newCashout.request_id,
      remaining_balance: newBalance,
      batch_cycle: '15:00 น.',
    }, { status: 201 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}