'use client';

import React, { useState, useEffect } from 'react';

interface TowerMapGridProps {
    towerRadiant?: number;
    towerDire?: number;
    barracksRadiant?: number;
    barracksDire?: number;
    duration?: number; // ระยะเวลาแมตช์เป็นวินาที
}

// แผนผังพิกัดและลำดับนาทีที่ป้อม/บารัคแตก (destroyMinute จำลองตามจังหวะเกม Dota 2 จริง)
const STRUCTURE_COORDS = [
    // ── RADIANT TOWERS ──
    { id: 'rad_t1_top', team: 'radiant', type: 'tower', label: 'Radiant T1 Top', x: 18.0, y: 48.0, bit: 0, destroyMinute: 14 },
    { id: 'rad_t2_top', team: 'radiant', type: 'tower', label: 'Radiant T2 Top', x: 18.0, y: 64.0, bit: 1, destroyMinute: 22 },
    { id: 'rad_t3_top', team: 'radiant', type: 'tower', label: 'Radiant T3 Top', x: 17.0, y: 74.0, bit: 2, destroyMinute: 31 },
    { id: 'rad_t1_mid', team: 'radiant', type: 'tower', label: 'Radiant T1 Mid', x: 44.0, y: 58.0, bit: 3, destroyMinute: 11 },
    { id: 'rad_t2_mid', team: 'radiant', type: 'tower', label: 'Radiant T2 Mid', x: 33.0, y: 67.0, bit: 4, destroyMinute: 19 },
    { id: 'rad_t3_mid', team: 'radiant', type: 'tower', label: 'Radiant T3 Mid', x: 26.5, y: 73.5, bit: 5, destroyMinute: 27 },
    { id: 'rad_t1_bot', team: 'radiant', type: 'tower', label: 'Radiant T1 Bot', x: 82.0, y: 84.0, bit: 6, destroyMinute: 16 },
    { id: 'rad_t2_bot', team: 'radiant', type: 'tower', label: 'Radiant T2 Bot', x: 50.0, y: 84.0, bit: 7, destroyMinute: 24 },
    { id: 'rad_t3_bot', team: 'radiant', type: 'tower', label: 'Radiant T3 Bot', x: 30.0, y: 84.0, bit: 8, destroyMinute: 34 },
    { id: 'rad_t4_top', team: 'radiant', type: 'tower', label: 'Radiant T4 Top', x: 20.5, y: 78.5, bit: 9, destroyMinute: 38 },
    { id: 'rad_t4_bot', team: 'radiant', type: 'tower', label: 'Radiant T4 Bot', x: 22.5, y: 80.5, bit: 10, destroyMinute: 39 },

    // ── RADIANT BARRACKS ──
    { id: 'rad_rax_top_m', team: 'radiant', type: 'rax', label: 'Radiant Rax Top (M)', x: 14.5, y: 75.0, bit: 0, isRax: true, destroyMinute: 32 },
    { id: 'rad_rax_top_r', team: 'radiant', type: 'rax', label: 'Radiant Rax Top (R)', x: 17.5, y: 76.5, bit: 1, isRax: true, destroyMinute: 32 },
    { id: 'rad_rax_mid_m', team: 'radiant', type: 'rax', label: 'Radiant Rax Mid (M)', x: 24.0, y: 75.5, bit: 2, isRax: true, destroyMinute: 28 },
    { id: 'rad_rax_mid_r', team: 'radiant', type: 'rax', label: 'Radiant Rax Mid (R)', x: 26.5, y: 77.5, bit: 3, isRax: true, destroyMinute: 29 },
    { id: 'rad_rax_bot_m', team: 'radiant', type: 'rax', label: 'Radiant Rax Bot (M)', x: 28.5, y: 82.0, bit: 4, isRax: true, destroyMinute: 35 },
    { id: 'rad_rax_bot_r', team: 'radiant', type: 'rax', label: 'Radiant Rax Bot (R)', x: 28.5, y: 85.5, bit: 5, isRax: true, destroyMinute: 35 },

    // ── DIRE TOWERS ──
    { id: 'dire_t1_top', team: 'dire', type: 'tower', label: 'Dire T1 Top', x: 22.0, y: 16.0, bit: 0, destroyMinute: 13 },
    { id: 'dire_t2_top', team: 'dire', type: 'tower', label: 'Dire T2 Top', x: 50.0, y: 16.0, bit: 1, destroyMinute: 25 },
    { id: 'dire_t3_top', team: 'dire', type: 'tower', label: 'Dire T3 Top', x: 72.0, y: 16.0, bit: 2, destroyMinute: 36 },
    { id: 'dire_t1_mid', team: 'dire', type: 'tower', label: 'Dire T1 Mid', x: 56.0, y: 44.0, bit: 3, destroyMinute: 10 },
    { id: 'dire_t2_mid', team: 'dire', type: 'tower', label: 'Dire T2 Mid', x: 67.0, y: 35.0, bit: 4, destroyMinute: 21 },
    { id: 'dire_t3_mid', team: 'dire', type: 'tower', label: 'Dire T3 Mid', x: 74.0, y: 28.0, bit: 5, destroyMinute: 30 },
    { id: 'dire_t1_bot', team: 'dire', type: 'tower', label: 'Dire T1 Bot', x: 84.0, y: 52.0, bit: 6, destroyMinute: 12 },
    { id: 'dire_t2_bot', team: 'dire', type: 'tower', label: 'Dire T2 Bot', x: 84.0, y: 38.0, bit: 7, destroyMinute: 20 },
    { id: 'dire_t3_bot', team: 'dire', type: 'tower', label: 'Dire T3 Bot', x: 84.0, y: 26.0, bit: 8, destroyMinute: 29 },
    { id: 'dire_t4_top', team: 'dire', type: 'tower', label: 'Dire T4 Top', x: 78.5, y: 21.0, bit: 9, destroyMinute: 40 },
    { id: 'dire_t4_bot', team: 'dire', type: 'tower', label: 'Dire T4 Bot', x: 80.5, y: 23.0, bit: 10, destroyMinute: 41 },

    // ── DIRE BARRACKS ──
    { id: 'dire_rax_top_m', team: 'dire', type: 'rax', label: 'Dire Rax Top (M)', x: 73.0, y: 14.0, bit: 0, isRax: true, destroyMinute: 37 },
    { id: 'dire_rax_top_r', team: 'dire', type: 'rax', label: 'Dire Rax Top (R)', x: 73.0, y: 18.0, bit: 1, isRax: true, destroyMinute: 37 },
    { id: 'dire_rax_mid_m', team: 'dire', type: 'rax', label: 'Dire Rax Mid (M)', x: 75.0, y: 24.5, bit: 2, isRax: true, destroyMinute: 31 },
    { id: 'dire_rax_mid_r', team: 'dire', type: 'rax', label: 'Dire Rax Mid (R)', x: 77.5, y: 26.5, bit: 3, isRax: true, destroyMinute: 31 },
    { id: 'dire_rax_bot_m', team: 'dire', type: 'rax', label: 'Dire Rax Bot (M)', x: 85.5, y: 24.0, bit: 4, isRax: true, destroyMinute: 30 },
    { id: 'dire_rax_bot_r', team: 'dire', type: 'rax', label: 'Dire Rax Bot (R)', x: 82.5, y: 24.0, bit: 5, isRax: true, destroyMinute: 30 },
];

export default function TowerMapGrid({
    towerRadiant = 1844,
    towerDire = 2047,
    barracksRadiant = 63,
    barracksDire = 63,
    duration = 2700,
}: TowerMapGridProps) {
    const maxMinutes = Math.max(10, Math.floor(duration / 60));
    const [currentMinute, setCurrentMinute] = useState<number>(maxMinutes);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    // Auto-play Animation
    useEffect(() => {
        let interval: any;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentMinute((prev) => {
                    if (prev >= maxMinutes) {
                        setIsPlaying(false);
                        return maxMinutes;
                    }
                    return prev + 1;
                });
            }, 400);
        }
        return () => clearInterval(interval);
    }, [isPlaying, maxMinutes]);

    // ตรวจสอบว่าป้อมยังคงอยู่ ณ นาทีที่เลือกหรือไม่
    const isAliveAtMinute = (struct: typeof STRUCTURE_COORDS[0]) => {
        // 1. ตรวจสอบสถานะสุดท้ายหลังจบเกมจาก Bitmask
        const finalMask = struct.isRax
            ? struct.team === 'radiant' ? barracksRadiant : barracksDire
            : struct.team === 'radiant' ? towerRadiant : towerDire;
        const isAliveEndGame = (finalMask & (1 << struct.bit)) !== 0;

        // ถ้าจบเกมยังไม่พัง แสดงว่าอยู่รอดตลอดทั้งเกม
        if (isAliveEndGame) return true;

        // ถ้าพังแล้ว ให้เช็คว่านาทีที่เลือกปัจจุบัน ยังไม่ถึงเวลาที่พังใช่หรือไม่
        return currentMinute < struct.destroyMinute;
    };

    // นับจำนวนป้อมและบารัคที่ยังรอด ณ นาทีนี้
    const radiantStanding = STRUCTURE_COORDS.filter((s) => s.team === 'radiant' && isAliveAtMinute(s)).length;
    const direStanding = STRUCTURE_COORDS.filter((s) => s.team === 'dire' && isAliveAtMinute(s)).length;

    return (
        <div className="border border-[#00D4FF]/30 bg-[#111118] p-5 font-mono shadow-[0_0_25px_rgba(0,212,255,0.05)] flex flex-col justify-between">
            {/* Header */}
            <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-2">
                        <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                            🗺️ TACTICAL MAP TIMELINE
                        </h3>
                        <span className="rounded-xs bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-[9px] text-yellow-400">
                            {currentMinute < 10 ? `0${currentMinute}:00` : `${currentMinute}:00`}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1 font-bold text-[#39FF6A]">
                            <span className="inline-block h-2 w-2 bg-[#39FF6A] shadow-[0_0_6px_#39FF6A]"></span>
                            RAD: {radiantStanding}/17
                        </span>
                        <span className="flex items-center gap-1 font-bold text-[#E8384F]">
                            <span className="inline-block h-2 w-2 bg-[#E8384F] shadow-[0_0_6px_#E8384F]"></span>
                            DIRE: {direStanding}/17
                        </span>
                    </div>
                </div>

                {/* Tactical Map Container */}
                <div className="relative mx-auto aspect-square w-full max-w-[370px] overflow-hidden border border-neutral-800 bg-[#0c1015] rounded-xs shadow-2xl">
                    {/* Vector Dota 2 Terrain */}
                    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full pointer-events-none">
                        <polygon points="0,100 0,25 75,100" fill="#142618" opacity="0.9" />
                        <polygon points="100,0 100,75 25,0" fill="#2a1417" opacity="0.9" />
                        <path
                            d="M 10,-5 C 22,25 35,35 48,50 C 62,65 75,75 105,90 L 105,105 C 70,90 55,75 42,60 C 28,42 16,22 -5,-5 Z"
                            fill="#122533"
                            opacity="0.95"
                        />
                        <path d="M 18,85 L 18,16 L 85,16" fill="none" stroke="#222b35" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                        <path d="M 22,80 L 80,22" fill="none" stroke="#222b35" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                        <path d="M 16,84 L 84,84 L 84,16" fill="none" stroke="#222b35" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                        <polygon points="12,88 28,88 28,72 12,72" fill="#0d1b10" stroke="#39FF6A" strokeWidth="0.4" strokeDasharray="1 1" opacity="0.6" />
                        <polygon points="72,28 88,28 88,12 72,12" fill="#200d10" stroke="#E8384F" strokeWidth="0.4" strokeDasharray="1 1" opacity="0.6" />
                    </svg>

                    {/* Vignette */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(5,5,10,0.75)_100%)] pointer-events-none"></div>

                    {/* Structure Nodes (ป้อม & บารัค ที่ตอบสนองต่อ Timeline) */}
                    {STRUCTURE_COORDS.map((struct) => {
                        const alive = isAliveAtMinute(struct);
                        const isRadiant = struct.team === 'radiant';

                        return (
                            <div
                                key={struct.id}
                                style={{ left: `${struct.x}%`, top: `${struct.y}%` }}
                                title={`${struct.label} — ${alive ? 'STANDING' : `DESTROYED (~${struct.destroyMinute}m)`}`}
                                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 z-10"
                            >
                                {struct.type === 'tower' ? (
                                    <div
                                        className={`relative transition-all duration-300 ${alive
                                                ? isRadiant
                                                    ? 'h-3.5 w-2.5 bg-[#39FF6A] shadow-[0_0_10px_#39FF6A] border-t border-white/80 scale-100'
                                                    : 'h-3.5 w-2.5 bg-[#E8384F] shadow-[0_0_10px_#E8384F] border-t border-white/80 scale-100'
                                                : 'h-3.5 w-2.5 bg-black/90 border border-neutral-700/40 opacity-15 scale-75'
                                            }`}
                                        style={{
                                            clipPath: 'polygon(50% 0%, 100% 25%, 100% 100%, 0% 100%, 0% 25%)',
                                        }}
                                    />
                                ) : (
                                    <div
                                        className={`h-2 w-2 transition-all duration-300 ${alive
                                                ? isRadiant
                                                    ? 'bg-[#39FF6A] shadow-[0_0_6px_#39FF6A] scale-100'
                                                    : 'bg-[#E8384F] shadow-[0_0_6px_#E8384F] scale-100'
                                                : 'bg-black/90 border border-neutral-700/40 opacity-10 scale-75'
                                            }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── TIMELINE SCRUBBER CONTROLLER ── */}
            <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="px-2 py-0.5 bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] rounded-xs font-bold hover:bg-[#00D4FF]/30 transition-all"
                        >
                            {isPlaying ? '⏸ PAUSE' : '▶ PLAY REPLAY'}
                        </button>
                        <button
                            onClick={() => { setIsPlaying(false); setCurrentMinute(0); }}
                            className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-xs hover:text-white"
                        >
                            ⏮ 00:00
                        </button>
                        <button
                            onClick={() => { setIsPlaying(false); setCurrentMinute(maxMinutes); }}
                            className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-xs hover:text-white"
                        >
                            END ⏭
                        </button>
                    </div>
                    <span className="text-neutral-500 font-mono">
                        MINUTE <span className="text-[#00D4FF] font-bold">{currentMinute}</span> / {maxMinutes}
                    </span>
                </div>

                {/* Scrubbing Range Slider */}
                <input
                    type="range"
                    min={0}
                    max={maxMinutes}
                    value={currentMinute}
                    onChange={(e) => {
                        setIsPlaying(false);
                        setCurrentMinute(Number(e.target.value));
                    }}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#00D4FF]"
                />
            </div>
        </div>
    );
}