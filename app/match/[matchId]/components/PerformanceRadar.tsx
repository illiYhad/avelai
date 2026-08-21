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

const POS_COLORS: Record<string, string> = {
    'Pos 1': '#E8384F',
    'Pos 2': '#2E9BFF',
    'Pos 3': '#39FF6A',
    'Pos 4': '#D63CE8',
    'Pos 5': '#C8CDD4',
};

export default function PerformanceRadar({
    players = [],
    radiantScore = 0,
    direScore = 0,
}: PerformanceRadarProps) {
    const [selectedSlots, setSelectedSlots] = useState<number[]>(() => {
        const radiantPlayer = players.find((p) => (p.playerSlot || 0) < 128);
        const direPlayer = players.find((p) => (p.playerSlot || 0) >= 128);
        const defaults: number[] = [];
        if (radiantPlayer) defaults.push(radiantPlayer.playerSlot);
        if (direPlayer) defaults.push(direPlayer.playerSlot);
        return defaults.length > 0 ? defaults : players.slice(0, 2).map((p) => p.playerSlot);
    });

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
        <div className="space-y-6 font-mono">
            {/* Radar Panel */}
            <div className="space-y-6 border border-[#00D4FF]/30 bg-[#111118] p-6 shadow-[0_0_25px_rgba(0,212,255,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                    <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                        ⚙️ TACTICAL RADAR INTEL (CLICK TO COMPARE)
                    </h3>
                    <span className="text-[10px] text-neutral-500">
                        SELECTED: {selectedSlots.length}/{players.length} PLAYERS
                    </span>
                </div>

                {/* Player Chips */}
                <div className="flex flex-wrap gap-2">
                    {players.map((p) => {
                        const isRadiant = (p.playerSlot || 0) < 128;
                        const isSelected = selectedSlots.includes(p.playerSlot);
                        const posColor = POS_COLORS[p.role] ?? '#C8CDD4';

                        return (
                            <button
                                key={p.playerSlot}
                                onClick={() => togglePlayer(p.playerSlot)}
                                className={`border px-3 py-1.5 text-xs font-bold transition-all ${isSelected
                                        ? isRadiant
                                            ? 'border-[#00D4FF] bg-[#00D4FF]/20 text-[#00D4FF] shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                                            : 'border-[#C9A84C] bg-[#C9A84C]/20 text-[#C9A84C] shadow-[0_0_10px_rgba(201,168,76,0.3)]'
                                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-500 hover:border-neutral-700'
                                    }`}
                            >
                                {p.playerName}{' '}
                                <span
                                    className="rounded-xs px-1 py-0.2 text-[9px]"
                                    style={{ color: posColor, border: `1px solid ${posColor}60`, background: `${posColor}15` }}
                                >
                                    {p.role}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Radar Chart */}
                <div className="h-80 w-full">
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
                                        fillOpacity={0.25}
                                    />
                                );
                            })}
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Metrics Table */}
            <div className="overflow-x-auto border border-neutral-800 bg-[#111118] shadow-[0_0_25px_rgba(0,212,255,0.05)]">
                <table className="w-full text-left text-xs">
                    <thead className="border-b border-neutral-800 bg-[#0A0A0F] font-orbitron text-[11px] text-[#00D4FF]">
                        <tr>
                            <th className="px-4 py-3">PLAYER / ROLE</th>
                            <th className="px-4 py-3 text-center">FIGHT PART %</th>
                            <th className="px-4 py-3 text-center">KP / DEATH</th>
                            <th className="px-4 py-3 text-right">HERO DMG</th>
                            <th className="px-4 py-3 text-right">HEALING</th>
                            <th className="px-4 py-3 text-center">TOWERS</th>
                            <th className="px-4 py-3 text-right">KP EFFICIENCY</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                        {players.map((p, idx) => {
                            const isRadiant = (p.playerSlot || 0) < 128;
                            const teamKills = isRadiant ? (radiantScore || 1) : (direScore || 1);
                            const fightPart = Math.min(100, (((p.kills + p.assists) / teamKills) * 100) || 0).toFixed(1);
                            const kpPerDeath = (p.totalKp / Math.max(1, p.deaths)).toFixed(1);
                            const posColor = POS_COLORS[p.role] ?? '#C8CDD4';

                            return (
                                <tr key={idx} className="transition-colors hover:bg-neutral-800/30">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-semibold ${isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}`}>
                                                {p.playerName}
                                            </span>
                                            <span
                                                className="rounded-xs px-1.5 py-0.5 text-[9px] font-bold"
                                                style={{ color: posColor, border: `1px solid ${posColor}40`, background: `${posColor}15` }}
                                            >
                                                {p.role}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-white">{fightPart}%</td>
                                    <td className="px-4 py-3 text-center text-emerald-400 font-bold">{kpPerDeath}</td>
                                    <td className="px-4 py-3 text-right text-neutral-300">
                                        {p.heroDamage ? (p.heroDamage >= 1000 ? `${(p.heroDamage / 1000).toFixed(1)}k` : p.heroDamage) : '0'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-400">
                                        {p.heroHealing && p.heroHealing > 0 ? (p.heroHealing >= 1000 ? `${(p.heroHealing / 1000).toFixed(1)}k` : p.heroHealing) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-neutral-400">🏯 {p.towerKills || 0}</td>
                                    <td className="px-4 py-3 text-right font-bold text-[#00D4FF]">
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
}