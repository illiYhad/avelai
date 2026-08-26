import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTop8SingleElimination, type SeededPlayer } from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournamentId, qualifiers } = await req.json();

    if (!tournamentId) {
      return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
    }

    let top8Players: SeededPlayer[] = [];

    // 1. ถ้าส่ง qualifiers มาโดยตรง ให้ใช้ชุดนั้น หรือถ้าไม่ส่ง ให้ query Top 8 จาก bracket_slots
    if (qualifiers && Array.isArray(qualifiers) && qualifiers.length === 8) {
      top8Players = qualifiers;
    } else {
      const { data: slots, error: fetchErr } = await supabase
        .from('bracket_slots')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true })
        .limit(8);

      if (fetchErr) throw fetchErr;

      if (!slots || slots.length < 8) {
        return NextResponse.json(
          { error: `Exactly 8 qualifiers required. Found: ${slots?.length || 0}` },
          { status: 400 }
        );
      }

      top8Players = slots.map((s, idx) => ({
        userId: s.player1_id || s.user_id || `player_${idx + 1}`,
        seed: s.seed || idx + 1,
        totalScore: s.total_score || 0,
        formIndex: s.form_index || 0,
      }));
    }

    // 2. เรียก Engine สร้าง Single Elimination Top 8
    const bracketState = createTop8SingleElimination(tournamentId, top8Players);

    // 3. Map Nodes เตรียมลง DB
    const dbPayload = Object.values(bracketState.nodes).map((node) => ({
      slot_id: node.slotId,
      tournament_id: tournamentId,
      round_number: node.roundNumber,
      side: node.side,
      match_index: node.matchIndex,
      player1_id: node.player1 ? node.player1.userId : null,
      player2_id: node.player2 ? node.player2.userId : null,
      winner_id: node.winnerId,
      loser_id: node.loserId,
      status: node.status,
      next_upper_slot_id: node.nextUpperSlotId || null,
      next_lower_slot_id: null,
      is_grand_final_reset: false,
    }));

    // 4. บันทึกลงตาราง bracket_slots
    const { error: upsertErr } = await supabase
      .from('bracket_slots')
      .upsert(dbPayload, { onConflict: 'slot_id,tournament_id' });

    if (upsertErr) throw upsertErr;

    return NextResponse.json(
      {
        success: true,
        message: 'Weekly Top 8 Single Elimination Bracket created successfully.',
        bracket: bracketState,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[/api/v1/tournament/bracket/create-weekly Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}