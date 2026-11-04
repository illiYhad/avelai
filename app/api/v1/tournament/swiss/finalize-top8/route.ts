import { FEATURES, FEATURE_DISABLED_MESSAGE } from '@/lib/featureFlags';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTop8Qualifiers } from '@/lib/tournament/swissPairing';
import { PARTICIPANT_COLUMNS, participantToPlayerHistory, type ParticipantRow } from '@/lib/tournament/participantRow';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
);

export async function POST(req: Request) {
  if (!FEATURES.legacyApi) {
    return Response.json({ error: FEATURE_DISABLED_MESSAGE }, { status: 503 });
  }
  try {
    const { weeklyTournamentId } = await req.json();

    const { data: players } = await supabase
      .from('tournament_participants')
      .select(PARTICIPANT_COLUMNS)
      .eq('tournament_id', weeklyTournamentId)
      .eq('has_weekly_pass', true);

    if (!players || players.length === 0) {
      return NextResponse.json({ error: 'No players found' }, { status: 400 });
    }

    // K-AV-POLISH.2 A1: แปลงแถว DB → PlayerHistory ก่อนเข้าเอนจิน (เดิมส่งแถวดิบ → userId undefined · reduce พัง)
    const top8 = getTop8Qualifiers((players as ParticipantRow[]).map(participantToPlayerHistory));

    const bracketSlotsPayload = top8.map((player, index) => ({
      tournament_id: weeklyTournamentId,
      player_id: player.userId,
      seed_rank: index + 1,
      slot_type: 'QUARTER_FINAL_SEEDING',
    }));

    const { error } = await supabase.from('bracket_slots').insert(bracketSlotsPayload);
    if (error) throw error;

    return NextResponse.json({ success: true, top8 }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}