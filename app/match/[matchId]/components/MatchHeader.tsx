import React from 'react';
import Link from 'next/link';

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
    // แปลงวินาทีเป็น MM:SS
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="mb-6 space-y-4 font-mono">
            {/* 🔹 Top Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#00D4FF]/30 pb-4">
                <Link
                    href="/match-history"
                    className="text-xs text-[#00D4FF] hover:underline flex items-center gap-1 font-orbitron transition-all hover:text-white"
                >
                    [← BACK TO HISTORY]
                </Link>
                <div className="flex items-center gap-3">
                    <span className="font-orbitron font-bold text-lg text-white">
                        MATCH #{matchId}
                    </span>
                    <span
                        className={`px-2 py-0.5 text-xs font-bold uppercase rounded ${radiantWin
                            ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                            : 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/50'
                            }`}
                    >
                        [{radiantWin ? 'RADIANT VICTORY' : 'DIRE VICTORY'}]
                    </span>
                    <span className="text-xs text-neutral-400 bg-neutral-900/80 px-2 py-0.5 border border-neutral-800">
                        DURATION: {formatDuration(duration)}
                    </span>
                </div>
            </div>

            {/* 🔹 Team Score Panels (Prototype A Layout) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Radiant Side */}
                <div className="p-4 bg-[#111118] border border-[#00D4FF]/30 bg-[#00D4FF]/[0.04] flex items-center justify-between">
                    <div>
                        <h2 className="font-orbitron font-bold text-sm tracking-wider text-[#00D4FF]">
                            RADIANT
                        </h2>
                        <p className="text-xs text-neutral-400">THE SENTINEL</p>
                    </div>
                    <div className="text-right">
                        <span className="font-mono text-3xl font-bold text-[#00D4FF]">
                            {radiantScore}
                        </span>
                        <span className="text-xs text-neutral-500 block">KILLS</span>
                    </div>
                </div>

                {/* Dire Side */}
                <div className="p-4 bg-[#111118] border border-[#C9A84C]/30 bg-[#C9A84C]/[0.04] flex items-center justify-between">
                    <div>
                        <h2 className="font-orbitron font-bold text-sm tracking-wider text-[#C9A84C]">
                            DIRE
                        </h2>
                        <p className="text-xs text-neutral-400">THE SCOURGE</p>
                    </div>
                    <div className="text-right">
                        <span className="font-mono text-3xl font-bold text-[#C9A84C]">
                            {direScore}
                        </span>
                        <span className="text-xs text-neutral-500 block">KILLS</span>
                    </div>
                </div>
            </div>
        </div>
    );
}