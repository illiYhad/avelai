// app/api/v1/daily/settle-winner/route.ts
//
// จุดประสงค์: เมื่อผู้เล่นชนะ Daily Arena อันดับ 1
// -> ล็อกสิทธิ์ Daily Arena (กัน Smurf)
// -> แปลงตั๋วที่เหลือของสัปดาห์เป็น Token อัตโนมัติ (1 ตั๋ว = 1 Token = 9.00 บาท)
// -> ให้ Weekly Pass
//
// หมายเหตุ: แปลงจากไฟล์ Backend Controller (Express) เดิม ให้ทำงานผ่าน
// Supabase Edge Function / Next.js Route Handler แทน เพื่อให้ตรงกับสถาปัตยกรรมจริงของโปรเจกต์
// (ตัดการพึ่งพา Express + node-postgres Pool ออกทั้งหมด)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TOKEN_VALUE_THB = 9.0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, seasonId } = body;

    if (!userId || !seasonId) {
      return NextResponse.json(
        { error: 'MISSING_PARAMS', message: 'ต้องระบุ userId และ seasonId' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // เรียก Postgres Function เดียวกับที่ออกแบบไว้เดิม (execute_daily_auto_buyback)
    // ย้ายมาเรียกผ่าน Supabase RPC แทนการต่อ pg Pool ตรง ๆ
    const { data: result, error: rpcError } = await supabase.rpc(
      'execute_daily_auto_buyback',
      {
        p_user_id: userId,
        p_season_id: seasonId,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        { error: 'SETTLEMENT_FAILED', message: rpcError.message },
        { status: 500 }
      );
    }

    const row = result?.[0] ?? result;

    // ดึงยอด Token ล่าสุดหลังการซื้อคืน (จากตารางที่ตรง SPEC_FEATURE-4160)
    const { data: wallet, error: walletError } = await supabase
      .from('user_token_wallets')
      .select('token_balance')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      return NextResponse.json(
        { error: 'WALLET_FETCH_FAILED', message: walletError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          userId,
          isLocked: row.is_locked,
          lockoutReason: 'QUALIFIED_DAILY_WINNER',
          weeklyPassGranted: row.weekly_pass_granted,
          autoBuyback: {
            refundedTicketsCount: row.refunded_tokens,
            tokensCredited: row.refunded_tokens,
            thbValue: row.refunded_tokens * TOKEN_VALUE_THB,
            newTokenBalance: wallet.token_balance,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}