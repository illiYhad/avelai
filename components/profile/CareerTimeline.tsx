'use client';

import React from 'react';

export interface TournamentRecord {
    id: string;
    tournamentType: 'DAILY' | 'WEEKLY_SWISS' | 'MONTHLY_FINALS';
    title: string;
    date: string;
    placement: string; // e.g. 'CHAMPION', 'RUNNER-UP', 'TOP 4', 'TOP 16'
    medalTier: 'GOLD' | 'SILVER' | 'BRONZE' | 'ELITE';
    prizeWon?: string;
    kdaRatio: string;
    performanceScore: number;
    highlightHero: string;
}

interface CareerTimelineProps {
    records?: TournamentRecord[];
}

export function CareerTimeline({ records }: CareerTimelineProps) {
    const defaultRecords: TournamentRecord[] = [
        {
            id: 'rec-01',
            tournamentType: 'MONTHLY_FINALS',
            title: 'AVELAi Season 01 Grand Championship',
            date: '2026-08-15',
            placement: 'CHAMPION (1st Place)',
            medalTier: 'GOLD',
            prizeWon: '฿ 10,000 + Hall of Fame Badge',
            kdaRatio: '14.2 / 2.1 / 18.5',
            performanceScore: 4.95,
            highlightHero: 'Anti-Mage',
        },
        {
            id: 'rec-02',
            tournamentType: 'WEEKLY_SWISS',
            title: 'Weekly Swiss Playoff #03',
            date: '2026-08-10',
            placement: 'RUNNER-UP (2nd Place)',
            medalTier: 'SILVER',
            prizeWon: '฿ 3,500 + 500 Circuit Points',
            kdaRatio: '11.0 / 3.4 / 15.0',
            performanceScore: 4.60,
            highlightHero: 'Morphling',
        },
        {
            id: 'rec-03',
            tournamentType: 'WEEKLY_SWISS',
            title: 'Weekly Swiss Playoff #02',
            date: '2026-08-03',
            placement: 'TOP 4 (Semi-Finalist)',
            medalTier: 'BRONZE',
            prizeWon: '฿ 1,500 + 300 Circuit Points',
            kdaRatio: '9.5 / 4.0 / 12.8',
            performanceScore: 4.25,
            highlightHero: 'Faceless Void',
        },
        {
            id: 'rec-04',
            tournamentType: 'DAILY',
            title: 'Daily Arena Circuit - Day 18',
            date: '2026-07-28',
            placement: 'RANK #1 (Best of 5 Leaderboard)',
            medalTier: 'GOLD',
            prizeWon: '฿ 2,250',
            kdaRatio: '16.0 / 1.5 / 14.2',
            performanceScore: 4.88,
            highlightHero: 'Terrorblade',
        },
    ];

    const data = records && records.length > 0 ? records : defaultRecords;

    const getMedalBadge = (tier: TournamentRecord['medalTier']) => {
        switch (tier) {
            case 'GOLD':
                return {
                    label: '🥇 GOLD TROPHY',
                    border: 'border-amber-400/60',
                    bg: 'bg-amber-950/20',
                    text: 'text-amber-400',
                    glow: 'shadow-[0_0_15px_rgba(255,184,0,0.25)]',
                };
            case 'SILVER':
                return {
                    label: '🥈 SILVER MEDAL',
                    border: 'border-slate-400/60',
                    bg: 'bg-slate-900/40',
                    text: 'text-slate-300',
                    glow: 'shadow-[0_0_15px_rgba(203,213,225,0.2)]',
                };
            case 'BRONZE':
                return {
                    label: '🥉 BRONZE MEDAL',
                    border: 'border-amber-700/60',
                    bg: 'bg-amber-950/10',
                    text: 'text-amber-600',
                    glow: 'shadow-[0_0_15px_rgba(217,119,6,0.15)]',
                };
            default:
                return {
                    label: '🎖️ ARENA BADGE',
                    border: 'border-cyan-500/40',
                    bg: 'bg-cyan-950/20',
                    text: 'text-cyan-400',
                    glow: 'shadow-[0_0_15px_rgba(0,210,255,0.15)]',
                };
        }
    };

    return (
        <div className="bg-[#0D1117] border border-gray-800 rounded-2xl p-6 md:p-8 font-mono shadow-2xl space-y-6">
            {/* Header & Stats Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-800 pb-5 gap-4">
                <div>
                    <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                        ESPORTS PASSPORT 2.0 // CAREER
                    </span>
                    <h2 className="text-xl md:text-2xl font-black text-gray-100 mt-2 tracking-wide">
                        TOURNAMENT CAREER TIMELINE
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        ประวัติการแข่งขัน เกียรติประวัติ และเหรียญรางวัลในระบบ AVELAi Circuit
                    </p>
                </div>

                {/* Medals Tally Mini-Box */}
                <div className="flex items-center gap-3 bg-[#161B22] border border-gray-800 p-2.5 rounded-xl text-xs">
                    <div className="text-center px-2">
                        <div className="text-amber-400 font-black text-sm">2</div>
                        <div className="text-[10px] text-gray-500">GOLD</div>
                    </div>
                    <div className="w-px h-6 bg-gray-800" />
                    <div className="text-center px-2">
                        <div className="text-slate-300 font-black text-sm">1</div>
                        <div className="text-[10px] text-gray-500">SILVER</div>
                    </div>
                    <div className="w-px h-6 bg-gray-800" />
                    <div className="text-center px-2">
                        <div className="text-amber-600 font-black text-sm">1</div>
                        <div className="text-[10px] text-gray-500">BRONZE</div>
                    </div>
                </div>
            </div>

            {/* Vertical Timeline List */}
            <div className="relative pl-6 md:pl-8 border-l border-gray-800 space-y-8">
                {data.map((rec) => {
                    const badge = getMedalBadge(rec.medalTier);

                    return (
                        <div key={rec.id} className="relative group">
                            {/* Timeline Dot Indicator */}
                            <div
                                className={`absolute -left-[31px] md:-left-[39px] top-1.5 w-4 h-4 rounded-full border-2 bg-[#090D14] transition-all group-hover:scale-125 ${badge.border} ${badge.glow}`}
                            />

                            {/* Tournament Card Item */}
                            <div className={`p-5 rounded-xl border transition-all ${badge.border} ${badge.bg} ${badge.glow} hover:border-white/40`}>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-gray-800/80 pb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-black/60 border border-gray-700 text-gray-300 font-bold uppercase">
                                                {rec.tournamentType.replace('_', ' ')}
                                            </span>
                                            <span className={`text-xs font-black ${badge.text}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-base text-gray-100 mt-1">
                                            {rec.title}
                                        </h3>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-xs text-gray-400">{rec.date}</span>
                                        <div className="text-xs font-black text-amber-400 mt-0.5">{rec.placement}</div>
                                    </div>
                                </div>

                                {/* Performance & Prize Breakdown */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                                    <div className="bg-[#161B22]/80 p-2.5 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500">PRIZE WON</div>
                                        <div className="font-bold text-emerald-400 mt-0.5 truncate">{rec.prizeWon || '-'}</div>
                                    </div>

                                    <div className="bg-[#161B22]/80 p-2.5 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500">PERFORMANCE SCORE</div>
                                        <div className="font-bold text-cyan-400 mt-0.5">{rec.performanceScore.toFixed(2)} KP</div>
                                    </div>

                                    <div className="bg-[#161B22]/80 p-2.5 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500">AVG K / D / A</div>
                                        <div className="font-bold text-gray-300 mt-0.5">{rec.kdaRatio}</div>
                                    </div>

                                    <div className="bg-[#161B22]/80 p-2.5 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500">SIGNATURE HERO</div>
                                        <div className="font-bold text-gray-200 mt-0.5">{rec.highlightHero}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}