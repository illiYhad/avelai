// app/api/v1/tournament/circuit/award-weekly/route.ts
// POST /api/v1/tournament/circuit/award-weekly
// FEATURE-4203: Circuit Points Weekly Award with Idempotency Lock

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    processWeeklyCircuitPoints,
    type WeeklyPlacementInput
} from '@/lib/tournament/circuitPoints';

// Service Role Client — Server-side only
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AwardWeeklyRequest {
    seasonId: string;
    weeklyTournamentId: string;
    placements: WeeklyPlacementInput[];
}

export async function POST(req: NextRequest) {
    try {
        const body: AwardWeeklyRequest = await req.json();
        const { seasonId, weeklyTournamentId, placements } = body;

        // 1. Validation
        if (!seasonId || !weeklyTournamentId || !Array.isArray(placements) || placements.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'seasonId, weeklyTournamentId, and non-empty placements are required'
                },
                { status: 400 }
            );
        }

        // 2. Query Existing Records เพื่อตรวจสอบ Idempotency Key จาก DB
        const { data: existingRecords, error: fetchError } = await supabase
            .from('circuit_points')
            .select('idempotency_key')
            .eq('season_id', seasonId)
            .eq('weekly_tournament_id', weeklyTournamentId);

        if (fetchError) {
            throw new Error(`Database check failed: ${fetchError.message}`);
        }

        const processedKeys = new Set<string>(
            (existingRecords || []).map((r: { idempotency_key: string }) => r.idempotency_key)
        );

        // 3. เรียก Engine คำนวณแต้ม Matrix 1-16 (100 -> 5 CP, Rank 17+ ได้ 0 CP)
        const { awards, skippedCount } = processWeeklyCircuitPoints(
            seasonId,
            weeklyTournamentId,
            placements,
            processedKeys
        );

        // กรณีแต้มในรอบนี้ถูกบันทึกไปหมดแล้ว
        if (awards.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All placements have already been awarded (Idempotency locked)',
                awardedCount: 0,
                skippedCount,
            });
        }

        // 4. บันทึกผลแต้มลง Supabase (circuit_points)
        const dbPayload = awards.map((award) => ({
            idempotency_key: award.idempotencyKey,
            user_id: award.userId,
            season_id: award.seasonId,
            weekly_tournament_id: award.weeklyTournamentId,
            points_earned: award.pointsEarned,
            source: award.source,
            awarded_at: award.awardedAt,
        }));

        const { error: insertError } = await supabase
            .from('circuit_points')
            .insert(dbPayload);

        if (insertError) {
            throw new Error(`Circuit points insert failed: ${insertError.message}`);
        }

        return NextResponse.json({
            success: true,
            awardedCount: awards.length,
            skippedCount,
            awards,
        });

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        console.error('[/api/v1/tournament/circuit/award-weekly]', message);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}