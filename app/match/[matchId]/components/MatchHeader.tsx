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
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan/30 pb-4">
                <Link
                    href="/match-history"
                    className="text-xs text-cyan hover:text-white flex items-center gap-1.5 font-bold transition-all group cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                    <span>BACK TO MATCH HISTORY</span>
                </Link>

                <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-base md:text-lg text-white tracking-wider flex items-center gap-1.5">
                        <Swords className="w-4 h-4 text-gold" />
                        MATCH #{matchId}
                    </span>

                    <span
                        className={`px-2.5 py-1 text-xs font-black uppercase rounded-md border flex items-center gap-1 shadow-sm ${radiantWin
                                ? 'bg-cyan/15 text-cyan border-cyan/50 shadow-glow-cyan'
                                : 'bg-gold/15 text-gold border-gold/50 shadow-glow-gold'
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
                <div className={`p-4 rounded-xl border transition-all flex items-center justify-between bg-linear-to-r from-surface-2 to-slate-950 ${radiantWin
                        ? 'border-cyan/60 shadow-glow-cyan'
                        : 'border-neutral-800 opacity-80'
                    }`}>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                            <h2 className="font-bold text-sm tracking-wider text-cyan">
                                THE RADIANT
                            </h2>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">ORIGIN SENTINEL</p>
                    </div>
                    <div className="text-right">
                        <span className="font-mono text-3xl font-black text-cyan">
                            {radiantScore}
                        </span>
                        <span className="text-xs text-neutral-500 font-bold block tracking-widest">KILLS</span>
                    </div>
                </div>

                {/* Dire Side */}
                <div className={`p-4 rounded-xl border transition-all flex items-center justify-between bg-linear-to-r from-slate-950 to-surface-2 ${!radiantWin
                        ? 'border-gold/60 shadow-glow-gold'
                        : 'border-neutral-800 opacity-80'
                    }`}>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                            <h2 className="font-bold text-sm tracking-wider text-gold">
                                THE DIRE
                            </h2>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">ORIGIN SCOURGE</p>
                    </div>
                    <div className="text-right">
                        <span className="font-mono text-3xl font-black text-gold">
                            {direScore}
                        </span>
                        <span className="text-xs text-neutral-500 font-bold block tracking-widest">KILLS</span>
                    </div>
                </div>
            </div>
        </div>
    );
}