'use client';

import React from 'react';
import { getHeroImageUrl } from '@/lib/dotaAssets';

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
    players?: PlayerKPData[];
}

export default function KPBreakdownTable({ players = [] }: KPBreakdownTableProps) {
    const sortedPlayers = [...players].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    const topPerformer = sortedPlayers[0];

    return (
        <div className="space-y-4 font-mono">
            {topPerformer && (
                <div className="flex items-center justify-between border border-[#00D4FF]/40 bg-[#00D4FF]/5 px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
            // TOP PERFORMER: {topPerformer.playerName} — KP: {topPerformer.totalKp?.toFixed(1)}
                    </span>
                    <span className="border border-[#00D4FF] bg-[#00D4FF]/20 px-2 py-0.5 font-orbitron text-[10px] font-bold text-[#00D4FF]">
                        MATCH MVP
                    </span>
                </div>
            )}

            <div className="overflow-x-auto border border-neutral-800 bg-[#111118]">
                <table className="w-full text-left text-xs">
                    <thead className="border-b border-neutral-800 bg-[#0A0A0F] font-orbitron text-[11px] text-[#00D4FF]">
                        <tr>
                            <th className="px-4 py-3">HERO / ROLE</th>
                            <th className="px-4 py-3">PLAYER</th>
                            <th className="px-4 py-3 text-center">K / D / A</th>
                            <th className="px-4 py-3 text-center">TOWERS</th>
                            <th className="px-4 py-3 text-right">BASE KP</th>
                            <th className="px-4 py-3 text-center">MULT</th>
                            <th className="px-4 py-3 text-right">BONUS</th>
                            <th className="px-4 py-3 text-right text-[#00D4FF]">TOTAL KP</th>
                            <th className="px-4 py-3 text-center">OUTCOME</th>
                            <th className="px-4 py-3 text-right">FINAL SCORE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                        {sortedPlayers.map((p, idx) => {
                            const isRadiant = (p.playerSlot || 0) < 128;
                            const heroImg = getHeroImageUrl(p.heroName, p.heroId);

                            return (
                                <tr
                                    key={idx}
                                    className={`transition-colors hover:bg-neutral-800/30 ${p.isRegisteredUser ? 'border-l-2 border-[#00D4FF] bg-[#00D4FF]/5' : ''
                                        }`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="relative h-6 w-10 overflow-hidden border border-neutral-800 bg-neutral-900">
                                                {heroImg ? (
                                                    <img
                                                        src={heroImg}
                                                        alt={p.heroName || 'hero'}
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLElement).style.display = 'none';
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center text-[8px] text-neutral-400">
                                                        {p.heroName?.substring(0, 3).toUpperCase() || 'HER'}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="border border-neutral-800 bg-neutral-900/60 px-1.5 py-0.5 text-[9px] text-neutral-300">
                                                {p.role}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold">
                                        <span className={isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}>
                                            {p.playerName}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-white">{p.kills}</span> /{' '}
                                        <span className="text-rose-500 font-bold">{p.deaths}</span> /{' '}
                                        <span className="text-neutral-400">{p.assists}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-neutral-400">
                                        <span className="mr-1 text-[10px] text-rose-400">🏯</span>
                                        {p.towerKills || 0}
                                    </td>
                                    <td className="px-4 py-3 text-right text-neutral-400">
                                        {p.baseKp?.toFixed(1) || '0.0'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`px-1 py-0.5 text-[9px] font-bold ${p.resultMultiplier === 1.0
                                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                                    : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                                                }`}
                                        >
                                            ×{p.resultMultiplier?.toFixed(1) || '1.0'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-neutral-400">
                                        +{p.roleBonus?.toFixed(1) || '0.0'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-[#00D4FF]">
                                        {p.totalKp?.toFixed(1) || '0.0'}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">
                                        <span
                                            className={
                                                (p.matchOutcome || 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'
                                            }
                                        >
                                            {(p.matchOutcome || 0) >= 0 ? `+${p.matchOutcome}` : p.matchOutcome}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-orbitron font-bold text-white">
                                                {p.finalScore?.toFixed(1) || '0.0'}
                                            </span>
                                            <div className="h-1 w-16 bg-neutral-800 overflow-hidden">
                                                <div
                                                    className={`h-full ${isRadiant ? 'bg-[#00D4FF]' : 'bg-[#C9A84C]'
                                                        }`}
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            Math.max(0, ((p.finalScore || 0) / 60) * 100)
                                                        )}%`,
                                                    }}
                                                />
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