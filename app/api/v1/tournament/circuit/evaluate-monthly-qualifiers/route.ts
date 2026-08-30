import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    evaluateMonthlyQualifiers,
    type LeaderboardEntry
} from '@/lib/tournament/circuitPoints';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EvaluateMonthlyRequest {
    seasonId: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: EvaluateMonthlyRequest = await req.json();
        const { seasonId } = body;

        if (!seasonId) {
            return NextResponse.json(
                { success: false, error: 'seasonId is required' },
                { status: 400 }
            );
        }

        // 1. ดึงคะแนนสะสมและสถิติของผู้เล่นทุกคนใน Season
        const { data: rows, error: queryError } = await supabase
            .from('circuit_points')
            .select('user_id, points_earned, awarded_at')
            .eq('season_id', seasonId);

        if (queryError) {
            throw new Error(`Failed to query circuit points: ${queryError.message}`);
        }

        if (!rows || rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No circuit points data found for this season' },
                { status: 404 }
            );
        }

        // 2. ดึงสถิติ Win Rate และ Best Rank จาก match/tournament stats
        const { data: userStats } = await supabase
            .from('user_tournament_stats')
            .select('user_id, weekly_win_rate, best_rank')
            .eq('season_id', seasonId);

        const statsMap = new Map<string, { winRate: number; bestRank: number }>();
        (userStats || []).forEach((st: { user_id: string; weekly_win_rate: number; best_rank: number }) => {
            statsMap.set(st.user_id, {
                winRate: st.weekly_win_rate || 0,
                bestRank: st.best_rank || 999,
            });
        });

        // 3. รวมคะแนนจัดทำ LeaderboardEntry
        const userSummary = new Map<string, { totalPoints: number; earliestTime: string }>();
        for (const r of rows) {
            const existing = userSummary.get(r.user_id) || { totalPoints: 0, earliestTime: r.awarded_at };
            existing.totalPoints += r.points_earned;
            if (new Date(r.awarded_at) < new Date(existing.earliestTime)) {
                existing.earliestTime = r.awarded_at;
            }
            userSummary.set(r.user_id, existing);
        }

        const leaderboard: LeaderboardEntry[] = Array.from(userSummary.entries()).map(
            ([userId, summary]) => {
                const extra = statsMap.get(userId) || { winRate: 0, bestRank: 999 };
                return {
                    userId,
                    totalCircuitPoints: summary.totalPoints,
                    weeklyWinRate: extra.winRate,
                    bestRank: extra.bestRank,
                    achievedAt: summary.earliestTime,
                };
            }
        );

        // 4. ตัดสินผล Top 16 ด้วย 4-Tier Tiebreaker Engine
        const qualifiers = evaluateMonthlyQualifiers(leaderboard);

        // 5. บันทึกสิทธิ์ Monthly Pass (Top 16) ลงฐานข้อมูล
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
const qualifierUserIds = qualifiers.map((q) => q.userId);

        const { error: updateError } = await supabase
            .from('season_qualifiers')
            .upsert(
                qualifiers.map((q) => ({
                    season_id: seasonId,
                    user_id: q.userId,
                    seed: q.seed,
                    circuit_points: q.circuitPoints,
                    best_rank: q.bestRank,
                    weekly_win_rate: q.weeklyWinRate,
                    has_monthly_pass: true,
                    qualified_at: q.qualifiedAt,
                })),
                { onConflict: 'season_id,user_id' }
            );

        if (updateError) {
            throw new Error(`Failed to update season qualifiers: ${updateError.message}`);
        }

        return NextResponse.json({
            success: true,
            seasonId,
            qualifiedCount: qualifiers.length,
            qualifiers,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        console.error('[/api/v1/tournament/circuit/evaluate-monthly-qualifiers]', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}