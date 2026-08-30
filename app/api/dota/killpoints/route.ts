import { NextRequest, NextResponse } from 'next/server';

// 1. กำหนด Type โครงสร้างข้อมูลผู้เล่น
export interface KillPointPlayerStats {
    match_id?: string | number;
    player_id?: string | number;
    kills: number;
    deaths: number;
    assists: number;
    tower_kills?: number;
}

export async function POST(req: NextRequest) {
    try {
        // 2. ดึงข้อมูล players และ matchId จาก Request Body
        const body = await req.json().catch(() => ({}));
        const players: KillPointPlayerStats[] = Array.isArray(body.players) ? body.players : [];

        if (players.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No players data provided' }, 
                { status: 400 }
            );
        }

        // 3. คำนวณ Kill Points (KP Matrix) ตามสูตร AVELAi
        const results = players.map((p: KillPointPlayerStats) => {
            const kp = (p.kills * 1.0) - (p.deaths * 0.5) + (p.assists * 0.3) + ((p.tower_kills || 0) * 1.0);
            return {
                match_id: p.match_id ?? body.match_id ?? 'MATCH_UNKNOWN',
                player_id: p.player_id ?? 'PLAYER_UNKNOWN',
                kill_points: Number(kp.toFixed(2))
            };
        });

        return NextResponse.json({ success: true, data: results }, { status: 200 });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}