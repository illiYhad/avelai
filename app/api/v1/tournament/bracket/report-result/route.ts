import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { advanceMatchWinner } from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournamentId, slotId, winnerId, isWalkover = false } = await req.json();

    const { data: bracketState } = await supabase
      .from('bracket_slots')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (!bracketState) throw new Error('Bracket not found');

    const updatedState = advanceMatchWinner(bracketState, slotId, winnerId, isWalkover);

    const { error: upsertErr } = await supabase.from('bracket_slots').upsert(updatedState);
    if (upsertErr) throw upsertErr;

    const currentSlot = bracketState.find((s: any) => s.id === slotId);
    if (currentSlot?.type === 'GF_MAIN') {
      const gfResetSlot = updatedState.find((s: any) => s.type === 'GF_RESET' && s.player1_id && s.player2_id);
      if (gfResetSlot) {
        await supabase.from('matches').insert({
          tournament_id: tournamentId,
          bracket_slot_id: gfResetSlot.id,
          player1_id: gfResetSlot.player1_id,
          player2_id: gfResetSlot.player2_id,
          status: 'PENDING'
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}