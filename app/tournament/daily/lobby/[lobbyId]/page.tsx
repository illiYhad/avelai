'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    DailyArenaMatchFormation,
    FormedTeamMember,
    DotaPosition
} from '@/lib/matchmaking/dailyArenaTierEngine';

const POSITION_LABELS: Record<DotaPosition, { label: string; role: string }> = {
    1: { label: 'Pos 1', role: 'Safe Carry' },
    2: { label: 'Pos 2', role: 'Midlane' },
    3: { label: 'Pos 3', role: 'Offlane' },
    4: { label: 'Pos 4', role: 'Soft Support' },
    5: { label: 'Pos 5', role: 'Hard Support' },
};

export default function DailyArenaLobbyPage() {
    const params = useParams();
    const router = useRouter();
    const lobbyId = params.lobbyId as string;
    const [supabase] = useState(() => createClient());

    const [formation, setFormation] = useState<DailyArenaMatchFormation | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [lobbyStatus, setLobbyStatus] = useState<'forming' | 'ready' | 'starting'>('ready');
    const [countdown, setCountdown] = useState<number>(10);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Stats State สำหรับ Header Banner
    const [dailyTickets] = useState<number>(3);
    const [matchesPlayedToday] = useState<number>(0);
    const [bestScoreToday] = useState<number>(0.0);
    useEffect(() => {
        const initLobby = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUserId(session.user.id);
            }

            const { data, error } = await supabase
                .from('daily_arena_lobbies')
                .select('*')
                .eq('id', lobbyId)
                .single();

            if (!error && data?.formation) {
                setFormation(data.formation as DailyArenaMatchFormation);
            }
            setIsLoading(false);
        };

        initLobby();

        // Realtime sync สำหรับสถานะห้อง Lobby
        const channel = supabase
            .channel(`daily-lobby-${lobbyId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'daily_arena_lobbies', filter: `id=eq.${lobbyId}` },
                (payload: { new: { formation?: DailyArenaMatchFormation; status?: 'forming' | 'ready' | 'starting' } }) => {
                    if (payload.new?.formation) {
                        setFormation(payload.new.formation);
                    }
                    if (payload.new?.status) {
                        setLobbyStatus(payload.new.status);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [lobbyId, supabase]);

    // Countdown สำหรับ Transition ไปหน้า Match เมื่อทุกคนพร้อม
    useEffect(() => {
        if (lobbyStatus === 'starting' && countdown > 0) {
            const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else if (lobbyStatus === 'starting' && countdown === 0 && formation) {
            router.push(`/match/${formation.matchId}`);
        }
    }, [lobbyStatus, countdown, formation, router]);

    const handleReady = async () => {
        setLobbyStatus('starting');
        if (formation) {
            await supabase
                .from('daily_arena_lobbies')
                .update({ status: 'starting' })
                .eq('id', lobbyId);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-[#00D4FF] font-mono">
                INITIALIZING DRAFT BALANCING...
            </div>
        );
    }

    if (!formation) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono gap-4">
                <p>MATCH FORMATION NOT FOUND</p>
                <button
                    onClick={() => router.push('/tournament/daily')}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 rounded text-slate-200 hover:text-white"
                >
                    ← RETURN TO ARENA
                </button>
            </div>
        );
    }

    const renderTeamSlot = (member: FormedTeamMember, side: 'Radiant' | 'Dire') => {
        const isSelf = member.userId === currentUserId;
        const posInfo = POSITION_LABELS[member.assignedPosition];

        return (
            <div
                key={member.userId}
                className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isSelf
                        ? side === 'Radiant'
                            ? 'bg-[#00D4FF]/10 border-[#00D4FF]/50 ring-1 ring-[#00D4FF]/50'
                            : 'bg-[#C9A84C]/10 border-[#C9A84C]/50 ring-1 ring-[#C9A84C]/50'
                        : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-300">
                        {posInfo.label}
                    </div>
                    <div>
                        <div className="text-sm font-bold font-mono text-slate-200 flex items-center gap-2">
                            <span>{member.userId.slice(0, 8)}...</span>
                            {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                    YOU
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                            {posInfo.role} • {member.tierCode}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {member.isSecondaryFill && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold animate-pulse">
                            Fill Bonus +20
                        </span>
                    )}
                    <span className="text-xs font-mono text-slate-500 font-medium">
                        Lv.{member.formLevel}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white pt-20 pb-12 px-6 md:px-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* 1. Header Banner with Integrated Player Pilot & Stats */}
                <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#00D4FF]/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">

                        {/* ฝั่งซ้าย: DAILY ARENA Title & Description */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
                                    TIER 1 DAILY CIRCUIT
                                </span>
                                <span className="text-xs font-mono text-slate-400">
                                    RESET AT 00:00 UTC
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-wider text-white mt-2 font-['Orbitron']">
                                DAILY ARENA
                            </h1>
                            <p className="text-sm text-slate-400 max-w-xl mt-1 font-mono">
                                5v5 Snake Draft Matchmaking. Earn Kill Points, secure your rank, and claim daily rewards.
                            </p>
                        </div>

                        {/* ฝั่งขวา: Pilot Vertical Profile Card + Status & Stats */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 w-full xl:w-auto">

                            {/* Pilot Avatar Frame */}
                            <div className="relative group cursor-pointer shrink-0">
                                <div className="w-24 h-28 rounded-2xl bg-slate-950 border-2 border-[#00D4FF]/50 flex items-center justify-center font-['Orbitron'] font-black text-2xl text-[#00D4FF] shadow-[0_0_20px_rgba(0,212,255,0.25)] overflow-hidden transition-all group-hover:border-[#00D4FF] group-hover:shadow-[0_0_30px_rgba(0,212,255,0.4)]">
                                    <span className="group-hover:scale-110 transition-transform duration-300">SH</span>
                                </div>
                                <span className="absolute -bottom-1 -right-1 text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-[#C9A84C] text-[#C9A84C] font-bold shadow-md">
                                    PILOT
                                </span>
                            </div>

                            {/* Pilot Details & Badges & Stats */}
                            <div className="flex flex-col gap-3 w-full sm:w-auto">
                                <div className="font-mono">
                                    <div className="text-base font-black text-white tracking-wider flex items-center gap-2">
                                        <span>EVE // OPERATOR</span>
                                        <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
                                    </div>
                                    <div className="text-xs text-[#C9A84C] font-bold mt-0.5">
                                        GENESIS PILOT SYNC: 100%
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 font-mono">
                                    <span className="px-2 py-0.5 text-[9px] rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                                        KP BOOST
                                    </span>
                                    <span className="px-2 py-0.5 text-[9px] rounded bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] font-bold">
                                        TIER 1
                                    </span>
                                    <span className="px-2 py-0.5 text-[9px] rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                                        SSR
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2.5 font-mono pt-1">
                                    <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-center min-w-18.75">
                                        <span className="text-[10px] text-slate-400 block font-semibold">TICKETS</span>
                                        <span className="text-lg font-black text-[#00D4FF]">{dailyTickets}</span>
                                    </div>
                                    <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-center min-w-18.75">
                                        <span className="text-[10px] text-slate-400 block font-semibold">MATCHES</span>
                                        <span className="text-lg font-black text-slate-200">{matchesPlayedToday}/5</span>
                                    </div>
                                    <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-center min-w-18.75">
                                        <span className="text-[10px] text-slate-400 block font-semibold">BEST SCORE</span>
                                        <span className="text-lg font-black text-[#C9A84C]">{bestScoreToday.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>

                {/* 2. Match Control & Ready Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF]">
                            SNAKE DRAFT FORMATION READY
                        </span>
                        <h2 className="text-xl md:text-2xl font-black tracking-wide text-slate-100 mt-2 font-['Orbitron']">
                            MATCH DISPATCH STATUS
                        </h2>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                            MATCH ID: {formation.matchId} • DELTA: ±{formation.formLevelDelta.toFixed(2)}
                        </p>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {lobbyStatus === 'starting' ? (
                            <div className="px-8 py-3 bg-[#00D4FF]/20 border border-[#00D4FF]/40 rounded-xl text-center w-full md:w-auto">
                                <span className="text-xs font-mono text-slate-400 block">STARTING GAME IN</span>
                                <span className="text-2xl font-black font-mono text-[#00D4FF]">{countdown}s</span>
                            </div>
                        ) : (
                            <button
                                onClick={handleReady}
                                className="w-full md:w-auto px-8 py-3.5 bg-linear-to-r from-[#00D4FF] to-cyan-600 hover:from-cyan-400 hover:to-[#00D4FF] text-slate-950 font-black text-sm rounded-xl tracking-wider transition-all shadow-[0_0_15px_rgba(0,212,255,0.25)] cursor-pointer font-mono"
                            >
                                READY TO DEPLOY →
                            </button>
                        )}
                    </div>
                </div>

                {/* 3. Team Formation Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* RADIANT TEAM (TEAM A) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#00D4FF]" />
                                <h2 className="text-base font-bold font-['Orbitron'] text-[#00D4FF] tracking-wide">
                                    TEAM RADIANT
                                </h2>
                            </div>
                            <span className="text-xs font-mono text-slate-400">
                                AVG LVL: <span className="text-slate-200 font-bold">{formation.averageFormLevelTeamA}</span>
                            </span>
                        </div>
                        <div className="space-y-2.5">
                            {formation.teamA.map((member) => renderTeamSlot(member, 'Radiant'))}
                        </div>
                    </div>

                    {/* DIRE TEAM (TEAM B) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#C9A84C]" />
                                <h2 className="text-base font-bold font-['Orbitron'] text-[#C9A84C] tracking-wide">
                                    TEAM DIRE
                                </h2>
                            </div>
                            <span className="text-xs font-mono text-slate-400">
                                AVG LVL: <span className="text-slate-200 font-bold">{formation.averageFormLevelTeamB}</span>
                            </span>
                        </div>
                        <div className="space-y-2.5">
                            {formation.teamB.map((member) => renderTeamSlot(member, 'Dire'))}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}