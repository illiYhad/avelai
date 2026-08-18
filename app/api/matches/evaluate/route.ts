// app/api/matches/evaluate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchOpenDotaMatch } from '@/lib/supabase/dota/fetchMatch';
import { calculateMatchPerformance } from '@/lib/supabase/dota/calculateKP';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { match_id } = body;

        if (!match_id) {
            return NextResponse.json(
                { error: 'Missing match_id in request body' },
                { status: 400 }
            );
        }

        // 1. ตรวจสอบ Idempotency Lock ผ่าน match_id (BigInt)
        const { data: existingMatch, error: fetchError } = await supabase
            .from('matches')
            .select('id, match_id, evaluated_at, status')
            .eq('match_id', match_id)
            .maybeSingle();

        if (fetchError) {
            return NextResponse.json(
                { error: `Database query error: ${fetchError.message}` },
                { status: 500 }
            );
        }

        if (existingMatch?.evaluated_at) {
            return NextResponse.json(
                { message: 'Match has already been evaluated', match_id, evaluated_at: existingMatch.evaluated_at },
                { status: 200 }
            );
        }

        // 2. ดึงข้อมูลสถิติจาก OpenDota API
        const matchData = await fetchOpenDotaMatch(match_id);

        // 3. คำนวณ KP และ Performance Score
        const performanceResults = calculateMatchPerformance(
            matchData.players,
            matchData.radiant_score,
            matchData.dire_score
        );

        // 4. บันทึกผลและอัปเดตสถานะการประเมินลงตาราง matches โดยใช้ match_id เป็น conflict key
        const evaluatedAt = new Date().toISOString();
        const { error: updateMatchError } = await supabase
            .from('matches')
            .upsert(
                {
                    match_id: match_id,
                    radiant_win: matchData.radiant_win,
                    duration: matchData.duration,
                    status: 'completed',
                    evaluated_at: evaluatedAt,
                    updated_at: evaluatedAt,
                },
                { onConflict: 'match_id' }
            );

        if (updateMatchError) {
            return NextResponse.json(
                { error: `Failed to update match status: ${updateMatchError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            match_id,
            evaluated_at: evaluatedAt,
            radiant_win: matchData.radiant_win,
            duration: matchData.duration,
            players_evaluated: performanceResults.length,
            performance: performanceResults,
        });

    } catch (error: any) {
        console.error('❌ EVALUATION PIPELINE ERROR:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}