import React from 'react';

interface TowerMapGridProps {
    radiantTowers: number;
    direTowers: number;
    radiantBarracks: number;
    direBarracks: number;
}

// 🎯 Hardcoded Coordinates ตามที่อลิสระบุ (อิงตามเปอร์เซ็นต์ % บนแผนที่ Minimap)
const TOWER_POSITIONS = {
    radiant: [
        { id: 't1_bot', bit: 0, x: 80, y: 82, label: 'T1 Bot' },
        { id: 't3_bot', bit: 1, x: 50, y: 85, label: 'T3 Bot' },
        { id: 't1_mid', bit: 2, x: 42, y: 58, label: 'T1 Mid' },
        { id: 't3_mid', bit: 3, x: 28, y: 72, label: 'T3 Mid' },
        { id: 't1_top', bit: 4, x: 15, y: 38, label: 'T1 Top' },
        { id: 't3_top', bit: 5, x: 18, y: 62, label: 'T3 Top' },
        { id: 't2_bot', bit: 6, x: 65, y: 84, label: 'T2 Bot' },
        { id: 't2_mid', bit: 8, x: 35, y: 65, label: 'T2 Mid' },
        { id: 't2_top', bit: 10, x: 15, y: 50, label: 'T2 Top' },
        { id: 't4_top', bit: 11, x: 22, y: 78, label: 'T4 Top' },
        { id: 't4_bot', bit: 12, x: 25, y: 81, label: 'T4 Bot' },
    ],
    dire: [
        { id: 't1_top', bit: 0, x: 20, y: 18, label: 'T1 Top' },
        { id: 't3_top', bit: 1, x: 50, y: 15, label: 'T3 Top' },
        { id: 't1_mid', bit: 2, x: 58, y: 42, label: 'T1 Mid' },
        { id: 't3_mid', bit: 3, x: 72, y: 28, label: 'T3 Mid' },
        { id: 't1_bot', bit: 4, x: 85, y: 62, label: 'T1 Bot' },
        { id: 't3_bot', bit: 5, x: 82, y: 38, label: 'T3 Bot' },
        { id: 't2_top', bit: 6, x: 35, y: 16, label: 'T2 Top' },
        { id: 't2_mid', bit: 8, x: 65, y: 35, label: 'T2 Mid' },
        { id: 't2_bot', bit: 10, x: 85, y: 50, label: 'T2 Bot' },
        { id: 't4_top', bit: 11, x: 75, y: 19, label: 'T4 Top' },
        { id: 't4_bot', bit: 12, x: 78, y: 22, label: 'T4 Bot' },
    ],
};

export default function TowerMapGrid({
    radiantTowers,
    direTowers,
}: TowerMapGridProps) {
    // ฟังก์ชันเช็ก bitmask ว่าป้อมยังอยู่หรือไม่
    const isStanding = (bitmask: number, bit: number) => (bitmask & (1 << bit)) !== 0;

    return (
        <div className="border border-[#00D4FF]/30 bg-[#111118] p-4 font-mono">
            <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-2">
                <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                    🗺️ TACTICAL MAP STATUS
                </h3>
                <div className="flex gap-4 text-[10px]">
                    <span className="flex items-center gap-1 text-[#00D4FF]">
                        <span className="w-2 h-2 bg-[#00D4FF] inline-block"></span> RADIANT
                    </span>
                    <span className="flex items-center gap-1 text-[#C9A84C]">
                        <span className="w-2 h-2 bg-[#C9A84C] inline-block"></span> DIRE
                    </span>
                    <span className="text-neutral-500">// DESTROYED: 30% OPACITY</span>
                </div>
            </div>

            {/* Map Layout Canvas */}
            <div className="relative aspect-square w-full max-w-[420px] mx-auto border border-neutral-800 bg-[#050508]">
                {/* Grid Background Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#111118_1px,transparent_1px),linear-gradient(to_bottom,#111118_1px,transparent_1px)] bg-[size:20px_20px] opacity-40"></div>

                {/* River Diagonal Line */}
                <div className="absolute inset-0 border-t border-neutral-800 rotate-45 transform origin-top-left scale-150 pointer-events-none opacity-20"></div>

                {/* Radiant Towers */}
                {TOWER_POSITIONS.radiant.map((tower) => {
                    const standing = isStanding(radiantTowers, tower.bit);
                    return (
                        <div
                            key={`rad-${tower.id}`}
                            title={`Radiant ${tower.label} - ${standing ? 'ALIVE' : 'DESTROYED'}`}
                            style={{ left: `${tower.x}%`, top: `${tower.y}%` }}
                            className={`absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 border transition-all ${standing
                                    ? 'border-[#00D4FF] bg-[#00D4FF]/40 shadow-[0_0_8px_rgba(0,212,255,0.8)]'
                                    : 'border-neutral-800 bg-neutral-900/30 opacity-30'
                                }`}
                        />
                    );
                })}

                {/* Dire Towers */}
                {TOWER_POSITIONS.dire.map((tower) => {
                    const standing = isStanding(direTowers, tower.bit);
                    return (
                        <div
                            key={`dire-${tower.id}`}
                            title={`Dire ${tower.label} - ${standing ? 'ALIVE' : 'DESTROYED'}`}
                            style={{ left: `${tower.x}%`, top: `${tower.y}%` }}
                            className={`absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 border transition-all ${standing
                                    ? 'border-[#C9A84C] bg-[#C9A84C]/40 shadow-[0_0_8px_rgba(201,168,76,0.8)]'
                                    : 'border-neutral-800 bg-neutral-900/30 opacity-30'
                                }`}
                        />
                    );
                })}
            </div>
        </div>
    );
}