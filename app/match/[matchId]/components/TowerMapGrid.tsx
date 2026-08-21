'use client';

import React from 'react';

interface TowerMapGridProps {
    towerRadiant?: number;
    towerDire?: number;
    barracksRadiant?: number;
    barracksDire?: number;
}

// พิกัดป้อมตามเลนจริง Dota 2 (0-100%)
const TOWER_COORDS = [
    // Radiant Towers
    { id: 'rad_t1_top', team: 'radiant', label: 'T1 Top', x: 16, y: 56, bit: 0 },
    { id: 'rad_t2_top', team: 'radiant', label: 'T2 Top', x: 16, y: 68, bit: 1 },
    { id: 'rad_t3_top', team: 'radiant', label: 'T3 Top', x: 16, y: 78, bit: 2 },
    { id: 'rad_t1_mid', team: 'radiant', label: 'T1 Mid', x: 42, y: 60, bit: 3 },
    { id: 'rad_t2_mid', team: 'radiant', label: 'T2 Mid', x: 32, y: 68, bit: 4 },
    { id: 'rad_t3_mid', team: 'radiant', label: 'T3 Mid', x: 24, y: 74, bit: 5 },
    { id: 'rad_t1_bot', team: 'radiant', label: 'T1 Bot', x: 82, y: 84, bit: 6 },
    { id: 'rad_t2_bot', team: 'radiant', label: 'T2 Bot', x: 54, y: 84, bit: 7 },
    { id: 'rad_t3_bot', team: 'radiant', label: 'T3 Bot', x: 30, y: 84, bit: 8 },
    { id: 'rad_t4_top', team: 'radiant', label: 'T4 Top', x: 18, y: 81, bit: 9 },
    { id: 'rad_t4_bot', team: 'radiant', label: 'T4 Bot', x: 21, y: 84, bit: 10 },

    // Dire Towers
    { id: 'dire_t1_top', team: 'dire', label: 'T1 Top', x: 20, y: 16, bit: 0 },
    { id: 'dire_t2_top', team: 'dire', label: 'T2 Top', x: 48, y: 16, bit: 1 },
    { id: 'dire_t3_top', team: 'dire', label: 'T3 Top', x: 70, y: 16, bit: 2 },
    { id: 'dire_t1_mid', team: 'dire', label: 'T1 Mid', x: 56, y: 44, bit: 3 },
    { id: 'dire_t2_mid', team: 'dire', label: 'T2 Mid', x: 66, y: 36, bit: 4 },
    { id: 'dire_t3_mid', team: 'dire', label: 'T3 Mid', x: 74, y: 28, bit: 5 },
    { id: 'dire_t1_bot', team: 'dire', label: 'T1 Bot', x: 84, y: 44, bit: 6 },
    { id: 'dire_t2_bot', team: 'dire', label: 'T2 Bot', x: 84, y: 32, bit: 7 },
    { id: 'dire_t3_bot', team: 'dire', label: 'T3 Bot', x: 84, y: 22, bit: 8 },
    { id: 'dire_t4_top', team: 'dire', label: 'T4 Top', x: 78, y: 18, bit: 9 },
    { id: 'dire_t4_bot', team: 'dire', label: 'T4 Bot', x: 81, y: 21, bit: 10 },
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

            {/* Dota 2 Minimap Surface */}
            <div className="relative mx-auto aspect-square w-full max-w-[380px] overflow-hidden border border-[#00D4FF]/20 bg-[#06060A]">
                {/* Real Dota 2 Minimap Background with Cyber filter */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-40 brightness-75 contrast-125 grayscale-[40%]"
                    style={{
                        backgroundImage: `url('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/hud/map.png')`,
                    }}
                />

                {/* Cyberpunk Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00d4ff10_1px,transparent_1px),linear-gradient(to_bottom,#00d4ff10_1px,transparent_1px)] bg-[size:10%_10%]"></div>

                {/* River Divider Neon Line */}
                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_49%,#00D4FF30_50%,transparent_51%)] pointer-events-none"></div>

                {/* Towers Radar Nodes */}
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
                                className={`h-3 w-3 rounded-xs border transition-transform hover:scale-125 ${alive
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