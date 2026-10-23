import { createClient } from '@/lib/supabase/client';

export interface UserArenaStatus {
    tier: 'free' | 'pro' | 'academy';
    dailyTicketsRemaining: number;
    matchesPlayedToday: number;
    canEnterArena: boolean;
}

/**
 * ดึงสถานะ Subscription และสิทธิ์ตั๋วของ User ในวันปัจจุบัน
 */
export async function getUserArenaStatus(userId: string): Promise<UserArenaStatus> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // 1. เช็ค Tier จาก user_subscriptions
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('tier, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

    const isPro = sub?.tier === 'pro' || sub?.tier === 'academy';
    const maxAllowedTickets = isPro ? 5 : 1; // Pro ได้โควตาสูงสุด 5 ใบ/วัน, Free 1 ใบ

    // 2. เช็คประวัติการใช้ตั๋ววันนี้จาก arena_ticket_log
    const { data: logs } = await supabase
        .from('arena_ticket_log')
        .select('amount, action_type')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00.000Z`);

    const usedToday = (logs || [])
        .filter((l) => l.action_type === 'spend')
        .reduce((sum, l) => sum + Math.abs(l.amount), 0);

    const remaining = Math.max(0, maxAllowedTickets - usedToday);

    return {
        tier: isPro ? (sub?.tier as 'pro' | 'academy') : 'free',
        dailyTicketsRemaining: remaining,
        matchesPlayedToday: usedToday,
        canEnterArena: remaining > 0 && usedToday < 5,
    };
}

/**
 * ฟังก์ชันตัดตั๋ว 1 ใบเมื่อกด Enter Arena
 */
export async function spendArenaTicket(userId: string, sessionId: string): Promise<boolean> {
    const supabase = createClient();
    const status = await getUserArenaStatus(userId);

    if (!status.canEnterArena) {
        throw new Error('ไม่สามารถเข้าแข่งขันได้ (ตั๋วหมด หรือครบโควตา 5 แมตช์ต่อวันแล้ว)');
    }

    const { error } = await supabase.from('arena_ticket_log').insert({
        user_id: userId,
        amount: -1,
        action_type: 'spend',
        reference_id: sessionId,
    });

    return !error;
}