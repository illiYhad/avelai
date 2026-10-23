import { FEATURES, FEATURE_DISABLED_MESSAGE } from '@/lib/featureFlags';
import { NextResponse } from 'next/server';
import { spendArenaTicket } from '@/lib/arena/ticketService';

export async function POST(req: Request) {
  if (!FEATURES.payments) {
    return Response.json({ error: FEATURE_DISABLED_MESSAGE }, { status: 503 });
  }
    try {
        const { userId, sessionId } = await req.json();

        if (!userId || !sessionId) {
            return NextResponse.json({ error: 'Missing userId or sessionId' }, { status: 400 });
        }

        await spendArenaTicket(userId, sessionId);

        return NextResponse.json({
            success: true,
            message: 'Ticket spent successfully',
            sessionId,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
}
}