import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createMonthlyDoubleElimination, type DbBracketSlotRow } from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournamentId } = await req.json();

    if (!tournamentId) {
      return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
    }

    // 1. ดึง Top 16 ผู้ถือ Monthly Pass เรียงตาม Seed (หรือดึงจาก circuit_points/rank)
    const { data: top16, error: fetchError } = await supabase
      .from('tournament_participants')
      .select('player_id, seed, users(display_name)')
      .eq('tournament_id', tournamentId)
      .eq('has_monthly_pass', true)
      .order('seed', { ascending: true });

    if (fetchError) throw fetchError;

    if (!top16 || top16.length !== 16) {
      return NextResponse.json(
        { error: `Exactly 16 Monthly Pass holders required. Found: ${top16?.length || 0}` },
        { status: 400 }
      );
    }

    // 2. แปลงข้อมูลให้อยู่ในรูป DbBracketSlotRow
    const top16Slots: DbBracketSlotRow[] = top16.map((p, index) => ({
      slot_id: `SLOT_SEED_${index + 1}`,
      user_id: p.player_id,
      seed: p.seed ?? index + 1,
      display_name: (p.users as any)?.display_name ?? `Seed #${index + 1}`,
    }));

    // 3. สร้าง Full Double Elimination Bracket (4 WB rounds + 7 LB rounds + Grand Final)
    const nodes = createMonthlyDoubleElimination(tournamentId, top16Slots);

    // 4. Map โครงสร้าง Nodes ให้ตรงกับคอลัมน์ในตาราง bracket_slots
    const dbPayload = nodes.map((node) => ({
      slot_id: node.slotId,
      tournament_id: node.tournamentId,
      round_number: node.roundNumber,
      side: node.side, // 'WINNER' | 'LOSER' | 'GRAND_FINAL'
      match_index: node.matchIndex,
      player1_id: node.player1 ? node.player1.id : null,
      player2_id: node.player2 ? node.player2.id : null,
      winner_id: node.winnerId,
      loser_id: node.loserId,
      status: node.status,
      next_upper_slot_id: node.nextUpperSlotId,
      next_lower_slot_id: node.nextLowerSlotId,
      is_grand_final_reset: node.isGrandFinalReset ?? false,
    }));

    // 5. บันทึก Upsert ลง Supabase
    const { error: upsertError } = await supabase
      .from('bracket_slots')
      .upsert(dbPayload, { onConflict: 'slot_id,tournament_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json(
      {
        success: true,
        message: 'Monthly Double Elimination Bracket created successfully.',
        nodesCreated: dbPayload.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[/api/v1/tournament/bracket/create-monthly Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}