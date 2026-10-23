'use client';

import React, { useState } from 'react';

interface SwissStanding {
    rank: number;
    name: string;
    record: string;
    tp: number;
    buchholz: number;
    status: 'active' | 'eliminated';
}

export default function WeeklyTournamentPage() {
    const [activeTab, setActiveTab] = useState<'swiss' | 'bracket'>('bracket');

    // ข้อมูล Swiss Standings
    const [standings] = useState<SwissStanding[]>([
        { rank: 1, name: 'CyberShadow', record: '5 - 0', tp: 120, buchholz: 18.5, status: 'active' },
        { rank: 2, name: 'VortexSniper', record: '4 - 1', tp: 95, buchholz: 16.0, status: 'active' },
        { rank: 3, name: 'IronTide', record: '4 - 1', tp: 90, buchholz: 15.5, status: 'active' },
        { rank: 4, name: 'NeonHealer', record: '3 - 2', tp: 75, buchholz: 14.0, status: 'active' },
        { rank: 5, name: 'PhantomBlade', record: '3 - 2', tp: 70, buchholz: 13.5, status: 'active' },
        { rank: 6, name: 'StormStrike', record: '3 - 2', tp: 68, buchholz: 12.0, status: 'active' },
        { rank: 7, name: 'EchoBreaker', record: '3 - 2', tp: 65, buchholz: 11.5, status: 'active' },
        { rank: 8, name: 'Solaris', record: '3 - 2', tp: 60, buchholz: 11.0, status: 'active' },
    ]);

    return (
        <div className="min-h-screen bg-[#090D14] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Banner: Weekly Pool & Swiss Header */}
                <div className="relative overflow-hidden bg-linear-to-r from-[#161B22] via-[#0D1117] to-[#1F242C] border border-cyan-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <span className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                                FEATURE-4200: WEEKLY SWISS & ELIMINATION
                            </span>
                            <h1 className="text-3xl font-black tracking-wide text-gray-100 mt-2">
                                WEEKLY TOURNAMENT
                            </h1>
                            <p className="text-sm text-gray-400 mt-1 font-mono">
                                Swiss 5-7 Rounds → Top 8 Single Elimination Bracket
                            </p>
                        </div>

                        <div className="flex items-center gap-6 bg-[#0B0E14]/80 px-6 py-4 rounded-xl border border-gray-800">
                            <div className="text-right">
                                <div className="text-xs text-gray-400 font-mono">WEEKLY PRIZE POOL (25%)</div>
                                <div className="text-2xl font-black text-amber-400 font-mono">฿ 25,000</div>
                            </div>
                            <div className="border-l border-gray-700 pl-6 text-right">
                                <div className="text-xs text-gray-400 font-mono">CURRENT PHASE</div>
                                <div className="text-lg font-black text-cyan-400 font-mono">TOP 8 PLAYOFFS</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-4 border-b border-gray-800 pb-3">
                    <button
                        onClick={() => setActiveTab('bracket')}
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'bracket'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,210,255,0.2)]'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        TOP 8 BRACKET VISUALIZER
                    </button>
                    <button
                        onClick={() => setActiveTab('swiss')}
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'swiss'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,210,255,0.2)]'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        SWISS STANDINGS TABLE
                    </button>
                </div>

                {/* Tab 1: Top 8 Bracket Visualizer (SVG Custom) */}
                {activeTab === 'bracket' && (
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 shadow-2xl overflow-x-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-mono font-bold uppercase text-gray-300">
                                Playoff Bracket (Single Elimination)
                            </h2>
                            <div className="flex items-center gap-4 text-xs font-mono">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Radiant / Advance</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-600"></span> Defeated (Dimmed)</span>
                            </div>
                        </div>

                        {/* SVG Interactive Bracket */}
                        <div className="min-w-175 flex justify-between items-center gap-6 py-4 font-mono">
                            {/* Quarterfinals */}
                            <div className="flex-1 space-y-6">
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quarterfinals (Bo1)</div>
                                {/* Match 1 */}
                                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-2.5 space-y-1.5">
                                    <div className="flex justify-between text-xs px-2 py-1 rounded bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 font-bold">
                                        <span>#1 CyberShadow</span><span>1</span>
                                    </div>
                                    <div className="flex justify-between text-xs px-2 py-1 rounded text-gray-500 opacity-40">
                                        <span>#8 Solaris</span><span>0</span>
                                    </div>
                                </div>
                                {/* Match 2 */}
                                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-2.5 space-y-1.5">
                                    <div className="flex justify-between text-xs px-2 py-1 rounded bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 font-bold">
                                        <span>#4 NeonHealer</span><span>1</span>
                                    </div>
                                    <div className="flex justify-between text-xs px-2 py-1 rounded text-gray-500 opacity-40">
                                        <span>#5 PhantomBlade</span><span>0</span>
                                    </div>
                                </div>
                            </div>

                            {/* Connector Line */}
                            <div className="text-gray-700 font-mono text-xl">➔</div>

                            {/* Semifinals */}
                            <div className="flex-1 space-y-12">
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Semifinals (Bo1)</div>
                                <div className="bg-[#161B22] border border-amber-500/40 rounded-lg p-3 space-y-2 shadow-[0_0_15px_rgba(255,184,0,0.1)]">
                                    <div className="flex justify-between text-xs px-2 py-1.5 rounded bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 font-bold">
                                        <span>CyberShadow</span><span>-</span>
                                    </div>
                                    <div className="flex justify-between text-xs px-2 py-1.5 rounded bg-gray-800 text-gray-300">
                                        <span>NeonHealer</span><span>-</span>
                                    </div>
                                </div>
                            </div>

                            {/* Connector Line */}
                            <div className="text-gray-700 font-mono text-xl">➔</div>

                            {/* Grand Final */}
                            <div className="flex-1">
                                <div className="text-xs text-amber-400 uppercase tracking-wider mb-2 font-bold">Grand Final</div>
                                <div className="bg-linear-to-b from-[#1C1F26] to-[#12151B] border-2 border-amber-400/80 rounded-xl p-4 text-center shadow-[0_0_25px_rgba(255,184,0,0.2)]">
                                    <div className="text-xs text-gray-400 font-mono">CHAMPION MATCH</div>
                                    <div className="text-base font-black text-amber-400 mt-2">TBD vs TBD</div>
                                    <div className="mt-3 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 py-1 rounded border border-emerald-500/30">
                                        PRIZE: ฿ 7,500 + 100 CP
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Swiss Standings Table */}
                {activeTab === 'swiss' && (
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                        <div className="p-5 border-b border-gray-800">
                            <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-gray-300">
                                Swiss Stage Standings (Round 5/5)
                            </h2>
                        </div>
                        <table className="w-full text-left text-sm font-mono">
                            <thead className="bg-[#161B22] text-xs text-gray-400 uppercase border-b border-gray-800">
                                <tr>
                                    <th className="py-3 px-4">Rank</th>
                                    <th className="py-3 px-4">Player</th>
                                    <th className="py-3 px-4">W - L Record</th>
                                    <th className="py-3 px-4">Points (TP)</th>
                                    <th className="py-3 px-4">Buchholz Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                                {standings.map((p) => (
                                    <tr key={p.rank} className="hover:bg-[#161B22]/50">
                                        <td className="py-3 px-4 font-bold text-amber-400">#{p.rank}</td>
                                        <td className="py-3 px-4 font-bold text-gray-200">{p.name}</td>
                                        <td className="py-3 px-4 text-emerald-400">{p.record}</td>
                                        <td className="py-3 px-4 font-bold text-cyan-400">{p.tp} TP</td>
                                        <td className="py-3 px-4 text-gray-400">{p.buchholz.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        </div>
    );
}