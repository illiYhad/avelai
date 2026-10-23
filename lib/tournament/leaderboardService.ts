import { createClient } from '@/lib/supabase/client';

export interface DailyLeaderboardEntry {
    rank: number;
    userId: string;
    playerName: string;
    roleBadge: string;
    dailyTp: number;
    matchesPlayed: number;
    trend: 'up' | 'down' | 'same';
}

interface RawLeaderboardRow {
    rank: number;
    user_id: string;
    tournament_points: number | null;
    matches_played: number | null;
    trend: 'up' | 'down' | 'same' | null;
    profiles: {
        username: string | null;
        primary_role: string | null;
    } | {
        username: string | null;
        primary_role: string | null;
    }[] | null;
}

/**
 * ดึงข้อมูล Leaderboard รายวันจาก Supabase
 */
export async function fetchDailyLeaderboard(dateStr?: string): Promise<DailyLeaderboardEntry[]> {
    const supabase = createClient();
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('daily_leaderboard')
        .select(`
            rank,
            user_id,
            tournament_points,
            matches_played,
            trend,
            profiles:user_id (
                username,
                primary_role
            )
        `)
        .eq('tournament_date', targetDate)
        .order('rank', { ascending: true })
        .limit(20);

    if (error || !data) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }

    const rows = data as unknown as RawLeaderboardRow[];

    return rows.map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

        return {
            rank: row.rank,
            userId: row.user_id,
            playerName: profile?.username || `Player_${row.user_id.slice(0, 5)}`,
            roleBadge: profile?.primary_role || 'Core',
            dailyTp: Number(row.tournament_points || 0),
            matchesPlayed: row.matches_played || 0,
            trend: (row.trend as 'up' | 'down' | 'same') || 'same',
        };
    });
}