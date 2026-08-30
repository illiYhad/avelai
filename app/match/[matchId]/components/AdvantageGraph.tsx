'use client';

import React, { useState } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
} from 'recharts';

interface AdvantageGraphProps {
    goldAdv?: number[];
    xpAdv?: number[];
}

interface TooltipPayloadItem {
    dataKey: string | number;
    name: string;
    value: number;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string | number;
}

export default function AdvantageGraph({ goldAdv = [], xpAdv = [] }: AdvantageGraphProps) {
    const [viewMode, setViewMode] = useState<'gold' | 'xp' | 'both'>('gold');

    const maxLength = Math.max(goldAdv.length, xpAdv.length);

    if (maxLength === 0) {
        return (
            <div className="border border-[#00D4FF]/30 bg-[#111118] p-8 text-center font-mono">
                <p className="text-xs text-neutral-400">
                    TACTICAL DATA UNAVAILABLE FOR THIS MATCH
                </p>
            </div>
        );
    }

    const chartData = Array.from({ length: maxLength }).map((_, index) => ({
        minute: index,
        gold: goldAdv[index] || 0,
        xp: xpAdv[index] || 0,
    }));

    const formatYAxis = (val: number) => {
        if (val === 0) return '0';
        return `${(val / 1000).toFixed(0)}k`;
    };

    return (
        <div className="border border-[#00D4FF]/30 bg-[#111118] p-4 font-mono">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
                <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                    📈 TEAM ADVANTAGE TIMELINE
                </h3>

                <div className="flex gap-1 bg-[#0A0A0F] p-1 border border-neutral-800">
                    {(['gold', 'xp', 'both'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 text-[10px] font-orbitron font-bold uppercase transition-all cursor-pointer ${viewMode === mode
                                    ? 'bg-[#00D4FF] text-black font-bold'
                                    : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="minute" stroke="#666666" fontSize={10} tickLine={false} unit="m" />
                        <YAxis stroke="#666666" fontSize={10} tickLine={false} tickFormatter={formatYAxis} />
                        <ReferenceLine y={0} stroke="#333333" strokeDasharray="3 3" />

                        <Tooltip
                            content={({ active, payload, label }: CustomTooltipProps) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="border border-[#00D4FF]/50 bg-[#0A0A0F] p-2 text-xs font-mono shadow-lg">
                                            <p className="text-neutral-400">Time: {label}:00</p>
                                            {payload.map((p) => {
                                                const isRadiant = p.value >= 0;
                                                return (
                                                    <p key={String(p.dataKey)} className={p.dataKey === 'gold' ? 'text-[#C9A84C]' : 'text-[#00D4FF]'}>
                                                        {p.name}: {isRadiant ? `+${p.value} (RAD)` : `${p.value} (DIRE)`}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        {(viewMode === 'gold' || viewMode === 'both') && (
                            <Area
                                type="monotone"
                                dataKey="gold"
                                name="Gold"
                                stroke="#C9A84C"
                                fill="#C9A84C"
                                fillOpacity={0.15}
                            />
                        )}

                        {(viewMode === 'xp' || viewMode === 'both') && (
                            <Area
                                type="monotone"
                                dataKey="xp"
                                name="Experience"
                                stroke="#00D4FF"
                                fill="#00D4FF"
                                fillOpacity={0.15}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}