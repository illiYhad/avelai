import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSwissPairings, PlayerHistory } from '@/lib/tournament/swissPairing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { weeklyTournamentId, roundNumber } = await req.json();

    if (!weeklyTournamentId || typeof roundNumber !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { data: existingRound } = await supabase
      .from('swiss_pairings')
      .select('id')
      .eq('tournament_id', weeklyTournamentId)
      .eq('round_number', roundNumber)
      .limit(1);

    if (existingRound && existingRound.length > 0) {
      return NextResponse.json(
        { error: `Round ${roundNumber} already generated.` },
        { status: 409 }
      );
    }

    const { data: participants, error: participantErr } = await supabase
      .from('tournament_participants')
      .select('player_id, score, has_received_bye, previous_opponent_ids')
      .eq('tournament_id', weeklyTournamentId)
      .eq('has_weekly_pass', true);

    if (participantErr) throw participantErr;
    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { error: 'No players found with weekly pass' },
        { status: 400 }
      );
    }

    const playersForEngine: PlayerHistory[] = participants.map((p: any) => ({
      userId: String(p.player_id || p.userId || p.id),
      hasWeeklyPass: true,
      score: typeof p.score === 'number' ? p.score : 0,
      hasReceivedBye: Boolean(p.has_received_bye ?? p.hasReceivedBye ?? false),
      opponentsFaced: Array.isArray(p.previous_opponent_ids)
        ? p.previous_opponent_ids
        : Array.isArray(p.opponentsFaced)
          ? p.opponentsFaced
          : [],
    }));

    const pairings = generateSwissPairings(playersForEngine, roundNumber);

    const insertPayload = pairings.map((pair) => ({
      tournament_id: weeklyTournamentId,
      round_number: roundNumber,
      player1_id: pair.player1Id,
      player2_id: pair.player2Id || null,
      is_bye: pair.isBye,
      created_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase
      .from('swiss_pairings')
      .insert(insertPayload);

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, pairings }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}