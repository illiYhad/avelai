'use client';

import React, { useState } from 'react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

export interface PerformancePlayer {
    playerSlot: number;
    heroId?: number;
    playerName: string;
    heroName: string;
    role: string;
    kills: number;
    deaths: number;
    assists: number;
    totalKp: number;
    towerKills?: number;
    tower_kills?: number;
    towers?: number;
    towerDamage?: number;
    tower_damage?: number;
    heroDamage: number;
    heroHealing: number;
}

interface PerformanceRadarProps {
    players?: PerformancePlayer[];
    radiantScore?: number;
    direScore?: number;
    heroIdToImg?: Record<number, string>;
}

const POS_COLORS: Record<string, string> = {
    'Pos 1': '#E8384F',
    'Pos 2': '#2E9BFF',
    'Pos 3': '#39FF6A',
    'Pos 4': '#D63CE8',
    'Pos 5': '#C8CDD4',
};

const HERO_DATA_MAP: Record<number, { name: string; shortName: string }> = {
    1: { name: 'Anti-Mage', shortName: 'antimage' },
    2: { name: 'Axe', shortName: 'axe' },
    6: { name: 'Drow Ranger', shortName: 'drow_ranger' },
    14: { name: 'Pudge', shortName: 'pudge' },
    22: { name: 'Zeus', shortName: 'zuus' },
    74: { name: 'Invoker', shortName: 'invoker' },
    76: { name: 'Outworld Destroyer', shortName: 'obsidian_destroyer' },
    84: { name: 'Ogre Magi', shortName: 'ogre_magi' },
    90: { name: 'Keeper of the Light', shortName: 'keeper_of_the_light' },
    93: { name: 'Slark', shortName: 'slark' },
    96: { name: 'Centaur Warrunner', shortName: 'centaur' },
    121: { name: 'Grimstroke', shortName: 'grimstroke' },
    137: { name: 'Primal Beast', shortName: 'primal_beast' },
};

export default function PerformanceRadar({
    players = [],
    radiantScore = 0,
    direScore = 0,
    heroIdToImg = {},
}: PerformanceRadarProps) {
    const sortedPlayers = [...players].sort((a, b) => (a.playerSlot || 0) - (b.playerSlot || 0));
    const radiantPlayers = sortedPlayers.filter((p) => (p.playerSlot || 0) < 128);
    const direPlayers = sortedPlayers.filter((p) => (p.playerSlot || 0) >= 128);

    const [selectedSlots, setSelectedSlots] = useState<number[]>(() => {
        const radiantPlayer = sortedPlayers.find((p) => (p.playerSlot || 0) < 128);
        const direPlayer = sortedPlayers.find((p) => (p.playerSlot || 0) >= 128);
        const defaults: number[] = [];
        if (radiantPlayer) defaults.push(radiantPlayer.playerSlot);
        if (direPlayer) defaults.push(direPlayer.playerSlot);
        return defaults.length > 0 ? defaults : sortedPlayers.slice(0, 2).map((p) => p.playerSlot);
    });

    const togglePlayer = (slot: number) => {
        setSelectedSlots((prev) =>
            prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
        );
    };

    const getHeroImg = (p: PerformancePlayer) => {
        if (p.heroId && heroIdToImg[p.heroId]) {
            const path = heroIdToImg[p.heroId];
            return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
        }
        if (p.heroId && HERO_DATA_MAP[p.heroId]) {
            return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${HERO_DATA_MAP[p.heroId].shortName}.png`;
        }
        return '';
    };

    const getHeroDisplayName = (p: PerformancePlayer) => {
        if (p.heroId && HERO_DATA_MAP[p.heroId]) {
            return HERO_DATA_MAP[p.heroId].name;
        }
        return p.heroName || (p.heroId ? `Hero #${p.heroId}` : 'Hero');
    };

    const getTowerKills = (p: any) => {
        const dmg = p.tower_damage ?? p.towerDamage ?? p.bld ?? 0;
        const directKills = p.tower_kills ?? p.towerKills ?? p.towers;

        if (directKills && Number(directKills) > 0) return Number(directKills);
        if (dmg > 0) {
            if (dmg >= 8000) return Math.min(6, Math.floor(dmg / 2200) + 1);
            if (dmg >= 3000) return 3;
            if (dmg >= 1000) return 2;
            if (dmg >= 300) return 1;
        }
        return 0;
    };

    const radarCategories = [
        { key: 'fightPart', label: 'Fight Part %' },
        { key: 'kpDeath', label: 'KP / Death' },
        { key: 'towerPush', label: 'Tower Push' },
        { key: 'dmgEff', label: 'DMG Efficiency' },
        { key: 'healing', label: 'Healing' },
    ];

    const chartData = radarCategories.map((cat) => {
        const row: Record<string, any> = { subject: cat.label };
        sortedPlayers.forEach((p) => {
            let val = 0;
            const isRadiant = (p.playerSlot || 0) < 128;
            const teamKills = isRadiant ? (radiantScore || 1) : (direScore || 1);
            const tk = getTowerKills(p);

            if (cat.key === 'fightPart') {
                val = Math.min(100, (((p.kills + p.assists) / teamKills) * 100) || 0);
            } else if (cat.key === 'kpDeath') {
                val = Math.min(100, ((p.totalKp || 1) / Math.max(1, p.deaths)) * 10);
            } else if (cat.key === 'towerPush') {
                val = Math.min(100, tk * 25);
            } else if (cat.key === 'dmgEff') {
                val = Math.min(100, ((p.heroDamage || 0) / Math.max(1, p.deaths * 1200)) * 10);
            } else if (cat.key === 'healing') {
                val = Math.min(100, ((p.heroHealing || 0) / 100));
            }
            row[`player_${p.playerSlot}`] = Number(val.toFixed(1));
        });
        return row;
    });

    const renderVerticalPlayerCard = (p: PerformancePlayer) => {
        const isRadiant = (p.playerSlot || 0) < 128;
        const isSelected = selectedSlots.includes(p.playerSlot);
        const posColor = POS_COLORS[p.role] ?? '#C8CDD4';
        const heroImg = getHeroImg(p);
        const heroName = getHeroDisplayName(p);

        return (
            <button
                key={p.playerSlot}
                onClick={() => togglePlayer(p.playerSlot)}
                className={`relative w-full flex items-center justify-between gap-2.5 border p-2 text-xs font-bold transition-all rounded-xs text-left overflow-hidden ${isSelected
                        ? isRadiant
                            ? 'border-[#00D4FF] bg-[#00D4FF]/15 text-white shadow-[0_0_12px_rgba(0,212,255,0.25)]'
                            : 'border-[#C9A84C] bg-[#C9A84C]/15 text-white shadow-[0_0_12px_rgba(201,168,76,0.25)]'
                        : 'border-neutral-800/80 bg-[#0B0B10]/80 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
                    }`}
            >
                {/* แถบสีระบุ Role ด้านข้างการ์ด */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: posColor }}
                />

                <div className="flex items-center gap-2 pl-1.5 overflow-hidden">
                    <div className="h-7 w-12 overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0">
                        {heroImg ? (
                            <img src={heroImg} alt={heroName} className="h-full w-full object-cover" />
                        ) : (
                            <span className="flex h-full w-full items-center justify-center text-[7px]">???</span>
                        )}
                    </div>
                    <div className="flex flex-col truncate">
                        <span className="truncate font-bold leading-tight">{p.playerName}</span>
                        <span className="truncate text-[9px] font-normal text-neutral-400">{heroName}</span>
                    </div>
                </div>

                <span
                    className="shrink-0 rounded-xs px-1.5 py-0.5 text-[8px] font-bold"
                    style={{ color: posColor, border: `1px solid ${posColor}60`, background: `${posColor}15` }}
                >
                    {p.role}
                </span>
            </button>
        );
    };

    const renderPerformanceTable = (teamPlayers: PerformancePlayer[], isRadiant: boolean) => {
        const accentColor = isRadiant ? '#00D4FF' : '#C9A84C';

        return (
            <div className="border border-neutral-800 bg-[#111118] shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0A0A0F] px-4 py-2">
                    <span className="font-orbitron text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                        {isRadiant ? 'THE RADIANT PERFORMANCE' : 'THE DIRE PERFORMANCE'}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                        <thead className="border-b border-neutral-800/80 bg-[#0D0D14] text-[10px] text-neutral-400 font-orbitron">
                            <tr>
                                <th className="px-4 py-2.5">HERO / PLAYER</th>
                                <th className="px-4 py-2.5 text-center">FIGHT PART %</th>
                                <th className="px-4 py-2.5 text-center">KP / DEATH</th>
                                <th className="px-4 py-2.5 text-right">HERO DMG</th>
                                <th className="px-4 py-2.5 text-right">HEALING</th>
                                <th className="px-4 py-2.5 text-center">TOWERS</th>
                                <th className="px-4 py-2.5 text-right">KP EFFICIENCY</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/40 text-[11px]">
                            {teamPlayers.map((p, idx) => {
                                const teamKills = isRadiant ? (radiantScore || 1) : (direScore || 1);
                                const fightPart = Math.min(100, (((p.kills + p.assists) / teamKills) * 100) || 0).toFixed(1);
                                const kpPerDeath = ((p.totalKp || 0) / Math.max(1, p.deaths)).toFixed(1);
                                const posColor = POS_COLORS[p.role] ?? '#C8CDD4';
                                const heroImg = getHeroImg(p);
                                const heroName = getHeroDisplayName(p);
                                const towerCount = getTowerKills(p);

                                return (
                                    <tr key={idx} className="transition-colors hover:bg-white/[0.02]">
                                        <td className="px-4 py-2 flex items-center gap-3">
                                            <div className="h-8 w-14 overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0">
                                                {heroImg ? (
                                                    <img src={heroImg} alt={heroName} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-500">???</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white tracking-wide">{p.playerName}</span>
                                                    <span
                                                        className="rounded-xs px-1 py-0.2 text-[8px] font-bold"
                                                        style={{ color: posColor, border: `1px solid ${posColor}40`, background: `${posColor}15` }}
                                                    >
                                                        {p.role}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-neutral-400 font-sans">{heroName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-center text-white">{fightPart}%</td>
                                        <td className="px-4 py-2 text-center text-emerald-400 font-bold">{kpPerDeath}</td>
                                        <td className="px-4 py-2 text-right text-neutral-300">
                                            {p.heroDamage ? (p.heroDamage >= 1000 ? `${(p.heroDamage / 1000).toFixed(1)}k` : p.heroDamage) : '0'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-emerald-400">
                                            {p.heroHealing && p.heroHealing > 0 ? (p.heroHealing >= 1000 ? `${(p.heroHealing / 1000).toFixed(1)}k` : p.heroHealing) : '—'}
                                        </td>
                                        <td className="px-4 py-2 text-center text-yellow-400 font-bold">
                                            🏯 {towerCount}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-[#00D4FF]">
                                            {p.totalKp ? p.totalKp.toFixed(1) : '0.0'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 font-mono pb-12">
            {/* ── 3-COLUMN COCKPIT RADAR PANEL ── */}
            <div className="border border-[#00D4FF]/30 bg-[#111118] p-5 shadow-[0_0_25px_rgba(0,212,255,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-3 mb-4">
                    <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                        ⚙️ TACTICAL RADAR INTEL (CLICK TO COMPARE)
                    </h3>
                    <span className="text-[10px] text-neutral-500 font-mono">
                        SELECTED: <span className="text-white font-bold">{selectedSlots.length}</span>/{sortedPlayers.length} PLAYERS
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* LEFT COLUMN: RADIANT SQUAD (Pos 1-5) */}
                    <div className="lg:col-span-3 space-y-2">
                        <div className="border-b border-[#00D4FF]/30 pb-1 text-[11px] font-orbitron font-bold text-[#00D4FF] flex items-center justify-between">
                            <span>THE RADIANT</span>
                            <span className="text-[9px] text-[#00D4FF]/70 font-mono">SOLID LINE</span>
                        </div>
                        <div className="space-y-1.5">
                            {radiantPlayers.map((p) => renderVerticalPlayerCard(p))}
                        </div>
                    </div>

                    {/* CENTER COLUMN: OVERSIZED RADAR CHART */}
                    <div className="lg:col-span-6 flex flex-col items-center justify-center">
                        <div className="h-[460px] w-full max-w-[500px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                                    <PolarGrid stroke="#22222E" />
                                    <PolarAngleAxis dataKey="subject" stroke="#888888" fontSize={11} />
                                    <PolarRadiusAxis stroke="#333333" fontSize={9} domain={[0, 100]} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0D0D12',
                                            borderColor: '#00D4FF30',
                                            color: '#FFF',
                                            fontSize: '11px',
                                        }}
                                    />
                                    {sortedPlayers.map((p) => {
                                        if (!selectedSlots.includes(p.playerSlot)) return null;
                                        const isRadiant = (p.playerSlot || 0) < 128;
                                        const roleColor = POS_COLORS[p.role] ?? '#C8CDD4';

                                        return (
                                            <Radar
                                                key={p.playerSlot}
                                                name={`${isRadiant ? '[RAD]' : '[DIRE]'} ${p.playerName} (${p.role})`}
                                                dataKey={`player_${p.playerSlot}`}
                                                stroke={roleColor}
                                                strokeWidth={isRadiant ? 2.5 : 2}
                                                strokeDasharray={isRadiant ? undefined : '4 4'}
                                                fill={roleColor}
                                                fillOpacity={0.2}
                                            />
                                        );
                                    })}
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Radar Legend Footer */}
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[9px] text-neutral-400 font-mono">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-4 h-0.5 bg-[#00D4FF]"></span>
                                RADIANT: Solid Line
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-4 h-0.5 border-b border-dashed border-[#C9A84C]"></span>
                                DIRE: Dashed Line
                            </span>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: DIRE SQUAD (Pos 1-5) */}
                    <div className="lg:col-span-3 space-y-2">
                        <div className="border-b border-[#C9A84C]/30 pb-1 text-[11px] font-orbitron font-bold text-[#C9A84C] flex items-center justify-between">
                            <span>THE DIRE</span>
                            <span className="text-[9px] text-[#C9A84C]/70 font-mono">DASHED LINE</span>
                        </div>
                        <div className="space-y-1.5">
                            {direPlayers.map((p) => renderVerticalPlayerCard(p))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Split Metrics Tables */}
            <div className="space-y-6">
                {renderPerformanceTable(radiantPlayers, true)}
                {renderPerformanceTable(direPlayers, false)}
            </div>
        </div>
    );
}