'use client';

import React from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
} from 'recharts';

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

interface KPDistributionChartProps {
    players?: PlayerKPData[];
}

export default function KPDistributionChart({ players = [] }: KPDistributionChartProps) {
    const totalMatchKp = players.reduce((sum, p) => sum + Math.max(0, p.totalKp || 0), 0);

    const chartData = players.map((p) => {
        const share = totalMatchKp > 0 ? (Math.max(0, p.totalKp || 0) / totalMatchKp) * 100 : 0;
        return {
            name: (p.playerName || '').length > 8 ? `${(p.playerName || '').substring(0, 8)}...` : p.playerName,
            fullName: p.playerName,
            kp: Number((p.totalKp || 0).toFixed(1)),
            share: Number(share.toFixed(1)),
            isRadiant: (p.playerSlot || 0) < 128,
        };
    });

    return (
        <div className="border border-[#00D4FF]/30 bg-[#111118] p-4 font-mono">
            <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-2">
                <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                    📊 MATCH KP DISTRIBUTION (% SHARE)
                </h3>
                <span className="text-[10px] text-neutral-400">
                    TOTAL KP POOL: {totalMatchKp.toFixed(1)}
                </span>
            </div>

            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis
                            dataKey="name"
                            stroke="#666666"
                            fontSize={10}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="#666666"
                            fontSize={10}
                            tickLine={false}
                            unit="%"
                        />
                        <Tooltip
                            content={(props: any) => {
                                const { active, payload } = props;
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="border border-[#00D4FF]/50 bg-[#0A0A0F] p-2 text-xs font-mono shadow-lg">
                                            <p className="font-bold text-white">{data.fullName}</p>
                                            <p className="text-[#00D4FF]">KP: {data.kp}</p>
                                            <p className="text-neutral-400">Share: {data.share}%</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="share" radius={[2, 2, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isRadiant ? '#00D4FF' : '#C9A84C'}
                                    fillOpacity={0.8}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}