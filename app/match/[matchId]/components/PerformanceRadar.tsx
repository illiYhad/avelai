'use client';

import React, { useState } from 'react';
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Tooltip,
} from 'recharts';

export interface PerformancePlayer {
    playerSlot: number;
    playerName: string;
    heroName: string;
    role: string;
    roleColor?: string;
    kills: number;
    deaths: number;
    assists: number;
    totalKp: number;
    towerKills: number;
    heroDamage: number;
    heroHealing: number;
}

interface PerformanceRadarProps {
    players: PerformancePlayer[];
    teamRadiantKills: number;
    teamDireKills: number;
    teamRadiantTowers: number;
    teamDireTowers: number;
}

export default function PerformanceRadar({
    players,
    teamRadiantKills,
    teamDireKills,
    teamRadiantTowers,
    teamDireTowers,
}: PerformanceRadarProps) {
    // เก็บ slot ของผู้เล่นที่เลือกแสดงเส้นใน Radar Chart (default: แสดง 2 คนแรก)
    const [selectedSlots, setSelectedSlots] = useState<number[]>([
        players[0]?.playerSlot,
        players[5]?.playerSlot,
    ].filter((s) => s !== undefined));

    const togglePlayer = (slot: number) => {
        setSelectedSlots((prev) =>
            prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
        );
    };

    // คำนวณ Metrics สำหรับตาราง
    const calculatedMetrics = players.map((p) => {
        const isRadiant = p.playerSlot < 128;
        const teamKills = isRadiant ? teamRadiantKills : teamDireKills;
        const teamTowers = isRadiant ? teamRadiantTowers : teamDireTowers;

        // 1. Fight Participation %
        const fightPart = teamKills > 0 ? ((p.kills + p.assists) / teamKills) * 100 : 0;

        // 2. KP per Death (Death = 0 -> DEATHLESS)
        const kpPerDeath = p.deaths === 0 ? 'DEATHLESS' : (p.totalKp / p.deaths).toFixed(1);

        // 3. Tower Contribution %
        const towerContrib = teamTowers > 0 ? ((p.towerKills / teamTowers) * 100).toFixed(1) + '%' : '—';

        // 4. Damage Efficiency (DMG per Death)
        const dmgEff = p.deaths === 0 ? p.heroDamage : Math.round(p.heroDamage / p.deaths);

        return {
            ...p,
            isRadiant,
            fightPart: fightPart.toFixed(1) + '%',
            fightPartRaw: fightPart,
            kpPerDeath,
            towerContrib,
            dmgEff,
        };
    });

    // เตรียมข้อมูล 5 มิติสำหรับ Radar Chart (Normalized 0-100 scale)
    const radarDimensions = [
        { key: 'fight', label: 'Fight Part %' },
        { key: 'kpDeath', label: 'KP / Death' },
        { key: 'tower', label: 'Tower Push' },
        { key: 'dmgEff', label: 'DMG Efficiency' },
        { key: 'heal', label: 'Healing' },
    ];

    const radarChartData = radarDimensions.map((dim) => {
        const dataPoint: any = { subject: dim.label };
        calculatedMetrics.forEach((p) => {
            let val = 0;
            if (dim.key === 'fight') val = Math.min(p.fightPartRaw, 100);
            if (dim.key === 'kpDeath') val = p.deaths === 0 ? 100 : Math.min((p.totalKp / p.deaths) * 10, 100);
            if (dim.key === 'tower') val = Math.min(p.towerKills * 25, 100);
            if (dim.key === 'dmgEff') val = Math.min((p.dmgEff / 5000) * 100, 100);
            if (dim.key === 'heal') val = Math.min((p.heroHealing / 3000) * 100, 100);

            dataPoint[`player_${p.playerSlot}`] = Math.round(Math.max(val, 5));
        });
        return dataPoint;
    });

    const getPlayerColor = (p: any, idx: number) => {
        if (p.roleColor) return p.roleColor;
        return p.isRadiant ? '#00D4FF' : '#C9A84C';
    };

    return (
        <div className="space-y-6 font-mono">
            {/* 🔹 Interactive Player Filter Chips */}
            <div className="border border-[#00D4FF]/30 bg-[#111118] p-4">
                <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2">
                    <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                        ⚙️ TACTICAL RADAR INTEL (CLICK TO COMPARE)
                    </h3>
                    <span className="text-[10px] text-neutral-400">
                        SELECTED: {selectedSlots.length}/10 PLAYERS
                    </span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {calculatedMetrics.map((p, idx) => {
                        const isSelected = selectedSlots.includes(p.playerSlot);
                        const color = getPlayerColor(p, idx);

                        return (
                            <button
                                key={p.playerSlot}
                                onClick={() => togglePlayer(p.playerSlot)}
                                style={{
                                    borderColor: isSelected ? color : '#333333',
                                    backgroundColor: isSelected ? `${color}20` : '#0A0A0F',
                                    color: isSelected ? color : '#888888',
                                }}
                                className="flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-all"
                            >
                                <span className="font-bold">{p.playerName}</span>
                                <span className="text-[10px] opacity-70">({p.role})</span>
                            </button>
                        );
                    })}
                </div>

                {/* Radar Chart */}
                <div className="mt-4 h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarChartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                            <PolarGrid stroke="#222228" />
                            <PolarAngleAxis dataKey="subject" stroke="#888888" fontSize={11} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#444444" fontSize={8} />

                            <Tooltip
                                content={({ active, payload }: any) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="border border-[#00D4FF]/50 bg-[#0A0A0F] p-2 text-xs font-mono shadow-lg">
                                                <p className="font-bold text-white mb-1">{payload[0]?.payload?.subject}</p>
                                                {payload.map((entry: any) => {
                                                    const slot = Number(entry.dataKey.replace('player_', ''));
                                                    const targetPlayer = calculatedMetrics.find((p) => p.playerSlot === slot);
                                                    return (
                                                        <p key={entry.dataKey} style={{ color: entry.color }}>
                                                            {targetPlayer?.playerName}: {entry.value} pts
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />

                            {calculatedMetrics.map((p, idx) => {
                                if (!selectedSlots.includes(p.playerSlot)) return null;
                                const color = getPlayerColor(p, idx);

                                return (
                                    <Radar
                                        key={`radar-${p.playerSlot}`}
                                        name={p.playerName}
                                        dataKey={`player_${p.playerSlot}`}
                                        stroke={color}
                                        fill={color}
                                        fillOpacity={0.2}
                                    />
                                );
                            })}
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 🔹 Efficiency Metrics Table */}
            <div className="overflow-x-auto border border-[#00D4FF]/30 bg-[#111118]">
                <table className="w-full text-left border-collapse min-w-[800px] text-xs">
                    <thead>
                        <tr className="border-b border-[#00D4FF]/30 bg-[#0A0A0F] font-orbitron text-[11px] text-[#00D4FF]">
                            <th className="p-3">PLAYER</th>
                            <th className="p-3 text-center">FIGHT PART %</th>
                            <th className="p-3 text-center">KP / DEATH</th>
                            <th className="p-3 text-center">TOWER CONTRIB %</th>
                            <th className="p-3 text-right">DMG / DEATH</th>
                            <th className="p-3 text-right">HEALING</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {calculatedMetrics.map((p) => (
                            <tr
                                key={p.playerSlot}
                                className={`transition-colors hover:bg-cyan-900/20 ${p.isRadiant ? 'bg-[#00D4FF]/[0.02]' : 'bg-[#C9A84C]/[0.02]'
                                    }`}
                            >
                                <td className="p-3 font-medium text-white flex items-center gap-2">
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: p.isRadiant ? '#00D4FF' : '#C9A84C' }}
                                    />
                                    {p.playerName}
                                </td>
                                <td className="p-3 text-center text-[#00D4FF] font-bold">{p.fightPart}</td>
                                <td className="p-3 text-center">
                                    <span
                                        className={
                                            p.kpPerDeath === 'DEATHLESS'
                                                ? 'text-emerald-400 font-bold'
                                                : 'text-neutral-300'
                                        }
                                    >
                                        {p.kpPerDeath}
                                    </span>
                                </td>
                                <td className="p-3 text-center text-neutral-400">{p.towerContrib}</td>
                                <td className="p-3 text-right text-neutral-300">
                                    {typeof p.dmgEff === 'number' ? p.dmgEff.toLocaleString() : p.dmgEff}
                                </td>
                                <td className="p-3 text-right text-emerald-400">
                                    {p.heroHealing > 0 ? p.heroHealing.toLocaleString() : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}