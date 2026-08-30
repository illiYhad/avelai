import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  createMonthlyDoubleElimination, 
  MonthlyQualifierCandidate 
} from '@/lib/tournament/monthlyDoubleElim'; // 👈 ชี้ตรงมาที่ไฟล์นี้โดยตรง

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seasonId, monthlyTournamentId, qualifiedPlayers } = body;

    // 1. Validation
    if (!seasonId || !monthlyTournamentId || !Array.isArray(qualifiedPlayers)) {
      return NextResponse.json(
        { error: 'Missing required parameters: seasonId, monthlyTournamentId, qualifiedPlayers' },
        { status: 400 }
      );
    }

    if (qualifiedPlayers.length !== 16) {
      return NextResponse.json(
        { error: `Expected exactly 16 qualified players, received ${qualifiedPlayers.length}` },
        { status: 400 }
      );
    }

    // 2. Generate Bracket Structure
    const bracketData = createMonthlyDoubleElimination({
      seasonId,
      monthlyTournamentId,
      qualifiedPlayers: qualifiedPlayers as MonthlyQualifierCandidate[],
    });

    // 3. Upsert into Supabase for Idempotency
    const { data, error } = await supabase
      .from('monthly_brackets')
      .upsert(
        {
          season_id: seasonId,
          tournament_id: monthlyTournamentId,
          bracket_type: 'double_elimination',
          winners_bracket: bracketData.winnersTree,
          losers_bracket: bracketData.losersTree,
          grand_final: bracketData.grandFinal,
          status: 'ready',
          created_at: bracketData.createdAt,
        },
        { onConflict: 'season_id,tournament_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bracketId: data.id,
      status: data.status,
      winnersRound1Matches: 8,
      createdAt: data.created_at,
    });
  } catch (err: unknown) {
  const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
  return NextResponse.json({ error: errorMessage }, { status: 500 });
}
}