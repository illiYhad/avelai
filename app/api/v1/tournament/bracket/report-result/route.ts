import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  advanceWinner,
  advanceDoubleEliminationWinner,
  type DoubleEliminationBracket,
  type DEMatch,
  type Bracket,
  type Match,
  type BracketSide,
} from '@/lib/tournament/bracketEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseBracketSide(rawSide: string | null | undefined, slotId: string): BracketSide {
  if (rawSide === 'WINNER' || rawSide === 'LOSER' || rawSide === 'GRAND_FINAL') {
    return rawSide;
  }
  if (slotId.startsWith('WB_')) return 'WINNER';
  if (slotId.startsWith('LB_')) return 'LOSER';
  return 'GRAND_FINAL';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tournamentId = String(body.tournamentId);
    const slotId = String(body.slotId);
    const winnerId = String(body.winnerId);

    if (!tournamentId || !slotId || !winnerId) {
      return NextResponse.json(
        { error: 'Missing required parameters: tournamentId, slotId, winnerId' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูล slots ทั้งหมดของทัวร์นาเมนต์นี้จาก Supabase
    const { data: dbSlots, error: fetchErr } = await supabase
      .from('bracket_slots')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (fetchErr || !dbSlots || dbSlots.length === 0) {
      return NextResponse.json({ error: 'Bracket slots not found for this tournament' }, { status: 404 });
    }

    // 2. ตรวจสอบว่าเป็น Single หรือ Double Elimination
    const isDoubleElimination = dbSlots.some(
      (s) => s.side === 'WINNER' || s.side === 'LOSER' || s.slot_id.startsWith('WB_') || s.slot_id.startsWith('LB_')
    );

    let updatedDbSlots: any[] = [];
    let gfResetTriggered = false;
    let gfResetMatchPayload: any = null;

    if (isDoubleElimination) {
      // --- จัดการเคส Double Elimination (Monthly) ---
      const matches: DEMatch[] = dbSlots.map((s) => ({
        id: s.slot_id,
        side: parseBracketSide(s.side, s.slot_id),
        round: s.round_number,
        matchNumber: s.match_index,
        team1: s.player1_id ? { id: s.player1_id, name: s.player1_name ?? s.player1_id, seed: s.player1_seed ?? 0 } : null,
        team2: s.player2_id ? { id: s.player2_id, name: s.player2_name ?? s.player2_id, seed: s.player2_seed ?? 0 } : null,
        winner: s.winner_id ? { id: s.winner_id, name: s.winner_id, seed: 0 } : null,
        loser: s.loser_id ? { id: s.loser_id, name: s.loser_id, seed: 0 } : null,
        nextMatchIdOnWin: s.next_upper_slot_id ?? null,
        nextMatchIdOnLose: s.next_lower_slot_id ?? null,
        isGrandFinalReset: s.is_grand_final_reset ?? false,
        status: s.status,
      }));

      const winnerBracketMap: Record<number, DEMatch[]> = {};
      const loserBracketMap: Record<number, DEMatch[]> = {};
      const grandFinal: DEMatch[] = [];

      matches.forEach((m) => {
        if (m.side === 'WINNER') {
          if (!winnerBracketMap[m.round]) winnerBracketMap[m.round] = [];
          winnerBracketMap[m.round].push(m);
        } else if (m.side === 'LOSER') {
          if (!loserBracketMap[m.round]) loserBracketMap[m.round] = [];
          loserBracketMap[m.round].push(m);
        } else {
          grandFinal.push(m);
        }
      });

      const bracketObj: DoubleEliminationBracket = {
        id: `DE_BRACKET_${tournamentId}`,
        tournamentId,
        winnerBracket: Object.keys(winnerBracketMap).sort((a, b) => Number(a) - Number(b)).map((k) => winnerBracketMap[Number(k)]),
        loserBracket: Object.keys(loserBracketMap).sort((a, b) => Number(a) - Number(b)).map((k) => loserBracketMap[Number(k)]),
        grandFinal,
      };

      const updatedBracket = advanceDoubleEliminationWinner(bracketObj, slotId, winnerId);

      const allUpdatedMatches: DEMatch[] = [
        ...updatedBracket.winnerBracket.flat(),
        ...updatedBracket.loserBracket.flat(),
        ...updatedBracket.grandFinal,
      ];

      updatedDbSlots = allUpdatedMatches.map((m) => ({
        slot_id: m.id,
        tournament_id: tournamentId,
        round_number: m.round,
        side: m.side,
        match_index: m.matchNumber,
        player1_id: m.team1?.id ?? null,
        player2_id: m.team2?.id ?? null,
        winner_id: m.winner?.id ?? null,
        loser_id: m.loser?.id ?? null,
        status: m.status,
        next_upper_slot_id: m.nextMatchIdOnWin,
        next_lower_slot_id: m.nextMatchIdOnLose,
        is_grand_final_reset: m.isGrandFinalReset,
      }));

      const resetSlot = allUpdatedMatches.find((m) => m.id === 'GF_M2_RESET');
      if (resetSlot && slotId === 'GF_M1') {
        gfResetTriggered = true;
        gfResetMatchPayload = {
          tournament_id: tournamentId,
          bracket_slot_id: resetSlot.id,
          player1_id: resetSlot.team1?.id ?? null,
          player2_id: resetSlot.team2?.id ?? null,
          status: 'PENDING',
        };
      }
    } else {
      // --- จัดการเคส Single Elimination (Weekly) ---
      const roundsMap: Record<number, Match[]> = {};
      dbSlots.forEach((s) => {
        if (!roundsMap[s.round_number]) roundsMap[s.round_number] = [];
        roundsMap[s.round_number].push({
          id: s.slot_id,
          round: s.round_number,
          matchNumber: s.match_index,
          team1: s.player1_id ? { id: s.player1_id, name: s.player1_name ?? s.player1_id, seed: s.player1_seed ?? 0 } : null,
          team2: s.player2_id ? { id: s.player2_id, name: s.player2_name ?? s.player2_id, seed: s.player2_seed ?? 0 } : null,
          winner: s.winner_id ? { id: s.winner_id, name: s.winner_id, seed: 0 } : null,
          status: s.status,
        });
      });

      const singleBracket: Bracket = {
        id: `SE_BRACKET_${tournamentId}`,
        tournamentId,
        rounds: Object.keys(roundsMap).sort((a, b) => Number(a) - Number(b)).map((k) => roundsMap[Number(k)]),
      };

      const updatedSingleBracket = advanceWinner(singleBracket, slotId, winnerId);
      const allSingleMatches = updatedSingleBracket.rounds.flat();

      updatedDbSlots = allSingleMatches.map((m) => {
        let nextUpperSlotId: string | null = null;
        if (m.round === 1) {
          nextUpperSlotId = m.matchNumber <= 2 ? 'SE_R2_M1' : 'SE_R2_M2';
        } else if (m.round === 2) {
          nextUpperSlotId = 'SE_R3_FINAL';
        }

        return {
          slot_id: m.id,
          tournament_id: tournamentId,
          round_number: m.round,
          match_index: m.matchNumber,
          player1_id: m.team1?.id ?? null,
          player2_id: m.team2?.id ?? null,
          winner_id: m.winner?.id ?? null,
          loser_id: null,
          status: m.status,
          next_upper_slot_id: nextUpperSlotId,
          next_lower_slot_id: null,
          is_grand_final_reset: false,
        };
      });
    }

    // 3. Upsert สถานะที่อัปเดตแล้วลง Supabase
    const { error: upsertErr } = await supabase
      .from('bracket_slots')
      .upsert(updatedDbSlots, { onConflict: 'slot_id,tournament_id' });

    if (upsertErr) throw upsertErr;

    // 4. ถ้าเกิด Grand Final Reset บันทึกแมตช์ลง matches
    if (gfResetTriggered && gfResetMatchPayload) {
      await supabase.from('matches').insert(gfResetMatchPayload);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Match result processed successfully',
        grandFinalResetTriggered: gfResetTriggered,
        updatedSlotsCount: updatedDbSlots.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[/api/v1/tournament/bracket/report-result Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}