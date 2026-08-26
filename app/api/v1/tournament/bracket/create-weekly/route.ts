import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTop8SingleElimination } from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournamentId } = await req.json();

    const { data: top8Slots } = await supabase
      .from('bracket_slots')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('slot_type', 'QUARTER_FINAL_SEEDING')
      .order('seed_rank', { ascending: true });

    if (!top8Slots || top8Slots.length !== 8) {
      return NextResponse.json({ error: 'Top 8 seeds not properly generated.' }, { status: 400 });
    }

    const nodes = createTop8SingleElimination(tournamentId, top8Slots);

    const { error: insertNodesErr } = await supabase.from('bracket_slots').upsert(nodes);
    if (insertNodesErr) throw insertNodesErr;

    const round1Nodes = nodes.filter((n: any) => n.round === 1);
    const matchesPayload = round1Nodes.map((n: any) => ({
      tournament_id: tournamentId,
      bracket_slot_id: n.id,
      player1_id: n.player1_id,
      player2_id: n.player2_id,
      status: 'PENDING'
    }));

    await supabase.from('matches').insert(matchesPayload);

    return NextResponse.json({ success: true, nodesCreated: nodes.length }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}