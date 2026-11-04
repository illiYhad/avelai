'use client';

import { POSITION_COLORS, POSITION_FALLBACK } from '@/lib/ui/colors';
import OverviewTable, { type DraftEntry, type OverviewPlayer } from './OverviewTable';
import React, { useState } from 'react';
import PerformanceRadar, { type PerformancePlayer } from './PerformanceRadar';
import DeepAnalyticsBoard, { type AnalyticsMatchData, type AnalyticsPlayer } from './DeepAnalyticsBoard';
import type { PlayerKPData } from './KPBreakdownTable';

/** K-AV-POLISH: ผู้เล่นหนึ่งคนหลังแปลงจาก OpenDota (app/match/[matchId]/page.tsx) — ชุดเดียวใช้ได้ทุกแท็บ */
export type MatchPlayer = OverviewPlayer & PlayerKPData & PerformancePlayer & AnalyticsPlayer;

export interface MatchData extends AnalyticsMatchData {
    matchId: string;
    radiantWin: boolean;
    duration: number;
    overviewPlayers: MatchPlayer[];
    kpPlayers: MatchPlayer[];
    performancePlayers: MatchPlayer[];
    players?: MatchPlayer[];
    draftTimings?: DraftEntry[];
    radiantTowersKilled?: number;
    direTowersKilled?: number;
    towerStatusRadiant: number;
    towerStatusDire: number;
    barracksStatusRadiant: number;
    barracksStatusDire: number;
    radiantGoldAdv: number[];
    radiantXpAdv: number[];
    radiantScore: number;
    direScore: number;
}

interface MatchDetailViewProps {
    matchData: MatchData;
    heroIdToImg?: Record<number, string>;
    itemIdToName?: Record<number, string>;
}

type TabId = 'kp' | 'overview' | 'advantage' | 'performance';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'kp', label: 'KP INTEL', icon: '👑' },
    { id: 'overview', label: 'OVERVIEW', icon: '📊' },
    { id: 'advantage', label: 'ADVANTAGE', icon: '📈' },
    { id: 'performance', label: 'PERFORMANCE', icon: '⚙️' },
];

export default function MatchDetailView({
    matchData,
    heroIdToImg = {},
    itemIdToName = {},
}: MatchDetailViewProps) {
    const [activeTab, setActiveTab] = useState<TabId>('kp');

    const getHeroImg = (heroId: number): string => {
        const path = heroIdToImg[heroId];
        if (!path) return '';
        return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
    };

    const kpPlayers = [...(matchData.kpPlayers || matchData.overviewPlayers || [])]
        .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));

    const maxFinalScore = Math.max(...kpPlayers.map((p) => p.finalScore ?? 0), 1);
    const topPerformer = kpPlayers[0];

    const POS_COLORS = POSITION_COLORS; // K-AV-POLISH: ไฟล์เดียว lib/ui/colors.ts

    return (
        <div className="mt-6 flex flex-col gap-0">
            <div className="flex overflow-x-auto border-b border-cyan/20 font-orbitron text-xs tracking-widest">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-5 py-3 transition-all ${activeTab === tab.id
                            ? 'border-b-2 border-cyan text-cyan bg-cyan/5'
                            : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/20'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="pt-6">
                {/* TAB 1: KP INTEL */}
                {activeTab === 'kp' && (
                    <div className="flex flex-col gap-4">
                        {topPerformer && (
                            <div className="border border-cyan/30 bg-cyan/5 px-4 py-2 font-mono text-xs text-cyan">
                                {'// TOP PERFORMER: '}
                                <span className="font-bold">{topPerformer.playerName}</span>
                                {' — KP: '}
                                <span className="font-bold">{topPerformer.totalKp?.toFixed(1)}</span>
                                {' | FINAL SCORE: '}
                                <span className="font-bold">{topPerformer.finalScore?.toFixed(1)}</span>
                            </div>
                        )}

                        <div className="overflow-x-auto border border-cyan/20 bg-surface-2">
                            <table className="w-full text-left text-xs font-mono">
                                <thead className="border-b border-neutral-800 bg-void font-orbitron text-xs text-cyan">
                                    <tr>
                                        <th className="px-3 py-3 w-14">HERO</th>
                                        <th className="px-3 py-3">ROLE</th>
                                        <th className="px-3 py-3">PLAYER</th>
                                        <th className="px-3 py-3 text-center">K/D/A</th>
                                        <th className="px-3 py-3 text-center">TWR</th>
                                        <th className="px-3 py-3 text-right">BASE KP</th>
                                        <th className="px-3 py-3 text-center">MULT</th>
                                        <th className="px-3 py-3 text-right">ROLE BONUS</th>
                                        <th className="px-3 py-3 text-right text-cyan">TOTAL KP</th>
                                        <th className="px-3 py-3 text-center">OUTCOME</th>
                                        <th className="px-3 py-3 text-right text-gold">FINAL</th>
                                        <th className="px-3 py-3 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800/50">
                                    {kpPlayers.map((p, idx) => {
                                        const isRadiant = (p.playerSlot ?? 0) < 128;
                                        const isWin = p.matchOutcome > 0;
                                        const posColor = POS_COLORS[p.role] ?? POSITION_FALLBACK;
                                        const barWidth = Math.max(4, ((p.finalScore ?? 0) / maxFinalScore) * 100);
                                        const heroImg = getHeroImg(p.heroId);

                                        return (
                                            <tr
                                                key={idx}
                                                className={`transition-colors hover:bg-cyan/5 ${p.isRegisteredUser ? 'shadow-[inset_2px_0_0_var(--color-cyan)]' : ''
                                                    } ${isRadiant ? 'bg-cyan/5' : 'bg-gold/5'}`}
                                            >
                                                <td className="px-3 py-2.5">
                                                    <div className="h-7 w-12 overflow-hidden border border-neutral-700 bg-neutral-900">
                                                        {heroImg ? (
                                                            // eslint-disable-next-line @next/next/no-img-element -- K-AV-POLISH: รูปจาก CDN ภายนอก ยังไม่มี images.remotePatterns ใน next.config
                                                            <img
                                                                src={heroImg}
                                                                alt={p.heroName || 'hero'}
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <span className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                                                                {p.heroName?.substring(0, 3).toUpperCase() || '???'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span
                                                        className="rounded-sm px-1.5 py-0.5 text-xs font-bold"
                                                        style={{ color: posColor, border: `1px solid ${posColor}40`, background: `${posColor}15` }}
                                                    >
                                                        {p.role ?? '—'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 font-semibold">
                                                    <span className={isRadiant ? 'text-cyan' : 'text-gold'}>
                                                        {p.playerName}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className="text-white">{p.kills}</span>/
                                                    <span className="font-bold text-rose-500">{p.deaths}</span>/
                                                    <span className="text-neutral-400">{p.assists}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center text-neutral-300">{p.towerKills ?? 0}</td>
                                                <td className="px-3 py-2.5 text-right text-neutral-300">{p.baseKp?.toFixed(1)}</td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${isWin ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'
                                                        }`}>
                                                        ×{p.resultMultiplier?.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-neutral-400">+{p.roleBonus?.toFixed(1)}</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-cyan">
                                                    {p.totalKp?.toFixed(1)}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${isWin ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'
                                                        }`}>
                                                        {isWin ? '+25' : '-10'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-gold text-sm">
                                                    {p.finalScore?.toFixed(1)}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="h-1.5 w-full rounded-full bg-neutral-800">
                                                        <div
                                                            className="h-1.5 rounded-full bg-cyan"
                                                            style={{ width: `${barWidth}%` }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: OVERVIEW */}
                {activeTab === 'overview' && (
                    <OverviewTable
                        players={matchData.overviewPlayers}
                        heroIdToImg={heroIdToImg}
                        itemIdToName={itemIdToName}
                        draftTimeline={matchData.draftTimings}
                        radiantWin={matchData.radiantWin}
                    />
                )}

                {/* TAB 3: ADVANTAGE / DEEP ANALYTICS */}
                {activeTab === 'advantage' && (
                    <DeepAnalyticsBoard
                        matchData={matchData}
                        players={matchData.overviewPlayers || matchData.players}
                        heroIdToImg={heroIdToImg}
                        itemIdToName={itemIdToName}
                    />
                )}

                {/* TAB 4: PERFORMANCE */}
                {activeTab === 'performance' && (
                    <PerformanceRadar
                        players={matchData.performancePlayers || matchData.players}
                        radiantScore={matchData.radiantScore}
                        direScore={matchData.direScore}
                        heroIdToImg={heroIdToImg}
                    />
                )}
            </div>
        </div>
    );
}