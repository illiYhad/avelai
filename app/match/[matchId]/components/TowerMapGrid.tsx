'use client';

import React from 'react';

interface TowerMapGridProps {
    towerRadiant?: number;
    towerDire?: number;
    barracksRadiant?: number;
    barracksDire?: number;
}

const TOWER_COORDS = [
    // RADIANT — bottom-left base
    { id: 'rad_t1_top', team: 'radiant', label: 'T1 Top', x: 15, y: 30, bit: 0 },
    { id: 'rad_t1_mid', team: 'radiant', label: 'T1 Mid', x: 42, y: 58, bit: 1 },
    { id: 'rad_t1_bot', team: 'radiant', label: 'T1 Bot', x: 74, y: 85, bit: 2 },
    { id: 'rad_t2_top', team: 'radiant', label: 'T2 Top', x: 12, y: 18, bit: 3 },
    { id: 'rad_t2_mid', team: 'radiant', label: 'T2 Mid', x: 32, y: 45, bit: 4 },
    { id: 'rad_t2_bot', team: 'radiant', label: 'T2 Bot', x: 78, y: 78, bit: 5 },
    { id: 'rad_t3_top', team: 'radiant', label: 'T3 Top', x: 10, y: 12, bit: 6 },
    { id: 'rad_t3_mid', team: 'radiant', label: 'T3 Mid', x: 22, y: 30, bit: 7 },
    { id: 'rad_t3_bot', team: 'radiant', label: 'T3 Bot', x: 82, y: 68, bit: 8 },
    { id: 'rad_t4_top', team: 'radiant', label: 'Ancient Top', x: 18, y: 20, bit: 9 },
    { id: 'rad_t4_bot', team: 'radiant', label: 'Ancient Bot', x: 22, y: 24, bit: 10 },

    // DIRE — top-right base
    { id: 'dire_t1_top', team: 'dire', label: 'T1 Top', x: 26, y: 15, bit: 0 },
    { id: 'dire_t1_mid', team: 'dire', label: 'T1 Mid', x: 58, y: 42, bit: 1 },
    { id: 'dire_t1_bot', team: 'dire', label: 'T1 Bot', x: 85, y: 72, bit: 2 },
    { id: 'dire_t2_top', team: 'dire', label: 'T2 Top', x: 18, y: 10, bit: 3 },
    { id: 'dire_t2_mid', team: 'dire', label: 'T2 Mid', x: 68, y: 32, bit: 4 },
    { id: 'dire_t2_bot', team: 'dire', label: 'T2 Bot', x: 88, y: 78, bit: 5 },
    { id: 'dire_t3_top', team: 'dire', label: 'T3 Top', x: 12, y: 8, bit: 6 },
    { id: 'dire_t3_mid', team: 'dire', label: 'T3 Mid', x: 78, y: 22, bit: 7 },
    { id: 'dire_t3_bot', team: 'dire', label: 'T3 Bot', x: 88, y: 85, bit: 8 },
    { id: 'dire_t4_top', team: 'dire', label: 'Ancient Top', x: 78, y: 12, bit: 9 },
    { id: 'dire_t4_bot', team: 'dire', label: 'Ancient Bot', x: 82, y: 16, bit: 10 },
];

export default function TowerMapGrid({
    towerRadiant = 0,
    towerDire = 0,
}: TowerMapGridProps) {
    const isTowerAlive = (team: 'radiant' | 'dire', bit: number) => {
        const mask = team === 'radiant' ? towerRadiant : towerDire;
        if (mask === 0) return false;
        return (mask & (1 << bit)) !== 0;
    };

    return (
        <div className="border border-[#00D4FF]/30 bg-[#111118] p-5 font-mono shadow-[0_0_25px_rgba(0,212,255,0.05)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                    🗺️ TACTICAL RADAR MAP
                </h3>
                <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1.5 text-[#00D4FF]">
                        <span className="inline-block h-2.5 w-2.5 bg-[#00D4FF] shadow-[0_0_8px_#00D4FF]"></span> RADIANT
                    </span>
                    <span className="flex items-center gap-1.5 text-[#C9A84C]">
                        <span className="inline-block h-2.5 w-2.5 bg-[#C9A84C] shadow-[0_0_8px_#C9A84C]"></span> DIRE
                    </span>
                    <span className="text-neutral-500">// DESTROYED: 20% OPACITY</span>
                </div>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[380px] overflow-hidden border border-[#00D4FF]/30 bg-[#07070C]">
                <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 100">
                    <polygon points="5,95 35,95 5,65" fill="#00D4FF08" stroke="#00D4FF20" strokeWidth="0.5" />
                    <polygon points="95,5 65,5 95,35" fill="#C9A84C08" stroke="#C9A84C20" strokeWidth="0.5" />
                    <path d="M 18,80 L 18,20 L 75,20" fill="none" stroke="#252538" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 22,78 L 78,22" fill="none" stroke="#252538" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 25,82 L 82,82 L 82,25" fill="none" stroke="#252538" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 10,25 Q 45,50 85,90" fill="none" stroke="#00D4FF30" strokeWidth="1.5" strokeDasharray="2 1" />
                </svg>

                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00d4ff08_1px,transparent_1px),linear-gradient(to_bottom,#00d4ff08_1px,transparent_1px)] bg-[size:10%_10%]"></div>

                {TOWER_COORDS.map((tower) => {
                    const alive = isTowerAlive(tower.team as 'radiant' | 'dire', tower.bit);
                    const isRadiant = tower.team === 'radiant';

                    return (
                        <div
                            key={tower.id}
                            style={{ left: `${tower.x}%`, top: `${tower.y}%` }}
                            title={`${tower.label} (${alive ? 'ACTIVE' : 'DESTROYED'})`}
                            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                        >
                            <div
                                className={`h-3.5 w-3.5 rounded-xs border transition-transform hover:scale-150 ${alive
                                        ? isRadiant
                                            ? 'border-[#00D4FF] bg-[#00D4FF] shadow-[0_0_12px_#00D4FF]'
                                            : 'border-[#C9A84C] bg-[#C9A84C] shadow-[0_0_12px_#C9A84C]'
                                        : isRadiant
                                            ? 'border-[#00D4FF]/30 bg-[#00D4FF]/10 opacity-20'
                                            : 'border-[#C9A84C]/30 bg-[#C9A84C]/10 opacity-20'
                                    }`}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}