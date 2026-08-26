import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { advanceWinner } from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tournamentId = String(body.tournamentId);
    const slotId = String(body.slotId);
    const winnerId = String(body.winnerId);

    const { data: bracketState, error: fetchErr } = await supabase
      .from('bracket_slots')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (fetchErr || !bracketState) {
      return NextResponse.json({ error: 'Bracket not found' }, { status: 404 });
    }

    const updatedState = advanceWinner(bracketState as any, slotId, winnerId);

    const allMatches = (updatedState as any)?.rounds?.flat() ?? [];

    const { error: upsertErr } = await supabase
      .from('bracket_slots')
      .upsert(allMatches.length > 0 ? allMatches : (updatedState as any));

    if (upsertErr) throw upsertErr;

    const currentSlot = (bracketState as any[]).find((s: any) => s.id === slotId);
    if (currentSlot?.type === 'GF_MAIN') {
      const gfResetSlot = allMatches.find((s: any) => s.type === 'GF_RESET' && Boolean(s.player1_id));
      if (gfResetSlot) {
        await supabase.from('matches').insert({
          tournament_id: tournamentId,
          bracket_slot_id: gfResetSlot.id,
          player1_id: gfResetSlot.player1_id,
        });
      }
    }

    return NextResponse.json({ success: true, bracket: updatedState }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}