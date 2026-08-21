'use client';

import React from 'react';

interface TowerMapGridProps {
    towerRadiant?: number;
    towerDire?: number;
    barracksRadiant?: number;
    barracksDire?: number;
}

const TOWER_COORDS = [
    // Radiant Towers (Bit 0 to 10)
    { id: 'rad_t1_top', team: 'radiant', label: 'T1 Top', x: 18, y: 28, bit: 0 },
    { id: 'rad_t2_top', team: 'radiant', label: 'T2 Top', x: 18, y: 18, bit: 1 },
    { id: 'rad_t3_top', team: 'radiant', label: 'T3 Top', x: 12, y: 12, bit: 2 },
    { id: 'rad_t1_mid', team: 'radiant', label: 'T1 Mid', x: 45, y: 55, bit: 3 },
    { id: 'rad_t2_mid', team: 'radiant', label: 'T2 Mid', x: 58, y: 42, bit: 4 },
    { id: 'rad_t3_mid', team: 'radiant', label: 'T3 Mid', x: 70, y: 30, bit: 5 },
    { id: 'rad_t1_bot', team: 'radiant', label: 'T1 Bot', x: 75, y: 82, bit: 6 },
    { id: 'rad_t2_bot', team: 'radiant', label: 'T2 Bot', x: 82, y: 70, bit: 7 },
    { id: 'rad_t3_bot', team: 'radiant', label: 'T3 Bot', x: 88, y: 58, bit: 8 },
    { id: 'rad_t4_top', team: 'radiant', label: 'T4 Top', x: 78, y: 22, bit: 9 },
    { id: 'rad_t4_bot', team: 'radiant', label: 'T4 Bot', x: 80, y: 26, bit: 10 },

    // Dire Towers (Bit 0 to 10)
    { id: 'dire_t1_top', team: 'dire', label: 'T1 Top', x: 22, y: 72, bit: 0 },
    { id: 'dire_t2_top', team: 'dire', label: 'T2 Top', x: 18, y: 80, bit: 1 },
    { id: 'dire_t3_top', team: 'dire', label: 'T3 Top', x: 12, y: 88, bit: 2 },
    { id: 'dire_t1_mid', team: 'dire', label: 'T1 Mid', x: 55, y: 45, bit: 3 },
    { id: 'dire_t2_mid', team: 'dire', label: 'T2 Mid', x: 42, y: 58, bit: 4 },
    { id: 'dire_t3_mid', team: 'dire', label: 'T3 Mid', x: 30, y: 70, bit: 5 },
    { id: 'dire_t1_bot', team: 'dire', label: 'T1 Bot', x: 82, y: 18, bit: 6 },
    { id: 'dire_t2_bot', team: 'dire', label: 'T2 Bot', x: 88, y: 28, bit: 7 },
    { id: 'dire_t3_bot', team: 'dire', label: 'T3 Bot', x: 88, y: 40, bit: 8 },
    { id: 'dire_t4_top', team: 'dire', label: 'T4 Top', x: 22, y: 78, bit: 9 },
    { id: 'dire_t4_bot', team: 'dire', label: 'T4 Bot', x: 20, y: 74, bit: 10 },
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
                {/* รูปพื้นหลัง Minimap Dota 2 */}
                <img
                    src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/stats/minimap_radar.png"
                    alt="Dota 2 Minimap"
                    className="absolute inset-0 h-full w-full object-cover opacity-45 mix-blend-luminosity filter contrast-125"
                    onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                    }}
                />

                {/* Overlay Grid & Lines */}
                <svg className="absolute inset-0 h-full w-full opacity-40 pointer-events-none" viewBox="0 0 100 100">
                    <path d="M 18,80 L 18,20 L 75,20" fill="none" stroke="#252538" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M 22,78 L 78,22" fill="none" stroke="#252538" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M 25,82 L 82,82 L 82,25" fill="none" stroke="#252538" strokeWidth="1.5" strokeLinecap="round" />
                </svg>

                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00d4ff08_1px,transparent_1px),linear-gradient(to_bottom,#00d4ff08_1px,transparent_1px)] bg-[size:10%_10%] pointer-events-none"></div>

                {TOWER_COORDS.map((tower) => {
                    const alive = isTowerAlive(tower.team as 'radiant' | 'dire', tower.bit);
                    const isRadiant = tower.team === 'radiant';

                    return (
                        <div
                            key={tower.id}
                            style={{ left: `${tower.x}%`, top: `${tower.y}%` }}
                            title={`${tower.label} (${alive ? 'ACTIVE' : 'DESTROYED'})`}
                            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 z-10"
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