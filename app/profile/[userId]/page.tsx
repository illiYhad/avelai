/* eslint-disable @next/next/no-img-element */
'use client';
import { HeroBackdrop } from '@/components/ui/Art';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Types ───────────────────────────────────────────────────────────────────
type Profile = {
    id: string;
    display_name: string;
    avatar_url?: string;
    current_elo: number;
    karma_score?: number; // K-AV-FIX2: ไม่อยู่ใน public_profiles_v → ไม่แสดง
    win_rate?: number;
    badge_slots?: BadgeSlot[];
    subscription_tier?: string;
    arena_tickets?: number;
    reward_points?: number;
};

type BadgeSlot = {
    id: string;
    label: string;
    icon: string;
    color: string;
} | null;

type PresenceState = 'AVE_ONLINE' | 'ARENA_READY' | 'IN_GAME' | 'OFFLINE';

// ─── 4-State LED Config ───────────────────────────────────────────────────────
const LED: Record<PresenceState, { label: string; dot: string; ring: string; pulse: boolean }> = {
    AVE_ONLINE: { label: 'AVE ONLINE', dot: 'bg-cyan', ring: 'shadow-glow-cyan', pulse: true },
    ARENA_READY: { label: 'ARENA READY', dot: 'bg-gold', ring: 'shadow-glow-gold', pulse: false },
    IN_GAME: { label: 'IN GAME', dot: 'bg-orange-500', ring: 'shadow-glow-gold', pulse: true },
    OFFLINE: { label: 'OFFLINE', dot: 'bg-zinc-600', ring: '', pulse: false },
};

// ─── Default badge slots (empty) ─────────────────────────────────────────────
const EMPTY_BADGES: BadgeSlot[] = [null, null, null];

// ─── Component ───────────────────────────────────────────────────────────────
export default function ProfilePage() {
    const params = useParams();
    const userId = params?.userId as string;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [presence, setPresence] = useState<PresenceState>('OFFLINE');
    const [loading, setLoading] = useState(true);

    // ── Fetch profile (no auth required) ──────────────────────────────────────
    useEffect(() => {
        if (!userId) return;
        const fetchProfile = async () => {
            // K-AV-FIX2: โปรไฟล์คนอื่นอ่านจาก public_profiles_v เท่านั้น (คอลัมน์สาธารณะ) · ไม่พบผู้ใช้ = ไม่ log (log เฉพาะ error จริง)
            const { data, error } = await supabase
                .from('public_profiles_v')
                .select('id, display_name, avatar_url, current_elo, win_rate, badge_slots')
                .eq('id', userId)
                .maybeSingle();
            if (error) console.error('Profile fetch error:', error.message);
            else if (data) setProfile(data as Profile);
            setLoading(false);
        };
        fetchProfile();
    }, [userId]);

    // ── Supabase Realtime Presence ─────────────────────────────────────────────
    useEffect(() => {
        if (!userId) return;

        const channel = supabase.channel(`presence:${userId}`, {
            config: { presence: { key: userId } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState<{ status: PresenceState }>();
                const userState = state[userId]?.[0];
                setPresence(userState?.status ?? 'OFFLINE');
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Broadcast own presence if this is the logged-in user
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user?.id === userId) {
                        await channel.track({ status: 'AVE_ONLINE' });
                    }
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="min-h-screen bg-void flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                <span className="text-cyan font-mono text-xs tracking-[0.2em] animate-pulse">
                    LOADING PASSPORT...
                </span>
            </div>
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen bg-void flex items-center justify-center">
            <span className="text-zinc-500 font-mono text-sm">PLAYER NOT FOUND</span>
        </div>
    );

    const led = LED[presence];
    const badges = profile.badge_slots?.length ? profile.badge_slots : EMPTY_BADGES;
    const winRate = profile.win_rate != null ? `${profile.win_rate.toFixed(1)}%` : '—';
    const tag = `#${profile.id.substring(0, 4).toUpperCase()}`;

    return (
        <div className="relative min-h-screen bg-void flex items-center justify-center overflow-hidden p-4">
            <HeroBackdrop game="dota2" />

            {/* ── Passport Card (3:4 ratio) ─────────────────────────────────────── */}
            <div
                className="relative w-full max-w-105 rounded-2xl overflow-hidden border border-gold/40"
                style={{
                    aspectRatio: '3/4',
                    background: 'linear-gradient(160deg, var(--color-surface-2) 0%, var(--color-void) 60%, var(--color-void) 100%)',
                    boxShadow: 'var(--shadow-glow-cyan), var(--shadow-glow-gold)',
                }}
            >
                {/* Scanline overlay */}
                <div
                    className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, var(--color-ink) 0px, var(--color-ink) 1px, transparent 1px, transparent 3px)' }}
                />

                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-gold/60 rounded-tl-2xl z-20" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-gold/60 rounded-tr-2xl z-20" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-gold/60 rounded-bl-2xl z-20" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-gold/60 rounded-br-2xl z-20" />

                {/* Header bar */}
                <div className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2">
                    <span className="font-mono text-xs text-cyan/60 tracking-[0.25em]">AVELAI // ESPORTS PASSPORT</span>
                    {/* 4-State LED */}
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${led.dot} ${led.ring} ${led.pulse ? 'animate-pulse' : ''}`} />
                        <span className="font-mono text-xs tracking-[0.15em] text-zinc-400">{led.label}</span>
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-4 h-px bg-linear-to-r from-transparent via-gold/30 to-transparent" />

                {/* ── Main body: Left 3/5 + Right 2/5 ─────────────────────────────── */}
                <div className="relative z-20 flex h-[55%]">

                    {/* Left 3/5 — Steam Avatar */}
                    <div className="w-[60%] relative flex items-end p-4">
                        {/* Avatar fill */}
                        <div className="absolute inset-0">
                            <img
                                src={
                                    profile.avatar_url ||
                                    `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.id}`
                                }
                                alt={profile.display_name}
                                className="w-full h-full object-cover object-top"
                                style={{ filter: 'brightness(0.85) contrast(1.1)' }}
                            />
                            {/* Gradient fade right */}
                            <div className="absolute inset-0 bg-linear-to-r from-transparent via-transparent to-void" />
                            {/* Gradient fade bottom */}
                            <div className="absolute inset-0 bg-linear-to-t from-void via-void/20 to-transparent" />
                        </div>

                        {/* Name + tag over avatar bottom */}
                        <div className="relative z-10">
                            <div className="flex items-baseline gap-2">
                                <span className="font-black text-white text-lg leading-none" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                                    {profile.display_name}
                                </span>
                                <span className="font-mono text-xs text-gold/80">{tag}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right 2/5 — Stats */}
                    <div className="w-[40%] flex flex-col justify-center gap-3 pr-4 py-4">

                        {/* ELO */}
                        <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs text-zinc-500 tracking-[0.2em]">ELO RATING</span>
                            <span
                                className="font-black text-2xl text-cyan leading-none"
                                style={{ fontFamily: 'var(--font-display)', textShadow: 'var(--shadow-glow-cyan)' }}
                            >
                                {profile.current_elo.toLocaleString()}
                            </span>
                        </div>

                        <div className="h-px bg-gold/15" />

                        {/* Win Rate */}
                        <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs text-zinc-500 tracking-[0.2em]">WIN RATE</span>
                            <span className="font-black text-xl text-gold leading-none" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                                {winRate}
                            </span>
                        </div>

                        <div className="h-px bg-gold/15" />

                        {/* Karma */}
                        {profile.karma_score !== undefined ? (
                        <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs text-zinc-500 tracking-[0.2em]">KARMA SCORE</span>
                            <div className="flex items-baseline gap-1">
                                <span className="font-black text-xl text-emerald-400 leading-none" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                                    {profile.karma_score}
                                </span>
                                <span className="font-mono text-xs text-zinc-600">/ 100</span>
                            </div>
                            {/* Karma bar */}
                            <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-linear-to-r from-emerald-600 to-emerald-400 transition-all"
                                    style={{ width: `${profile.karma_score}%` }}
                                />
                            </div>
                        </div>
                        ) : null}

                    </div>
                </div>
                {/* Tier + Tickets + Points — ข้อมูลส่วนตัว ไม่อยู่ใน public_profiles_v (K-AV-FIX2) → แสดงเมื่อมีค่าเท่านั้น */}
                {profile.subscription_tier !== undefined ? (<>
                <div className="h-px bg-gold/15" />
                <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-zinc-500 tracking-[0.2em]">ARENA PASS</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${profile.subscription_tier === 'pro' ? 'bg-gold/20 text-gold border border-gold/50' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                            {profile.subscription_tier === 'pro' ? 'PRO' : 'FREE'}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">{profile.arena_tickets ?? 0} TICKETS</span>
                        <span className="font-mono text-xs text-zinc-500">{profile.reward_points ?? 0} PTS</span>
                    </div>
                </div>
                </>) : null}

                {/* Divider */}
                <div className="mx-4 h-px bg-linear-to-r from-transparent via-gold/20 to-transparent" />

                {/* ── Badge Slots ──────────────────────────────────────────────────── */}
                <div className="relative z-20 px-4 py-4">
                    <span className="font-mono text-xs text-zinc-600 tracking-[0.2em] block mb-3">ACHIEVEMENT BADGES</span>
                    <div className="grid grid-cols-3 gap-3">
                        {badges.map((badge, i) => (
                            badge ? (
                                <div
                                    key={i}
                                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-gold/30 bg-gold/5"
                                >
                                    <span className="text-2xl">{badge.icon}</span>
                                    <span className="font-mono text-xs text-zinc-400 text-center leading-tight">{badge.label}</span>
                                </div>
                            ) : (
                                <div
                                    key={i}
                                    className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 min-h-16"
                                >
                                    <div className="w-5 h-5 rounded-full border border-zinc-700 flex items-center justify-center">
                                        <span className="text-zinc-700 text-xs">+</span>
                                    </div>
                                    <span className="font-mono text-xs text-zinc-700">LOCKED</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-zinc-700 tracking-widest">PRECISION IS FREEDOM</span>
                        <span className="font-mono text-xs text-zinc-700">AVELAi © 2026</span>
                    </div>
                </div>

            </div>
        </div>
    );
}