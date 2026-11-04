import { FEATURES, FEATURE_DISABLED_MESSAGE } from '@/lib/featureFlags';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSwissPairings, PlayerHistory } from '@/lib/tournament/swissPairing';
import { PARTICIPANT_COLUMNS, participantToPlayerHistory } from '@/lib/tournament/participantRow';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
);

export async function POST(req: Request) {
  if (!FEATURES.legacyApi) {
    return Response.json({ error: FEATURE_DISABLED_MESSAGE }, { status: 503 });
  }
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
      .select(PARTICIPANT_COLUMNS)
      .eq('tournament_id', weeklyTournamentId)
      .eq('has_weekly_pass', true);

    if (participantErr) throw participantErr;
    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { error: 'No players found with weekly pass' },
        { status: 400 }
      );
    }

    // K-AV-POLISH.2 A1: mapping เดียวกับ finalize-top8 (lib/tournament/participantRow.ts)
    const playersForEngine: PlayerHistory[] = participants.map(participantToPlayerHistory);

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
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}