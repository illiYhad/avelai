'use client';

import React from 'react';

interface TowerMapGridProps {
    towerRadiant?: number;
    towerDire?: number;
    barracksRadiant?: number;
    barracksDire?: number;
}

export default function TowerMapGrid({
    towerRadiant = 0,
    towerDire = 0,
    barracksRadiant = 0,
    barracksDire = 0,
}: TowerMapGridProps) {
    return (
        <div className="border border-[#00D4FF]/30 bg-[#111118] p-4 font-mono">
            <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-2">
                <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                    🗺️ TACTICAL MAP STATUS
                </h3>
                <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1 text-[#00D4FF]">■ RADIANT</span>
                    <span className="flex items-center gap-1 text-[#C9A84C]">■ DIRE</span>
                    <span className="text-neutral-500">// DESTROYED: 30% OPACITY</span>
                </div>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[340px] border border-neutral-800 bg-[#0A0A0F] p-4">
                <div className="grid h-full w-full grid-cols-8 grid-rows-8 gap-1 border border-neutral-900 bg-[radial-gradient(#1a1a24_1px,transparent_1px)] [background-size:16px_16px]">
                    {/* Sample Map Nodes */}
                    <div className="col-start-2 row-start-7 flex items-center justify-center">
                        <span className="h-3 w-3 border border-[#00D4FF] bg-[#00D4FF]/20 shadow-[0_0_8px_#00D4FF]"></span>
                    </div>
                    <div className="col-start-3 row-start-6 flex items-center justify-center">
                        <span className="h-3 w-3 border border-[#00D4FF] bg-[#00D4FF]/20 shadow-[0_0_8px_#00D4FF]"></span>
                    </div>
                    <div className="col-start-7 row-start-2 flex items-center justify-center">
                        <span className="h-3 w-3 border border-[#C9A84C] bg-[#C9A84C]/20 opacity-30"></span>
                    </div>
                    <div className="col-start-6 row-start-3 flex items-center justify-center">
                        <span className="h-3 w-3 border border-[#C9A84C] bg-[#C9A84C]/20 shadow-[0_0_8px_#C9A84C]"></span>
                    </div>
                </div>
            </div>
        </div>
    );
}