'use client';

import OverviewTable from './OverviewTable';
import React, { useState } from 'react';
import TowerMapGrid from './TowerMapGrid';
import PerformanceRadar from './PerformanceRadar';
import { getHeroImageUrl, HERO_ID_TO_NAME } from '@/lib/dotaAssets';
import DeepAnalyticsBoard from './DeepAnalyticsBoard';
import SkillBuildBlock from './SkillBuildBlock';

interface MatchData {
    overviewPlayers: any[];
    kpPlayers: any[];
    performancePlayers: any[];
    towerStatusRadiant: number;
    towerStatusDire: number;
    barracksStatusRadiant: number;
    barracksStatusDire: number;
    radiantGoldAdv: number[];
    radiantXpAdv: number[];
    radiantScore?: number;
    direScore?: number;
    [key: string]: any;
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

    const getHeroImg = (heroId: number, heroName?: string): string => {
        const path = heroIdToImg[heroId];
        if (path) {
            return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
        }
        return getHeroImageUrl(heroName, heroId);
    };

    const getHeroDisplayName = (heroId?: number, heroName?: string): string => {
        if (heroId && HERO_ID_TO_NAME[heroId]) {
            return HERO_ID_TO_NAME[heroId]
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }
        if (heroName && !heroName.startsWith('hero_')) {
            return heroName.replace(/npc_dota_hero_|_/g, ' ').trim();
        }
        return heroId ? `Hero ${heroId}` : 'Hero';
    };

    const kpPlayers = [...(matchData.kpPlayers || matchData.overviewPlayers || [])]
        .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));

    const maxFinalScore = Math.max(...kpPlayers.map((p) => p.finalScore ?? 0), 1);
    const topPerformer = kpPlayers[0];

    const POS_COLORS: Record<string, string> = {
        'Pos 1': '#E8384F',
        'Pos 2': '#2E9BFF',
        'Pos 3': '#39FF6A',
        'Pos 4': '#D63CE8',
        'Pos 5': '#C8CDD4',
    };

    return (
        <div className="mt-6 flex flex-col gap-0">
            <div className="flex border-b border-[rgba(0,212,255,0.2)] font-orbitron text-xs tracking-widest">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-5 py-3 transition-all ${activeTab === tab.id
                            ? 'border-b-2 border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/5'
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
                    <div className="flex flex-col gap-6">
                        {topPerformer && (
                            <div className="border border-[#00D4FF]/30 bg-[#00D4FF]/5 px-4 py-2.5 font-mono text-xs text-[#00D4FF] flex items-center gap-2 shadow-[0_0_15px_rgba(0,212,255,0.08)]">
                                <span>👑</span>
                                <span>// TOP PERFORMER:</span>
                                <span className="font-bold text-white">{topPerformer.playerName}</span>
                                <span className="text-neutral-500">|</span>
                                <span>KP: <b className="text-[#00D4FF]">{topPerformer.totalKp?.toFixed(1)}</b></span>
                                <span className="text-neutral-500">|</span>
                                <span>FINAL SCORE: <b className="text-[#C9A84C]">{topPerformer.finalScore?.toFixed(1)}</b></span>
                            </div>
                        )}

                        {/* RENDER DUAL TABLES: RADIANT & DIRE */}
                        {[
                            {
                                name: 'THE RADIANT',
                                isRadiant: true,
                                color: '#00D4FF',
                                players: kpPlayers.filter((p) => (p.playerSlot ?? 0) < 128),
                            },
                            {
                                name: 'THE DIRE',
                                isRadiant: false,
                                color: '#C9A84C',
                                players: kpPlayers.filter((p) => (p.playerSlot ?? 0) >= 128),
                            },
                        ].map((team) => (
                            <div key={team.name} className="overflow-x-auto border border-neutral-800 bg-[#111118]/90 shadow-xl">
                                {/* Team Header Bar */}
                                <div
                                    className="px-4 py-2.5 bg-[#0A0A0F] border-b border-neutral-800 flex items-center justify-between font-orbitron text-xs font-bold tracking-wider"
                                    style={{ color: team.color }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}` }} />
                                        <span>{team.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-neutral-400">
                                        {team.players.some((p) => p.matchOutcome > 0) ? '🏆 VICTORY' : 'DEFEAT'}
                                    </span>
                                </div>

                                <table className="w-full text-left text-[11px] font-mono">
                                    <thead className="border-b border-neutral-800 bg-[#0E121A] text-[10px] text-neutral-400 font-bold">
                                        <tr>
                                            <th className="px-3 py-2.5 w-14">HERO</th>
                                            <th className="px-3 py-2.5">ROLE</th>
                                            <th className="px-3 py-2.5">PLAYER</th>
                                            <th className="px-3 py-2.5 text-center">K/D/A</th>
                                            <th className="px-3 py-2.5 text-center">TWR</th>
                                            <th className="px-3 py-2.5 text-right">BASE KP</th>
                                            <th className="px-3 py-2.5 text-center">MULT</th>
                                            <th className="px-3 py-2.5 text-right">ROLE BONUS</th>
                                            <th className="px-3 py-2.5 text-right" style={{ color: team.color }}>TOTAL KP</th>
                                            <th className="px-3 py-2.5 text-center">OUTCOME</th>
                                            <th className="px-3 py-2.5 text-right text-[#C9A84C]">FINAL</th>
                                            <th className="px-3 py-2.5 w-24"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800/40">
                                        {team.players.map((p, idx) => {
                                            const isWin = p.matchOutcome > 0;
                                            const posColor = POS_COLORS[p.role] ?? '#C8CDD4';
                                            const barWidth = Math.max(4, ((p.finalScore ?? 0) / maxFinalScore) * 100);
                                            const heroImg = getHeroImg(p.heroId, p.heroName);
                                            const isMvp = topPerformer?.playerSlot === p.playerSlot;

                                            return (
                                                <tr
                                                    key={idx}
                                                    className="transition-colors hover:bg-white/[0.02]"
                                                >
                                                    {/* 1. Hero Avatar with Team Glow */}
                                                    <td className="px-3 py-2.5">
                                                        <div
                                                            className="h-8 w-12 overflow-hidden rounded-xs bg-neutral-900 border shrink-0 transition-transform hover:scale-105"
                                                            style={{
                                                                borderColor: `${team.color}80`,
                                                                boxShadow: `0 0 8px ${team.color}30`,
                                                            }}
                                                        >
                                                            {heroImg ? (
                                                                <img
                                                                    src={heroImg}
                                                                    alt={p.heroName || 'hero'}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-500">
                                                                    ???
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* 2. Role */}
                                                    <td className="px-3 py-2.5">
                                                        <span
                                                            className="rounded-xs px-1.5 py-0.5 text-[9px] font-bold"
                                                            style={{ color: posColor, border: `1px solid ${posColor}40`, background: `${posColor}15` }}
                                                        >
                                                            {p.role ?? '—'}
                                                        </span>
                                                    </td>

                                                    {/* 3. Player Name + MVP Crown + Hero Name */}
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1 font-semibold leading-tight">
                                                            {isMvp && <span title="MVP (Highest KP)">👑</span>}
                                                            <span style={{ color: team.color }}>
                                                                {p.playerName}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-neutral-400 font-sans mt-0.5">
                                                            {getHeroDisplayName(p.heroId, p.heroName)}
                                                        </div>
                                                    </td>

                                                    {/* 4. K/D/A */}
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className="text-white font-bold">{p.kills}</span>/
                                                        <span className="font-bold text-[#E8384F]">{p.deaths}</span>/
                                                        <span className="text-neutral-400">{p.assists}</span>
                                                    </td>

                                                    <td className="px-3 py-2.5 text-center text-neutral-300">{p.towerKills ?? 0}</td>
                                                    <td className="px-3 py-2.5 text-right text-neutral-300">{p.baseKp?.toFixed(1)}</td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`rounded-xs px-1.5 py-0.5 text-[9px] font-bold ${isWin ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'}`}>
                                                            ×{p.resultMultiplier?.toFixed(1)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-neutral-400">+{p.roleBonus?.toFixed(1)}</td>
                                                    <td className="px-3 py-2.5 text-right font-bold" style={{ color: team.color }}>
                                                        {p.totalKp?.toFixed(1)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`rounded-xs px-1.5 py-0.5 text-[9px] font-bold ${isWin ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'}`}>
                                                            {isWin ? '+25' : '-10'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-bold text-[#C9A84C] text-sm">
                                                        {p.finalScore?.toFixed(1)}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="h-1.5 w-full rounded-full bg-neutral-800">
                                                            <div
                                                                className="h-1.5 rounded-full"
                                                                style={{ width: `${barWidth}%`, backgroundColor: team.color, boxShadow: `0 0 6px ${team.color}60` }}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB 2: OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="flex flex-col gap-4">
                        <OverviewTable
                            players={matchData.overviewPlayers}
                            heroIdToImg={heroIdToImg}
                            itemIdToName={itemIdToName}
                            draftTimeline={matchData.draftTimings}
                            radiantWin={matchData.radiantWin}
                        />
                        
                        <SkillBuildBlock 
                            players={matchData.overviewPlayers || matchData.players} 
                            heroIdToImg={heroIdToImg} 
                            itemIdToName={itemIdToName} 
                        />
                    </div>
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