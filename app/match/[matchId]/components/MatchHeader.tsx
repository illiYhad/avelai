'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Clock, Swords } from 'lucide-react';

interface MatchHeaderProps {
    matchId: string;
    radiantWin: boolean;
    duration: number;
    radiantScore: number;
    direScore: number;
}

export default function MatchHeader({
    matchId,
    radiantWin,
    duration,
    radiantScore,
    direScore,
}: MatchHeaderProps) {
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="mb-6 space-y-4 font-mono">
            {/* Top Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#00D4FF]/30 pb-4">
                <Link
                    href="/match-history"
                    className="text-xs text-[#00D4FF] hover:text-white flex items-center gap-1.5 font-bold transition-all group cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                    <span>BACK TO MATCH HISTORY</span>
                </Link>

                <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-base md:text-lg text-white tracking-wider flex items-center gap-1.5">
                        <Swords className="w-4 h-4 text-[#C9A84C]" />
                        MATCH #{matchId}
                    </span>

                    <span
                        className={`px-2.5 py-1 text-xs font-black uppercase rounded-md border flex items-center gap-1 shadow-sm ${radiantWin
                                ? 'bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/50 shadow-[0_0_10px_rgba(0,212,255,0.2)]'
                                : 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/50 shadow-[0_0_10px_rgba(201,168,76,0.2)]'
                            }`}
                    >
                        <Trophy className="w-3 h-3" />
                        {radiantWin ? 'RADIANT VICTORY' : 'DIRE VICTORY'}
                    </span>

                    <span className="text-xs text-neutral-400 bg-neutral-900/90 px-2.5 py-1 border border-neutral-800 rounded-md flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        DURATION: {formatDuration(duration)}
                    </span>
                </div>
            </div>

            {/* Team Score Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Radiant Side */}
                <div className={`p-4 rounded-xl border transition-all flex items-center justify-between bg-linear-to-r from-[#111118] to-slate-950 ${radiantWin
                        ? 'border-[#00D4FF]/60 shadow-[0_0_20px_rgba(0,212,255,0.15)]'
                        : 'border-neutral-800 opacity-80'
                    }`}>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
                            <h2 className="font-bold text-sm tracking-wider text-[#00D4FF]">
                                THE RADIANT
                            </h2>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">ORIGIN SENTINEL</p>
                    </div>
                    <div className="text-right">
                        <span className="font-mono text-3xl font-black text-[#00D4FF]">
                            {radiantScore}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-bold block tracking-widest">KILLS</span>
                    </div>
                </div>

                {/* Dire Side */}
                <div className={`p-4 rounded-xl border transition-all flex items-center justify-between bg-linear-to-r from-slate-950 to-[#111118] ${!radiantWin
                        ? 'border-[#C9A84C]/60 shadow-[0_0_20px_rgba(201,168,76,0.15)]'
                        : 'border-neutral-800 opacity-80'
                    }`}>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
                            <h2 className="font-bold text-sm tracking-wider text-[#C9A84C]">
                                THE DIRE
                            </h2>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">ORIGIN SCOURGE</p>
                    </div>
                    <div className="text-right">
                        <span className="font-mono text-3xl font-black text-[#C9A84C]">
                            {direScore}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-bold block tracking-widest">KILLS</span>
                    </div>
                </div>
            </div>
        </div>
    );
}