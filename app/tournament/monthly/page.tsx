'use client';

import React, { useState } from 'react';

interface CircuitPlayer {
    rank: number;
    name: string;
    circuitPoints: number;
    winRate: number;
    isQualified: boolean;
}

export default function MonthlyTournamentPage() {
    const [activeTab, setActiveTab] = useState<'double_elim' | 'circuit_rank' | 'season_info'>('double_elim');

    // ตาราง Circuit Points Top 16
    const [circuitRankings] = useState<CircuitPlayer[]>([
        { rank: 1, name: 'CyberShadow', circuitPoints: 260, winRate: 78.5, isQualified: true },
        { rank: 2, name: 'VortexSniper', circuitPoints: 220, winRate: 74.0, isQualified: true },
        { rank: 3, name: 'IronTide', circuitPoints: 185, winRate: 69.2, isQualified: true },
        { rank: 4, name: 'NeonHealer', circuitPoints: 155, winRate: 65.0, isQualified: true },
        { rank: 5, name: 'PhantomBlade', circuitPoints: 140, winRate: 62.1, isQualified: true },
        { rank: 6, name: 'StormStrike', circuitPoints: 125, winRate: 60.5, isQualified: true },
        { rank: 7, name: 'EchoBreaker', circuitPoints: 110, winRate: 58.0, isQualified: true },
        { rank: 8, name: 'Solaris', circuitPoints: 95, winRate: 55.4, isQualified: true },
    ]);

    return (
        <div className="min-h-screen bg-[#090D14] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Banner: Monthly Championship & Circuit Info */}
                <div className="relative overflow-hidden bg-gradient-to-r from-[#161B22] via-[#0D1117] to-[#1F242C] border border-amber-500/40 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                FEATURE-4300: MONTHLY CIRCUIT & FINALS
                            </span>
                            <h1 className="text-3xl font-black tracking-wide text-gray-100 mt-2">
                                MONTHLY CHAMPIONSHIP
                            </h1>
                            <p className="text-sm text-gray-400 mt-1 font-mono">
                                Circuit Points Top 16 • No Pay-to-Enter • Double Elimination Bracket
                            </p>
                        </div>

                        <div className="flex items-center gap-6 bg-[#0B0E14]/80 px-6 py-4 rounded-xl border border-gray-800">
                            <div className="text-right">
                                <div className="text-xs text-gray-400 font-mono">MONTHLY PRIZE POOL (40%)</div>
                                <div className="text-2xl font-black text-amber-400 font-mono">฿ 40,000</div>
                            </div>
                            <div className="border-l border-gray-700 pl-6 text-right">
                                <div className="text-xs text-gray-400 font-mono">SEASON PHASE</div>
                                <div className="text-lg font-black text-cyan-400 font-mono">WEEK 4 (FINALS)</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-4 border-b border-gray-800 pb-3">
                    <button
                        onClick={() => setActiveTab('double_elim')}
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'double_elim'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(255,184,0,0.2)]'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        DOUBLE ELIMINATION BRACKET
                    </button>
                    <button
                        onClick={() => setActiveTab('circuit_rank')}
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'circuit_rank'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(255,184,0,0.2)]'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        CIRCUIT POINTS LEADERBOARD (TOP 16)
                    </button>
                    <button
                        onClick={() => setActiveTab('season_info')}
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'season_info'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(255,184,0,0.2)]'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        SEASON RESET & KYC GATE
                    </button>
                </div>

                {/* Tab 1: Double Elimination Bracket Visualizer */}
                {activeTab === 'double_elim' && (
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 shadow-2xl space-y-6 font-mono">
                        {/* Upper Bracket */}
                        <div className="border border-cyan-500/30 rounded-xl p-4 bg-cyan-950/10">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Upper Bracket (Winners)
                                </span>
                                <span className="text-[11px] text-gray-400">Best of 3 (Bo3)</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-[#161B22] p-3 rounded-lg border border-gray-800 space-y-1">
                                    <div className="text-[10px] text-gray-500 uppercase">Upper Round 1</div>
                                    <div className="flex justify-between text-xs font-bold text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/40">
                                        <span>#1 CyberShadow</span><span>2</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 px-2 py-1">
                                        <span>#4 NeonHealer</span><span>1</span>
                                    </div>
                                </div>
                                <div className="bg-[#161B22] p-3 rounded-lg border border-gray-800 space-y-1">
                                    <div className="text-[10px] text-gray-500 uppercase">Upper Round 1</div>
                                    <div className="flex justify-between text-xs font-bold text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/40">
                                        <span>#2 VortexSniper</span><span>2</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 px-2 py-1">
                                        <span>#3 IronTide</span><span>0</span>
                                    </div>
                                </div>
                                <div className="bg-[#161B22] p-3 rounded-lg border border-amber-500/40 space-y-1 shadow-[0_0_15px_rgba(255,184,0,0.1)]">
                                    <div className="text-[10px] text-amber-400 uppercase font-bold">Upper Final</div>
                                    <div className="flex justify-between text-xs text-gray-300 px-2 py-1">
                                        <span>CyberShadow</span><span>-</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-300 px-2 py-1">
                                        <span>VortexSniper</span><span>-</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Lower Bracket */}
                        <div className="border border-amber-500/30 rounded-xl p-4 bg-amber-950/10">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Lower Bracket (Elimination)
                                </span>
                                <span className="text-[11px] text-gray-400">Loser Dropped Here</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#161B22] p-3 rounded-lg border border-gray-800 space-y-1">
                                    <div className="text-[10px] text-gray-500 uppercase">Lower Semifinal</div>
                                    <div className="flex justify-between text-xs text-gray-300 px-2 py-1">
                                        <span>NeonHealer</span><span>-</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-300 px-2 py-1">
                                        <span>IronTide</span><span>-</span>
                                    </div>
                                </div>
                                <div className="bg-[#161B22] p-3 rounded-lg border border-amber-500/40 space-y-1">
                                    <div className="text-[10px] text-amber-400 uppercase">Lower Final</div>
                                    <div className="flex justify-between text-xs text-gray-400 px-2 py-1">
                                        <span>Winner Lower SF</span><span>-</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 px-2 py-1">
                                        <span>Loser Upper Final</span><span>-</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grand Final & Bracket Reset Rule */}
                        <div className="bg-gradient-to-b from-[#1C1F26] to-[#12151B] border-2 border-amber-400 rounded-xl p-6 text-center shadow-[0_0_25px_rgba(255,184,0,0.2)]">
                            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
                                GRAND FINAL (BO3 + BRACKET RESET RULE)
                            </span>
                            <div className="text-xl font-black text-gray-100 mt-2">
                                Upper Winner vs Lower Winner
                            </div>
                            <p className="text-xs text-gray-400 mt-2 max-w-lg mx-auto">
                                *หากผู้ชนะจากสายล่างชนะในรอบแรก จะมีรอบตัดสินที่สอง (Bracket Reset) เพื่อความยุติธรรม
                            </p>
                            <div className="mt-4 inline-block text-xs font-bold text-black bg-amber-400 px-6 py-2 rounded-lg font-mono">
                                CHAMPION PRIZE: ฿ 10,000 + HALL OF FAME ถาวร
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Circuit Points Leaderboard */}
                {activeTab === 'circuit_rank' && (
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl overflow-hidden shadow-xl font-mono">
                        <div className="p-5 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-sm font-bold tracking-wider uppercase text-gray-300">
                                Top 16 Circuit Points Standings (Week 1-3)
                            </h2>
                            <span className="text-xs text-emerald-400">QUALIFIED FOR MONTHLY FINAL</span>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#161B22] text-xs text-gray-400 uppercase border-b border-gray-800">
                                <tr>
                                    <th className="py-3 px-4">Rank</th>
                                    <th className="py-3 px-4">Player</th>
                                    <th className="py-3 px-4">Circuit Points (CP)</th>
                                    <th className="py-3 px-4">Weekly Win Rate</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                                {circuitRankings.map((p) => (
                                    <tr key={p.rank} className="hover:bg-[#161B22]/50">
                                        <td className="py-3.5 px-4 font-bold text-amber-400">#{p.rank}</td>
                                        <td className="py-3.5 px-4 font-bold text-gray-200">{p.name}</td>
                                        <td className="py-3.5 px-4 font-bold text-cyan-400">{p.circuitPoints} CP</td>
                                        <td className="py-3.5 px-4 text-emerald-400">{p.winRate}%</td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="text-[11px] px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
                                                QUALIFIED
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 3: Season Reset & KYC Policy */}
                {activeTab === 'season_info' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
                        <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-cyan-400 uppercase">Season Soft Reset Protocol</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                การแข่งขันจัดขึ้นในรูปแบบซีซั่นรอบละ 3 เดือน เมื่อสิ้นสุดซีซั่น คะแนน Season KP จะถูก Soft Reset ตามสูตรมาตรฐาน:
                            </p>
                            <div className="p-3 bg-[#161B22] rounded-lg border border-cyan-500/30 text-cyan-300 text-sm font-bold text-center">
                                KP_new = (KP_old × 0.5) + 1000
                            </div>
                            <p className="text-[11px] text-gray-500">
                                *ช่วยให้ผู้เล่นหัวตารางยังคงมีความได้เปรียบเล็กน้อย แต่เปิดโอกาสให้ผู้เล่นใหม่ไต่ขึ้นมาท้าชิงได้
                            </p>
                        </div>

                        <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-amber-400 uppercase">KYC & Prize Payout Gateway</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                เงินรางวัลจากการแข่งขันทั้งหมดสามารถถอนผ่านระบบ PromptPay (TH) หรือ Bank Transfer โดยมีเงื่อนไขความปลอดภัย:
                            </p>
                            <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
                                <li>ต้องผ่านการยืนยันตัวตน KYC Gate ก่อนทำการเบิกเงินครั้งแรก</li>
                                <li>ระบบตัดรอบโอนเงินแบบ Batch รอบ 15:00 น. ทุกวันทำการ[cite: 5]</li>
                                <li>ไม่มีค่าธรรมเนียมแอบแฝง จ่ายตรงตามสัดส่วน Prize Pool[cite: 5]</li>
                            </ul>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}