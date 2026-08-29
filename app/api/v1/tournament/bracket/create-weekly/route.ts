import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTop8SingleElimination, type DbBracketSlotRow } from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournamentId } = await req.json();

    if (!tournamentId) {
      return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
    }

    // 1. ดึงข้อมูล Top 8 จาก bracket_slots หรือ tournament_participants
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

    const top8Slots: DbBracketSlotRow[] = slots.map((s, idx) => ({
      slot_id: s.slot_id || `SLOT_SEED_${idx + 1}`,
      user_id: s.player1_id || s.user_id || `player_${idx + 1}`,
      seed: s.seed || idx + 1,
      display_name: s.display_name ?? `Seed #${s.seed || idx + 1}`,
    }));

    // 2. เรียก Engine สร้าง Single Elimination Top 8 (ได้ DbBracketNode[] พร้อมบันทึก)
    const nodes = createTop8SingleElimination(tournamentId, top8Slots);

    // 3. บันทึกลงตาราง bracket_slots
    const { error: upsertErr } = await supabase
      .from('bracket_slots')
      .upsert(nodes, { onConflict: 'slot_id,tournament_id' });

    if (upsertErr) throw upsertErr;

    return NextResponse.json(
      {
        success: true,
        message: 'Weekly Top 8 Single Elimination Bracket created successfully.',
        nodesCreated: nodes.length,
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