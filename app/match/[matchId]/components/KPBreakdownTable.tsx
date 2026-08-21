import React from 'react';

export interface PlayerKPData {
    playerSlot: number;
    heroId: number;
    heroName: string;
    role: string;
    playerName: string;
    isRegisteredUser: boolean;
    kills: number;
    deaths: number;
    assists: number;
    towerKills: number;
    baseKp: number;
    resultMultiplier: number;
    roleBonus: number;
    totalKp: number;
    matchOutcome: number;
    finalScore: number;
}

interface KPBreakdownTableProps {
    players: PlayerKPData[];
    radiantWin: boolean;
}

export default function KPBreakdownTable({ players = [], radiantWin }: KPBreakdownTableProps) {
    const sortedPlayers = [...players].sort((a, b) => b.finalScore - a.finalScore);
    const maxScore = Math.max(...players.map((p) => p.finalScore), 1);
    const topPerformer = sortedPlayers[0];

    return (
        <div className="space-y-6 font-mono text-sm">
            {topPerformer && (
                <div className="p-3 bg-[#111118] border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-between">
                    <span className="font-orbitron font-bold">
                        {`// TOP PERFORMER: ${topPerformer.playerName} — KP: ${topPerformer.totalKp.toFixed(1)}`}
                    </span>
                    <span className="text-xs bg-[#00D4FF]/20 px-2 py-0.5 border border-[#00D4FF]/50 text-white font-bold">
                        MATCH MVP
                    </span>
                </div>
            )}

            <div className="overflow-x-auto border border-[#00D4FF]/30 bg-[#111118]">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                        <tr className="border-b border-[#00D4FF]/30 bg-[#0A0A0F] font-orbitron text-xs text-[#00D4FF]">
                            <th className="p-3">HERO / ROLE</th>
                            <th className="p-3">PLAYER</th>
                            <th className="p-3 text-center">K / D / A</th>
                            <th className="p-3 text-center">TOWERS</th>
                            <th className="p-3 text-right">BASE KP</th>
                            <th className="p-3 text-center">MULT</th>
                            <th className="p-3 text-right">BONUS</th>
                            <th className="p-3 text-right font-bold">TOTAL KP</th>
                            <th className="p-3 text-center">OUTCOME</th>
                            <th className="p-3 text-right font-bold">FINAL SCORE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {sortedPlayers.map((player) => {
                            const isRadiant = player.playerSlot < 128;
                            const barWidth = Math.max((player.finalScore / maxScore) * 100, 5);

                            return (
                                <tr
                                    key={player.playerSlot}
                                    className={`transition-colors hover:bg-cyan-900/20 hover:border-l-2 hover:border-l-[#00D4FF] ${isRadiant ? 'bg-[#00D4FF]/[0.02]' : 'bg-[#C9A84C]/[0.02]'
                                        } ${player.isRegisteredUser
                                            ? 'shadow-[inset_0_0_12px_rgba(0,212,255,0.15)] border-l-2 border-l-[#00D4FF]'
                                            : ''
                                        }`}
                                >
                                    <td className="p-3 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-400">
                                            {player.heroName.substring(0, 3).toUpperCase()}
                                        </div>
                                        <span className="text-[10px] px-1.5 py-0.5 border border-neutral-700 bg-neutral-900 text-neutral-300">
                                            {player.role}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className={`font-medium ${player.isRegisteredUser ? 'text-[#00D4FF] font-bold' : 'text-neutral-300'}`}>
                                            {player.playerName}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center text-neutral-300">
                                        {player.kills} / <span className="text-red-400">{player.deaths}</span> / {player.assists}
                                    </td>
                                    <td className="p-3 text-center text-neutral-300">🏯 {player.towerKills}</td>
                                    <td className="p-3 text-right text-neutral-400">{player.baseKp.toFixed(1)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-1.5 py-0.5 text-[10px] font-bold ${player.resultMultiplier === 1.0
                                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                            : 'bg-red-950 text-red-400 border border-red-800'
                                            }`}>
                                            ×{player.resultMultiplier.toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right text-neutral-400">+{player.roleBonus.toFixed(1)}</td>
                                    <td className="p-3 text-right font-bold text-[#00D4FF]">{player.totalKp.toFixed(1)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`text-xs font-bold ${player.matchOutcome > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {player.matchOutcome > 0 ? `+${player.matchOutcome}` : player.matchOutcome}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-orbitron font-bold text-base text-white">{player.finalScore.toFixed(1)}</span>
                                            <div className="w-24 h-1.5 bg-neutral-800 overflow-hidden">
                                                <div className="h-full bg-[#00D4FF]" style={{ width: `${barWidth}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}