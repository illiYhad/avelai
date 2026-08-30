import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ⚠️ SECURITY FIX: ค่า Token ถูกกำหนดตายตัวจากฝั่ง Server เท่านั้น
// ห้ามรับค่า tokenAmount จาก Client เด็ดขาด (ป้องกันการปลอมแปลงตัวเลข)
const FIXED_ENTRY_FEE_TOKENS = 1.0;
const FIXED_ENTRY_FEE_THB = 9.0;
const MAX_SEATS = 10;
const POT_SIZE_THB = 90.0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body; // ไม่รับ tokenAmount / payWith จาก client อีกต่อไป

    if (!userId) {
      return NextResponse.json(
        { error: 'MISSING_USER_ID', message: 'ต้องระบุ userId' },
        { status: 400 }
      );
    }

    // Service Role client — ใช้ฝั่ง server เท่านั้น (ตาม system rule)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. ตรวจสอบยอด Token คงเหลือ (ต้องมีอย่างน้อย 1 Token)
    const { data: wallet, error: walletError } = await supabase
      .from('user_token_wallets')
      .select('token_balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet || wallet.token_balance < FIXED_ENTRY_FEE_TOKENS) {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_TOKEN_BALANCE',
          message: `ต้องการ ${FIXED_ENTRY_FEE_TOKENS} Token (${FIXED_ENTRY_FEE_THB}฿) ในการเข้าคิว`,
        },
        { status: 400 }
      );
    }

    // 2. หาห้องที่ยังรอผู้เล่น (status = WAITING และยังไม่เต็ม)
    const { data: openLobby } = await supabase
      .from('mercenary_lobbies')
      .select('id, room_code, current_players')
      .eq('status', 'WAITING')
      .lt('current_players', MAX_SEATS)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let lobbyId: string;
    let roomCode: string;
    let assignedSlot: number;

    if (!openLobby) {
      // 2a. ไม่มีห้องว่าง → สร้างห้องใหม่
      roomCode = `MERC-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: newLobby, error: createError } = await supabase
        .from('mercenary_lobbies')
        .insert({
          room_code: roomCode,
          entry_fee_tokens: FIXED_ENTRY_FEE_TOKENS,
          entry_fee_thb: FIXED_ENTRY_FEE_THB,
          max_players: MAX_SEATS,
          current_players: 1,
          total_pot_thb: POT_SIZE_THB,
          status: 'WAITING',
        })
        .select('id, room_code')
        .single();

      if (createError || !newLobby) {
        return NextResponse.json(
          { error: 'LOBBY_CREATE_FAILED', message: createError?.message },
          { status: 500 }
        );
      }
      lobbyId = newLobby.id;
      roomCode = newLobby.room_code;
      assignedSlot = 1;
    } else {
      // 2b. มีห้องว่าง → เข้าร่วมและอัปเดตจำนวนที่นั่ง
      lobbyId = openLobby.id;
      roomCode = openLobby.room_code;
      assignedSlot = openLobby.current_players + 1;

      const { error: updateError } = await supabase
        .from('mercenary_lobbies')
        .update({
          current_players: assignedSlot,
          status: assignedSlot === MAX_SEATS ? 'IN_PROGRESS' : 'WAITING',
        })
        .eq('id', lobbyId);

      if (updateError) {
        return NextResponse.json(
          { error: 'LOBBY_UPDATE_FAILED', message: updateError.message },
          { status: 500 }
        );
      }
    }

    // 3. บันทึกผู้เล่นเข้าห้อง
    const { error: participantError } = await supabase
      .from('mercenary_participants')
      .insert({
        lobby_id: lobbyId,
        user_id: userId,
        assigned_slot: assignedSlot,
      });

    if (participantError) {
      return NextResponse.json(
        { error: 'JOIN_FAILED', message: participantError.message },
        { status: 500 }
      );
    }

    // 4. หัก Token ตายตัว 1 Token (ไม่อิงค่าจาก client) + บันทึก transaction log
    const { data: updatedWallet, error: deductError } = await supabase
      .from('user_token_wallets')
      .update({ token_balance: wallet.token_balance - FIXED_ENTRY_FEE_TOKENS })
      .eq('user_id', userId)
      .select('token_balance')
      .single();

    if (deductError) {
      return NextResponse.json(
        { error: 'DEDUCT_FAILED', message: deductError.message },
        { status: 500 }
      );
    }

    await supabase.from('token_transactions').insert({
      user_id: userId,
      transaction_type: 'LOBBY_BUY_IN',
      amount_tokens: -FIXED_ENTRY_FEE_TOKENS,
      amount_thb: -FIXED_ENTRY_FEE_THB,
      reference_id: lobbyId,
    });

    // 5. แจ้งเตือนแบบเรียลไทม์ผ่าน Supabase Realtime
    // (ฝั่ง client subscribe ที่ channel 'mercenary_lobbies' filter โดย lobby_id นี้)
    // ไม่ต้องเรียก io.emit() แบบ Socket.io — ใช้ Supabase Realtime broadcast อัตโนมัติจาก UPDATE ด้านบน

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully joined mercenary lobby',
        data: {
          userId,
          lobbyId,
          roomCode,
          assignedSlot,
          maxSeats: MAX_SEATS,
          potThb: POT_SIZE_THB,
          remainingTokenBalance: updatedWallet.token_balance,
          status: assignedSlot === MAX_SEATS ? 'IN_PROGRESS' : 'WAITING',
        },
      },
      { status: 200 }
    );
 //  แบบมาตรฐาน:
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
}
}