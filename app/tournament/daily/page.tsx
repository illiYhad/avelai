/* eslint-disable @next/next/no-img-element */
'use client';
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DotaPosition } from '@/lib/matchmaking/dailyArenaTierEngine';
import HudScan from '@/components/ui/HudScan'

interface LeaderboardEntry {
    rank: number;
    user_id: string;
    username: string;
    score: number;
    matches_played: number;
    reward_points: number;
}

const POSITION_OPTIONS: { id: DotaPosition; label: string; name: string }[] = [
    { id: 1, label: 'Pos 1', name: 'Safe Carry' },
    { id: 2, label: 'Pos 2', name: 'Midlane' },
    { id: 3, label: 'Pos 3', name: 'Offlane' },
    { id: 4, label: 'Pos 4', name: 'Soft Support' },
    { id: 5, label: 'Pos 5', name: 'Hard Support' },
];

export default function DailyArenaPage() {
    const router = useRouter();
    const [supabase] = useState(() => createClient());

    // User State
    const [userId, setUserId] = useState<string | null>(null);
    const [dailyTickets, setDailyTickets] = useState<number>(0);
    const [matchesPlayedToday, setMatchesPlayedToday] = useState<number>(0);
    const [bestScoreToday, setBestScoreToday] = useState<number>(0.0);
    const [isDailyLocked, setIsDailyLocked] = useState<boolean>(false);

    // Preferences & Form State
    const [primaryPos, setPrimaryPos] = useState<DotaPosition>(1);
    const [secondaryPos, setSecondaryPos] = useState<DotaPosition>(2);
    const [isEntering, setIsEntering] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Leaderboard Data
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

    // Fetch user details & daily stats
    const fetchUserData = useCallback(async (uid: string) => {
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('daily_tickets, is_daily_locked')
                .eq('id', uid)
                .single();

            if (!userError && user) {
                setDailyTickets(user.daily_tickets ?? 0);
                setIsDailyLocked(user.is_daily_locked ?? false);
            }

            // คำนวณจำนวนแมตช์ที่เล่นในรอบวันนี้ (00:00 - 23:59 UTC)
            const todayStart = new Date();
            todayStart.setUTCHours(0, 0, 0, 0);

            const { data: matches } = await supabase
                .from('daily_arena_match_results')
                .select('match_score')
                .eq('user_id', uid)
                .gte('created_at', todayStart.toISOString());

            if (matches) {
                setMatchesPlayedToday(matches.length);
                const maxScore = matches.reduce((max: number, item: { match_score: number }) => {
                    return item.match_score > max ? item.match_score : max;
                }, 0.0);
                setBestScoreToday(maxScore);
            }
        } catch (err) {
            console.error('Error fetching user daily data:', err);
        }
    }, [supabase]);

    // Fetch Leaderboard
    const fetchLeaderboard = useCallback(async () => {
        const { data, error } = await supabase
            .from('daily_arena_leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(20);

        if (!error && data) {
            setLeaderboard(data as LeaderboardEntry[]);
        }
    }, [supabase]);

    useEffect(() => {
        const init = async () => {
            setIsLoadingData(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                await fetchUserData(session.user.id);
            }
            await fetchLeaderboard();
            setIsLoadingData(false);
        };

        init();

        // Subscribe to Realtime Leaderboard updates
        const channel = supabase
            .channel('daily-arena-live-leaderboard')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'daily_arena_leaderboard' },
                () => {
                    fetchLeaderboard();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchUserData, fetchLeaderboard]);

    // Handle Matchmaking Entry
    const handleEnterArena = async () => {
        if (dailyTickets <= 0 || matchesPlayedToday >= 5 || isDailyLocked || isEntering) {
            return;
        }

        setIsEntering(true);
        setErrorMessage(null);

        try {
            const res = await fetch('/api/v1/daily/matchmake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    primaryPosition: primaryPos,
                    secondaryPosition: secondaryPos,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to matchmake');
            }

            // เมื่อ Server ยืนยันตัดตั๋วและสร้าง Lobby สำเร็จ ค่อย Redirect
            if (data.lobbyId) {
                router.push(`/waiting-room/${data.lobbyId}`);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error';
            console.error(msg);
                if (userId) {
                fetchUserData(userId); // Re-sync ตั๋วเผื่อมีการ Rollback
            }
        
            setIsEntering(false);
        }
    };

    return (
        <div className="min-h-screen text-ink pt-6 md:pt-8 pb-14 px-4 md:px-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Banner */}
                <div className="hud-panel hud-panel-gold hud-hero relative overflow-hidden rounded-2xl p-6 md:p-8">
                    {/* K-AV-UX4: พาเนล HUD (ทอง · เอียงเล็กน้อยบนจอใหญ่ · แสงสแกน) แทนกล่อง slate เรียบ */}
                    <HudScan />
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">

                        {/* ฝั่งซ้าย: DAILY ARENA Title & Description */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-cyan/10 text-cyan border border-cyan/30">
                                    TIER 1 DAILY CIRCUIT
                                </span>
                                <span className="text-xs font-mono text-ink-muted">
                                    RESET AT 00:00 UTC
                                </span>
                            </div>
                            <h1 className="hud-title text-3xl md:text-4xl text-ink mt-2">
                                DAILY ARENA
                            </h1>
                            <p className="text-sm text-ink-muted max-w-xl mt-1 font-mono">
                                5v5 Snake Draft Matchmaking. Earn Kill Points, secure your rank, and claim daily rewards.
                            </p>
                        </div>

                        {/* ฝั่งขวา: Pilot Showcase + Stats Overview */}
                        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-5 w-full xl:w-auto">

                            {/* Pilot Profile Info */}
                            <div className="text-right hidden sm:block font-mono">
                                <div className="text-sm font-bold text-ink tracking-wider flex items-center justify-end gap-2">
                                    <span>EVE // OPERATOR</span>
                                    <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                                </div>
                                <div className="text-xs text-gold font-semibold mt-0.5">
                                    GENESIS PILOT SYNC: 100%
                                </div>

                                <div className="flex items-center justify-end gap-1.5 mt-2">
                                    <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                                        KP BOOST
                                    </span>
                                    <span className="px-2 py-0.5 text-xs rounded bg-cyan/10 border border-cyan/30 text-cyan font-bold">
                                        TIER 1
                                    </span>
                                    <span className="px-2 py-0.5 text-xs rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                                        SSR
                                    </span>
                                </div>
                            </div>

                            {/* Genesis Pilot Avatar Card */}
                            <div className="relative group cursor-pointer">
                                <div className="w-20 h-28 rounded-2xl bg-void border-2 border-cyan/50 overflow-hidden flex items-center justify-center p-1 shadow-[0_0_20px_rgba(0,212,255,0.2)] transition-all group-hover:border-cyan group-hover:shadow-[0_0_30px_rgba(0,212,255,0.35)]">
                                    <img
                                        src="/images/gacha/genesis-avatar.png"
                                        alt="Genesis Pilot"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/bottts/svg?seed=AVELAiPilot';
                                        }}
                                        className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                                <span className="absolute -bottom-2 -right-1.5 text-xs font-mono px-2 py-0.5 rounded-md bg-panel border border-gold text-gold font-black tracking-wider shadow-lg">
                                    GENESIS
                                </span>
                            </div>

                            {/* Stats Overview 3 ช่อง */}
                            <div className="grid grid-cols-3 gap-2.5 font-mono">
                                <div className="hud-panel ci-corners p-3.5 rounded-xl text-center min-w-19.5">
                                    <span className="text-xs text-ink-muted block font-semibold">TICKETS</span>
                                    <span className="text-xl font-black text-cyan">{dailyTickets}</span>
                                </div>
                                <div className="hud-panel ci-corners p-3.5 rounded-xl text-center min-w-19.5">
                                    <span className="text-xs text-ink-muted block font-semibold">MATCHES</span>
                                    <span className="text-xl font-black text-ink">{matchesPlayedToday}/5</span>
                                </div>
                                <div className="hud-panel ci-corners p-3.5 rounded-xl text-center min-w-19.5">
                                    <span className="text-xs text-ink-muted block font-semibold">BEST SCORE</span>
                                    <span className="text-xl font-black text-gold">{bestScoreToday.toFixed(2)}</span>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>

                {/* Main Content: Matchmaking Configuration & Leaderboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left 2 Cols: Play Arena / Position Selection */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="hud-panel ci-corners rounded-2xl p-6 space-y-6">
                            <h2 className="text-lg font-bold font-display text-ink flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan" />
                                ARENA DEPLOYMENT SETUP
                            </h2>

                            {/* Role Selectors */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-mono text-ink-muted font-bold block mb-2">
                                        1. PRIMARY POSITION (MAIN PREFERENCE)
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
                                        {POSITION_OPTIONS.map((pos) => (
                                            <button
                                                key={pos.id}
                                                type="button"
                                                onClick={() => setPrimaryPos(pos.id)}
                                                className={`p-3 rounded-xl border text-left transition-all ${primaryPos === pos.id
                                                    ? 'bg-cyan/10 border-cyan text-cyan font-bold shadow-[0_0_10px_rgba(0,212,255,0.15)]'
                                                    : 'bg-void border-line text-ink-muted hover:border-cyan/40'
                                                    }`}
                                            >
                                                <div className="font-bold">{pos.label}</div>
                                                <div className="text-xs opacity-75">{pos.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-mono text-ink-muted font-bold block mb-2">
                                        2. SECONDARY POSITION (ELIGIBLE FOR FILL BONUS +20 PT)
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
                                        {POSITION_OPTIONS.map((pos) => (
                                            <button
                                                key={pos.id}
                                                type="button"
                                                disabled={pos.id === primaryPos}
                                                onClick={() => setSecondaryPos(pos.id)}
                                                className={`p-3 rounded-xl border text-left transition-all ${secondaryPos === pos.id
                                                    ? 'bg-gold/10 border-gold text-gold font-bold shadow-[0_0_10px_rgba(201,168,76,0.15)]'
                                                    : pos.id === primaryPos
                                                        ? 'bg-void/40 border-line text-ink-muted/60 cursor-not-allowed'
                                                        : 'bg-void border-line text-ink-muted hover:border-cyan/40'
                                                    }`}
                                            >
                                                <div className="font-bold">{pos.label}</div>
                                                <div className="text-xs opacity-75">{pos.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Rules & Warnings */}
                            <div className="bg-void border border-line/80 rounded-xl p-4 text-xs font-mono text-ink-muted space-y-1.5">
                                <p className="text-ink font-bold">📋 ARENA RULES & FORMATION:</p>
                                <p>• 1 Ticket per match. Limit of 5 rolling window matches per day.</p>
                                <p>• Snake Draft distributes players based on Tier Profile (Form Level 1-20).</p>
                                <p>• Rank #1 champions are locked from Daily Arena and trigger Auto Buy-back.</p>
                            </div>

                            {/* Error Alert */}
                            {errorMessage && (
                                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                                    ⚠️ {errorMessage}
                                </div>
                            )}

                            {/* Action Button */}
                            {isDailyLocked ? (
                                <button
                                    disabled
                                    className="w-full py-4 bg-void border border-line text-ink-muted font-mono font-bold text-sm rounded-xl cursor-not-allowed"
                                >
                                    🔒 QUALIFIED (LOCKED FOR TODAY)
                                </button>
                            ) : matchesPlayedToday >= 5 ? (
                                <button
                                    disabled
                                    className="w-full py-4 bg-void border border-line text-ink-muted font-mono font-bold text-sm rounded-xl cursor-not-allowed"
                                >
                                    DAILY MATCH LIMIT REACHED (5/5)
                                </button>
                            ) : dailyTickets <= 0 ? (
                                <button
                                    disabled
                                    className="w-full py-4 bg-void border border-line text-ink-muted font-mono font-bold text-sm rounded-xl cursor-not-allowed"
                                >
                                    NO TICKETS REMAINING
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleEnterArena}
                                    disabled={isEntering}
                                    className="w-full py-4 bg-linear-to-r from-cyan to-cyan-600 hover:from-cyan hover:to-cyan text-slate-950 font-black text-sm rounded-xl tracking-wider transition-all shadow-[0_0_20px_rgba(0,212,255,0.25)] font-mono disabled:opacity-50 cursor-pointer"
                                >
                                    {isEntering ? 'SEARCHING & BALANCING DRAFT...' : 'ENTER ARENA (1 TICKET) →'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right 1 Col: Live Daily Leaderboard */}
                    <div className="hud-panel ci-corners rounded-2xl p-6 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-line">
                            <h2 className="text-base font-bold font-display text-ink">
                                DAILY LEADERBOARD
                            </h2>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
                                LIVE
                            </span>
                        </div>

                        {isLoadingData ? (
                            <div className="py-12 text-center text-xs font-mono text-ink-muted">
                                LOADING LEADERBOARD...
                            </div>
                        ) : leaderboard.length === 0 ? (
                            <div className="py-12 text-center text-xs font-mono text-ink-muted">
                                NO MATCHES RECORDED TODAY
                            </div>
                        ) : (
                            <div className="space-y-2 font-mono text-xs max-h-120 overflow-y-auto pr-1">
                                {leaderboard.map((player) => (
                                    <div
                                        key={player.user_id}
                                        className={`p-3 rounded-xl border flex items-center justify-between ${player.rank === 1
                                            ? 'bg-gold/10 border-gold/40 text-gold'
                                            : 'bg-void border-line/80 text-ink'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className={`w-5 font-bold ${player.rank === 1 ? 'text-gold' : 'text-ink-muted'}`}>
                                                #{player.rank}
                                            </span>
                                            <span className="font-semibold truncate max-w-27.5">
                                                {player.username || player.user_id.slice(0, 8)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-ink">{player.score.toFixed(2)} pts</div>
                                            <div className="text-xs text-ink-muted">+{player.reward_points} RP</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}