import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDailyArenaQueue } from '@/lib/matchmaking/dailyArenaTierEngine';

export async function POST(req: NextRequest) {
    const supabase = await createClient();

    // 1. ตรวจสอบ Session ผู้ใช้
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        // 2. ตรวจสอบ User Profile & Daily Ticket
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('daily_tickets, is_daily_locked')
            .eq('id', userId)
            .single();

        if (profileError || !userProfile) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }

        if (userProfile.is_daily_locked) {
            return NextResponse.json({ error: 'Player is locked from Daily Arena' }, { status: 403 });
        }

        if ((userProfile.daily_tickets ?? 0) <= 0) {
            return NextResponse.json({ error: 'Insufficient Daily Tickets' }, { status: 400 });
        }

        // 3. อ่าน Position Preference จาก Body
        const body = await req.json().catch(() => ({}));
        const primaryPos = body.primaryPosition || 1;
        const secondaryPos = body.secondaryPosition || 2;

        // 4. หักตั๋ว 1 ใบ
        const { error: deductError } = await supabase
            .from('users')
            .update({ daily_tickets: userProfile.daily_tickets - 1 })
            .eq('id', userId);

        if (deductError) {
            return NextResponse.json({ error: 'Failed to spend ticket' }, { status: 500 });
        }

        // 5. บันทึก/อัปเดตสถานะเข้าตาราง Queue กลาง
        const now = new Date().toISOString();
        const { error: queueInsertError } = await supabase
            .from('daily_arena_queue')
            .upsert({
                user_id: userId,
                primary_position: primaryPos,
                secondary_position: secondaryPos,
                status: 'waiting',
                queued_at: now,
                updated_at: now
            });

        if (queueInsertError) {
            // Atomic Rollback: คืนตั๋ว
            await supabase.from('users').update({ daily_tickets: userProfile.daily_tickets }).eq('id', userId);
            return NextResponse.json({ error: 'Failed to join queue. Ticket refunded.' }, { status: 500 });
        }

        // 6. ดึงรายชื่อผู้เล่นที่กำลังรอคิว (สถานะ waiting เรียงตามเวลา)
        const { data: rawQueue, error: fetchQueueError } = await supabase
            .from('daily_arena_queue')
            .select(`
                user_id,
                primary_position,
                secondary_position,
                queued_at,
                users (
                    elo_rating
                )
            `)
            .eq('status', 'waiting')
            .order('queued_at', { ascending: true })
            .limit(50);

        if (fetchQueueError || !rawQueue) {
            // คืนตั๋วหากดึง queue ล้มเหลว
            await supabase.from('users').update({ daily_tickets: userProfile.daily_tickets }).eq('id', userId);
            return NextResponse.json({ error: 'Failed to fetch queue pool. Ticket refunded.' }, { status: 500 });
        }

        // 7. จัด Data Shape ให้ตรงกับ DailyQueuePlayer[] สำหรับ Engine
        const queuePool = rawQueue.map((p: any) => {
            const formLevel = p.users?.elo_rating ? Math.max(1, Math.min(20, Math.floor(p.users.elo_rating / 100))) : 10;
            return {
                userId: p.user_id,
                primaryPosition: p.primary_position,
                secondaryPosition: p.secondary_position,
                queuedAt: p.queued_at,
                tierProfile: {
                    formLevel: formLevel,
                    tierCode: `T${formLevel}`
                }
            };
        });

        // 8. รัน Matchmaking Engine
        const formation = processDailyArenaQueue(queuePool);

        // ถ้าผู้เล่นยังไม่พอ หรือจัดทีมตามกฎไม่ได้ -> ให้อยู่ในสถานะรอคิว (ไม่ mock ปลอม)
        if (!formation) {
            return NextResponse.json({
                success: true,
                status: 'queued',
                message: 'In queue. Waiting for more players.'
            }, { status: 200 });
        }

        // 9. บันทึกลง daily_arena_lobbies เมื่อ Formation สำเร็จ
        const { data: lobbyRecord, error: lobbyError } = await supabase
            .from('daily_arena_lobbies')
            .insert({
                match_id: formation.matchId,
                status: 'ready',
                formation: formation,
                created_by: userId,
            })
            .select('id')
            .single();

        if (lobbyError || !lobbyRecord) {
            // Atomic Rollback: คืนตั๋ว
            await supabase.from('users').update({ daily_tickets: userProfile.daily_tickets }).eq('id', userId);
            return NextResponse.json({ error: 'Lobby creation failed. Ticket refunded.' }, { status: 500 });
        }

        // 10. อัปเดตสถานะผู้เล่นทั้ง 10 คนใน Queue เป็น matched
        const matchedUserIds = [
            ...formation.teamA.map((p: any) => p.userId),
            ...formation.teamB.map((p: any) => p.userId)
        ];

        await supabase
            .from('daily_arena_queue')
            .update({ status: 'matched', lobby_id: lobbyRecord.id })
            .in('user_id', matchedUserIds);

        return NextResponse.json({
            success: true,
            status: 'matched',
            lobbyId: lobbyRecord.id,
            matchId: formation.matchId,
        }, { status: 200 });

    } catch (err: any) {
        // Rollback ในระดับ Exception ป้องกันตั๋วหาย
        const { data: userProfile } = await supabase.from('users').select('daily_tickets').eq('id', userId).single();
        if (userProfile) {
            await supabase.from('users').update({ daily_tickets: userProfile.daily_tickets }).eq('id', userId);
        }
        return NextResponse.json({ error: err?.message || 'Internal Server Error. Ticket refunded.' }, { status: 500 });
    }
}