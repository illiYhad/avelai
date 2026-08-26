import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTop8Qualifiers } from '@/lib/tournament/swissPairing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { weeklyTournamentId } = await req.json();

    const { data: players } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', weeklyTournamentId)
      .eq('has_weekly_pass', true);

    if (!players || players.length === 0) {
      return NextResponse.json({ error: 'No players found' }, { status: 400 });
    }

    const top8 = getTop8Qualifiers(players);

    const bracketSlotsPayload = top8.map((player: any, index: number) => ({
      tournament_id: weeklyTournamentId,
      player_id: player.id,
      seed_rank: index + 1,
      slot_type: 'QUARTER_FINAL_SEEDING',
    }));

    const { error } = await supabase.from('bracket_slots').insert(bracketSlotsPayload);
    if (error) throw error;

    return NextResponse.json({ success: true, top8 }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}