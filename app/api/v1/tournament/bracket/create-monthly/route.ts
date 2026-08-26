import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createMonthlyDoubleElimination } from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournamentId } = await req.json();

    const { data: top16 } = await supabase
      .from('tournament_participants')
      .select('player_id')
      .eq('tournament_id', tournamentId)
      .eq('has_monthly_pass', true);

    if (!top16 || top16.length !== 16) {
      return NextResponse.json({ error: 'Exactly 16 Monthly Pass holders required.' }, { status: 400 });
    }

    const nodes = createMonthlyDoubleElimination(tournamentId, top16.map(p => p.player_id));
    
    const { error } = await supabase.from('bracket_slots').upsert(nodes);
    if (error) throw error;

    return NextResponse.json({ success: true, nodesCreated: nodes.length }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}