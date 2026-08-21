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
    playerName: string;
    heroName: string;
    role: string;
    kills: number;
    deaths: number;
    assists: number;
    totalKp: number;
    towerKills: number;
    heroDamage: number;
    heroHealing: number;
}

interface PerformanceRadarProps {
    players?: PerformancePlayer[];
    radiantScore?: number;
    direScore?: number;
}

export default function PerformanceRadar({
    players = [],
    radiantScore = 0,
    direScore = 0,
}: PerformanceRadarProps) {
    const [selectedSlots, setSelectedSlots] = useState<number[]>(
        players.map((p) => p.playerSlot)
    );

    const togglePlayer = (slot: number) => {
        setSelectedSlots((prev) =>
            prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
        );
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
        players.forEach((p) => {
            let val = 0;
            const isRadiant = (p.playerSlot || 0) < 128;
            const teamKills = isRadiant ? (radiantScore || 1) : (direScore || 1);

            if (cat.key === 'fightPart') {
                val = Math.min(100, (((p.kills + p.assists) / teamKills) * 100) || 0);
            } else if (cat.key === 'kpDeath') {
                val = Math.min(100, (p.totalKp / Math.max(1, p.deaths)) * 10);
            } else if (cat.key === 'towerPush') {
                val = Math.min(100, (p.towerKills || 0) * 20);
            } else if (cat.key === 'dmgEff') {
                val = Math.min(100, (p.heroDamage / Math.max(1, p.deaths * 1000)) * 10);
            } else if (cat.key === 'healing') {
                val = Math.min(100, (p.heroHealing / 100));
            }
            row[`player_${p.playerSlot}`] = Number(val.toFixed(1));
        });
        return row;
    });

    return (
        <div className="space-y-6 border border-[#00D4FF]/30 bg-[#111118] p-6 font-mono">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                    ⚙️ TACTICAL RADAR INTEL (CLICK TO COMPARE)
                </h3>
                <span className="text-[10px] text-neutral-500">
                    SELECTED: {selectedSlots.length}/{players.length} PLAYERS
                </span>
            </div>

            <div className="flex flex-wrap gap-2">
                {players.map((p) => {
                    const isRadiant = (p.playerSlot || 0) < 128;
                    const isSelected = selectedSlots.includes(p.playerSlot);
                    return (
                        <button
                            key={p.playerSlot}
                            onClick={() => togglePlayer(p.playerSlot)}
                            className={`border px-2.5 py-1 text-[11px] font-bold transition-all ${isSelected
                                ? isRadiant
                                    ? 'border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]'
                                    : 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                                : 'border-neutral-800 bg-neutral-900/50 text-neutral-600'
                                }`}
                        >
                            {p.playerName} <span className="text-[9px] opacity-70">({p.role})</span>
                        </button>
                    );
                })}
            </div>

            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                        <PolarGrid stroke="#22222E" />
                        <PolarAngleAxis dataKey="subject" stroke="#888888" fontSize={10} />
                        <PolarRadiusAxis stroke="#333333" fontSize={9} domain={[0, 100]} />
                        <Tooltip />
                        {players.map((p) => {
                            if (!selectedSlots.includes(p.playerSlot)) return null;
                            const isRadiant = (p.playerSlot || 0) < 128;
                            return (
                                <Radar
                                    key={p.playerSlot}
                                    name={p.playerName}
                                    dataKey={`player_${p.playerSlot}`}
                                    stroke={isRadiant ? '#00D4FF' : '#C9A84C'}
                                    fill={isRadiant ? '#00D4FF' : '#C9A84C'}
                                    fillOpacity={0.2}
                                />
                            );
                        })}
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}