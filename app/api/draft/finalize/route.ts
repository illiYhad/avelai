import { NextResponse } from 'next/server';

interface FinalizeDraftPayload {
    draftRoomId: string;
    tournamentId?: string;
    radiantCaptainId: string;
    direCaptainId: string;
    radiantPlayers: { id: string; steamId64: string; name: string }[];
    direPlayers: { id: string; steamId64: string; name: string }[];
}

export async function POST(req: Request) {
    try {
        const body: FinalizeDraftPayload = await req.json();
        const { draftRoomId, tournamentId, radiantCaptainId, direCaptainId, radiantPlayers, direPlayers } = body;

        if (!draftRoomId || !radiantPlayers?.length || !direPlayers?.length) {
            return NextResponse.json(
                { error: 'Missing required draft team information' },
                { status: 400 }
            );
        }

        const STEAM_BOT_WEBHOOK_URL = process.env.STEAM_BOT_SERVICE_URL || 'http://localhost:4000/api/lobby/create';

        // เตรียม Payload สำหรับส่งต่อไปยัง Steam Bot Worker
        const botPayload = {
            sessionId: draftRoomId,
            tournamentId: tournamentId || null,
            gameMode: 'DOTA_GAMEMODE_CM', // Captains Mode
            serverRegion: 'Singapore',
            lobbyName: `AVELAi_MATCH_${draftRoomId.slice(0, 8).toUpperCase()}`,
            password: `ave${Math.floor(1000 + Math.random() * 9000)}`,
            radiantTeam: {
                captainId: radiantCaptainId,
                players: radiantPlayers.map((p) => ({ steamId: p.steamId64, name: p.name })),
            },
            direTeam: {
                captainId: direCaptainId,
                players: direPlayers.map((p) => ({ steamId: p.steamId64, name: p.name })),
            },
        };

        console.log('[AVELAi Webhook] Dispatching payload to Steam Bot Manager:', botPayload);

        let botResponse = { success: true, simulated: true, lobbyId: 'MOCK_LOBBY_9981' };

        if (process.env.STEAM_BOT_SERVICE_URL) {
            const response = await fetch(STEAM_BOT_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-api-secret': process.env.STEAM_BOT_API_KEY || 'avela-secret-token',
                },
                body: JSON.stringify(botPayload),
            });

            if (!response.ok) {
                throw new Error(`Steam Bot Service Error: ${response.statusText}`);
            }
            botResponse = await response.json();
        }

        return NextResponse.json({
            success: true,
            message: 'Draft finalized and Steam Lobby creation triggered successfully.',
            lobbyData: botResponse,
        });
    } catch (error: any) {
        console.error('[AVELAi Webhook Error]:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}