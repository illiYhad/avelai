'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LeaderboardPlayer {
    rank: number;
    name: string;
    role: string;
    dailyKp: number;
    movement: 'up' | 'down' | 'same';
    presence: 'ave_online' | 'arena_ready' | 'in_game' | 'offline';
}

export default function DailyTournamentPage() {
    const router = useRouter();

    // State ตั๋วและสถิติของผู้ใช้
    const [userTickets, setUserTickets] = useState<number>(2); // ตั๋วคงเหลือ
    const [matchesPlayedToday, setMatchesPlayedToday] = useState<number>(3); // เล่นไปแล้ว X/5
    const [bestScoreToday, setBestScoreToday] = useState<number>(4.25);
    const [isProUser] = useState<boolean>(true);

    // Mock Live Leaderboard
    const [leaderboard] = useState<LeaderboardPlayer[]>([
        { rank: 1, name: 'CyberShadow', role: 'Pos 1 (Carry)', dailyKp: 4.85, movement: 'up', presence: 'in_game' },
        { rank: 2, name: 'VortexSniper', role: 'Pos 2 (Mid)', dailyKp: 4.60, movement: 'up', presence: 'arena_ready' },
        { rank: 3, name: 'IronTide', role: 'Pos 3 (Offlane)', dailyKp: 4.30, movement: 'same', presence: 'ave_online' },
        { rank: 4, name: 'NeonHealer', role: 'Pos 5 (Hard Sup)', dailyKp: 4.10, movement: 'down', presence: 'ave_online' },
        { rank: 5, name: 'GhostWard', role: 'Pos 4 (Soft Sup)', dailyKp: 3.95, movement: 'down', presence: 'offline' },
    ]);

    // ฟังก์ชันกด Enter Arena เพื่อไปห้องดราฟต์
    const handleEnterArena = () => {
        if (userTickets <= 0) {
            alert('ตั๋ว Arena Ticket ของคุณหมดแล้ว! ซื้อเพิ่มหรือรอรีเซ็ตรอบ 03:00 น.');
            return;
        }
        if (matchesPlayedToday >= 5) {
            alert('คุณลงแข่งครบโควตา Best-of-5 ของวันนี้แล้ว!');
            return;
        }

        // หักตั๋วและนำทางเข้าสู่ Session ห้อง Snake Draft
        setUserTickets((prev) => prev - 1);
        const mockSessionId = `DAILY-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        router.push(`/draft/${mockSessionId}`);
    };

    return (
        <div className="min-h-screen bg-[#090D14] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Banner: Daily Prize Pool & Countdown */}
                <div className="relative overflow-hidden bg-gradient-to-r from-[#161B22] via-[#0D1117] to-[#1F242C] border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                FEATURE-4100: DAILY ARENA
                            </span>
                            <h1 className="text-3xl font-black tracking-wide text-gray-100 mt-2">
                                DAILY TOURNAMENT LEADERBOARD
                            </h1>
                            <p className="text-sm text-gray-400 mt-1 font-mono">
                                Asynchronous Leaderboard • Best of 5 แมตช์แรกของวัน
                            </p>
                        </div>

                        <div className="flex items-center gap-6 bg-[#0B0E14]/80 px-6 py-4 rounded-xl border border-gray-800">
                            <div className="text-right">
                                <div className="text-xs text-gray-400 font-mono">DAILY PRIZE POOL (15%)</div>
                                <div className="text-2xl font-black text-amber-400 font-mono">฿ 15,000</div>
                            </div>
                            <div className="border-l border-gray-700 pl-6 text-right">
                                <div className="text-xs text-gray-400 font-mono">RESET IN</div>
                                <div className="text-2xl font-black text-cyan-400 font-mono">01:50:49</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* My Status Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#0D1117] border border-gray-800 rounded-xl p-4">
                    <div className="p-3 bg-[#161B22] rounded-lg">
                        <div className="text-xs text-gray-400 font-mono">ARENA TICKETS</div>
                        <div className="text-xl font-bold text-amber-400 mt-1">{userTickets} ใบ {isProUser && <span className="text-xs text-cyan-400 font-normal">(Pro)</span>}</div>
                    </div>
                    <div className="p-3 bg-[#161B22] rounded-lg">
                        <div className="text-xs text-gray-400 font-mono">TODAY MATCHES</div>
                        <div className="text-xl font-bold text-gray-200 mt-1">{matchesPlayedToday} / 5</div>
                    </div>
                    <div className="p-3 bg-[#161B22] rounded-lg">
                        <div className="text-xs text-gray-400 font-mono">TODAY BEST KP</div>
                        <div className="text-xl font-bold text-emerald-400 mt-1">{bestScoreToday.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center">
                        <button
                            onClick={handleEnterArena}
                            className="w-full h-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm rounded-lg tracking-wider transition-all shadow-[0_0_15px_rgba(255,184,0,0.3)] cursor-pointer"
                        >
                            ENTER ARENA (1 TICKET) →
                        </button>
                    </div>
                </div>

                {/* Live Leaderboard Table */}
                <div className="bg-[#0D1117] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                    <div className="p-5 border-b border-gray-800 flex justify-between items-center">
                        <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-gray-300">
                            Live Tournament Leaderboard
                        </h2>
                        <span className="text-xs font-mono text-cyan-400 animate-pulse">● LIVE UPDATING</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#161B22] text-xs font-mono text-gray-400 uppercase border-b border-gray-800">
                                <tr>
                                    <th className="py-3 px-4">Rank</th>
                                    <th className="py-3 px-4">Player Name</th>
                                    <th className="py-3 px-4">Role Badge</th>
                                    <th className="py-3 px-4">Daily KP / TP</th>
                                    <th className="py-3 px-4 text-center">Trend</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60 font-mono">
                                {leaderboard.map((item) => (
                                    <tr key={item.rank} className="hover:bg-[#161B22]/50 transition-colors">
                                        <td className="py-3.5 px-4 font-bold">
                                            {item.rank === 1 && <span className="text-amber-400">🥇 #1</span>}
                                            {item.rank === 2 && <span className="text-slate-300">🥈 #2</span>}
                                            {item.rank === 3 && <span className="text-amber-600">🥉 #3</span>}
                                            {item.rank > 3 && <span className="text-gray-400">#{item.rank}</span>}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-gray-200">
                                            {item.name}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-gray-400">
                                            {item.role}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-cyan-400">
                                            {item.dailyKp.toFixed(2)} TP
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-xs">
                                            {item.movement === 'up' && <span className="text-emerald-400">▲ +1</span>}
                                            {item.movement === 'down' && <span className="text-rose-400">▼ -1</span>}
                                            {item.movement === 'same' && <span className="text-gray-500">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}