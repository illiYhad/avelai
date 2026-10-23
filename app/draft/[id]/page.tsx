'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Flame, Swords, Crown, ChevronRight, Zap, UserPlus, CheckCircle2, Sparkles, Timer, AlertCircle } from 'lucide-react';

export interface PlayerData {
    id: string;
    name: string;
    pos: 1 | 2 | 3 | 4 | 5;
    roleName: string;
    currentElo: number;
    peakElo: number;
    winRate: number;
    isCaptain?: boolean;
    pickOrder?: number;
    avatarPlaceholder?: string;
    authProviders: ('steam' | 'google')[];
    isSecondaryFill?: boolean;
}

const ROLE_THEMES = {
    1: { name: 'Hard Carry', hex: '#E8384F' },
    2: { name: 'Mid Laner', hex: '#2E9BFF' },
    3: { name: 'Offlaner', hex: '#39FF6A' },
    4: { name: 'Soft Support', hex: '#D63CE8' },
    5: { name: 'Hard Support', hex: '#C8CDD4' },
};

/* ----------------------------------------------------
   1. CAPTAIN HEADER CARD (Cyan vs Gold Glow on Hover)
---------------------------------------------------- */
function CaptainHeaderCard({
    player,
    teamSide,
}: {
    player: PlayerData;
    teamSide: 'RADIANT' | 'DIRE';
}) {
    const role = ROLE_THEMES[player.pos];
    const isRadiant = teamSide === 'RADIANT';

    return (
        <div
            className={`relative w-full bg-slate-950 border-2 rounded-xl p-2.5 font-mono shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer ${isRadiant
                ? 'border-[#00D4FF]/70 shadow-[0_0_15px_rgba(0,212,255,0.25)] hover:border-[#00D4FF] hover:shadow-[0_0_25px_rgba(0,212,255,0.6)]'
                : 'border-[#C9A84C]/80 shadow-[0_0_15px_rgba(201,168,76,0.3)] hover:border-[#C9A84C] hover:shadow-[0_0_25px_rgba(201,168,76,0.65)]'
                }`}
        >
            <div className={`absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 ${isRadiant ? 'border-[#00D4FF]' : 'border-[#C9A84C]'}`} />
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 ${isRadiant ? 'border-[#00D4FF]' : 'border-[#C9A84C]'}`} />

            <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                    <div className="w-12 h-14 bg-slate-900 border border-[#C9A84C] rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner">
                        <div className="w-full h-full bg-linear-to-t from-black via-slate-900 to-slate-800 flex items-center justify-center text-xs font-black text-[#C9A84C]">
                            {player.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="absolute top-0.5 right-0.5 bg-[#C9A84C] text-black p-0.5 rounded shadow">
                            <Crown className="w-2.5 h-2.5 fill-black" />
                        </div>
                    </div>
                    <div
                        className="absolute -bottom-1 -left-1 px-1 text-[7px] font-black rounded border"
                        style={{ borderColor: role.hex, color: role.hex, backgroundColor: '#020617' }}
                    >
                        P{player.pos}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="font-black text-xs text-white truncate flex items-center gap-1">
                            {player.name}
                            <span className={`text-[7px] px-1 rounded border ${isRadiant ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40' : 'bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/40'}`}>
                                CAPTAIN
                            </span>
                        </div>
                        <span className="text-[8px] font-black" style={{ color: role.hex }}>
                            {role.name}
                        </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[8px] bg-black/60 px-2 py-0.5 rounded border border-white/5">
                        <span className="text-[#C9A84C] font-bold">{player.currentElo} ELO</span>
                        <span className="text-zinc-500">|</span>
                        <span className="text-emerald-400 font-bold">{player.winRate}% WR</span>
                        <span className="text-zinc-500">|</span>
                        <span className={isRadiant ? 'text-[#00D4FF] font-black' : 'text-[#C9A84C] font-black'}>ORIGIN</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ----------------------------------------------------
   2. VERTICAL 2x2 DRAFTED CARD (Glow Effect)
---------------------------------------------------- */
function VerticalDraftedCard({
    player,
    teamSide,
    isJustDrafted,
}: {
    player: PlayerData;
    teamSide: 'RADIANT' | 'DIRE';
    isJustDrafted?: boolean;
}) {
    const role = ROLE_THEMES[player.pos];
    const isRadiant = teamSide === 'RADIANT';

    return (
        <div
            className={`relative group w-full h-45 bg-slate-950 border-2 rounded-xl p-2 font-mono flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${isRadiant
                ? 'border-[#00D4FF]/60 shadow-[0_0_15px_rgba(0,212,255,0.25)] hover:border-[#00D4FF] hover:shadow-[0_0_25px_rgba(0,212,255,0.55)]'
                : 'border-[#C9A84C]/70 shadow-[0_0_15px_rgba(201,168,76,0.3)] hover:border-[#C9A84C] hover:shadow-[0_0_25px_rgba(201,168,76,0.6)]'
                } ${isJustDrafted ? 'animate-team-slam' : ''}`}
            style={{ transformStyle: 'preserve-3d' }}
        >
            <div className={`absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 ${isRadiant ? 'border-[#00D4FF]' : 'border-[#C9A84C]'}`} />
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 ${isRadiant ? 'border-[#00D4FF]' : 'border-[#C9A84C]'}`} />

            {player.pickOrder && (
                <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded bg-linear-to-r from-[#C9A84C] to-amber-500 text-black text-[8px] font-black shadow-[0_0_10px_rgba(201,168,76,0.8)]">
                    #{player.pickOrder} PICK
                </div>
            )}

            <div className="relative w-full h-22 bg-slate-900 border border-[#C9A84C]/50 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                <div className="w-full h-full bg-linear-to-tr from-black via-slate-900 to-[#1e2433] flex flex-col items-center justify-center relative">
                    <span className="text-[8px] text-[#C9A84C] font-bold tracking-wider">GACHA CARD</span>
                    <span className="text-sm font-black text-white group-hover:scale-110 transition-transform duration-300">{player.avatarPlaceholder || player.name.substring(0, 2).toUpperCase()}</span>
                    {isJustDrafted && (
                        <div className="absolute inset-0 bg-linear-to-t from-[#00D4FF]/30 to-[#C9A84C]/30 animate-pulse pointer-events-none" />
                    )}
                </div>
                <div
                    className="absolute bottom-1 left-1 px-1 text-[7px] font-black rounded border shadow"
                    style={{ borderColor: role.hex, color: role.hex, backgroundColor: '#020617' }}
                >
                    POS {player.pos}
                </div>
            </div>

            <div className="space-y-1 mt-1">
                <div className="flex items-center justify-between">
                    <div className="font-black text-[11px] text-white truncate group-hover:text-cyan-300 transition-colors">{player.name}</div>
                    <span className="text-[7px] font-bold" style={{ color: role.hex }}>{role.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[8px] bg-black/60 p-1 rounded border border-white/5 text-center">
                    <div>
                        <div className="text-[6px] text-zinc-500 uppercase">ELO</div>
                        <div className="font-black text-[#C9A84C]">{player.currentElo}</div>
                    </div>
                    <div>
                        <div className="text-[6px] text-zinc-500 uppercase">WIN RATE</div>
                        <div className="font-black text-emerald-400">{player.winRate}%</div>
                    </div>
                </div>
            </div>

            <div
                className={`w-full py-0.5 rounded border flex items-center justify-center gap-1 text-[7px] font-black tracking-wider ${isRadiant
                    ? 'bg-[#00D4FF]/15 border-[#00D4FF]/40 text-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.2)]'
                    : 'bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C] shadow-[0_0_8px_rgba(201,168,76,0.2)]'
                    }`}
            >
                <CheckCircle2 className={`w-2.5 h-2.5 ${isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}`} />
                {player.isSecondaryFill ? 'LOCKED (+20 FILL)' : 'LOCKED IN'}
            </div>
        </div>
    );
}

/* ----------------------------------------------------
   3. EMPTY 2x2 SLOT
---------------------------------------------------- */
function VerticalEmptySlot({
    slotIndex,
    isTeamActive,
    teamSide,
}: {
    slotIndex: number;
    isTeamActive?: boolean;
    teamSide?: 'RADIANT' | 'DIRE';
}) {
    const isRadiant = teamSide === 'RADIANT';
    return (
        <div
            className={`w-full h-45 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 font-mono text-center p-2 transition-all duration-300 ${isTeamActive
                ? isRadiant
                    ? 'bg-[#00D4FF]/5 border-[#00D4FF]/60 text-[#00D4FF] shadow-[0_0_20px_rgba(0,212,255,0.3)] animate-pulse'
                    : 'bg-[#C9A84C]/5 border-[#C9A84C]/60 text-[#C9A84C] shadow-[0_0_20px_rgba(201,168,76,0.3)] animate-pulse'
                : 'bg-slate-950/40 border-slate-800 text-zinc-600 hover:border-slate-700'
                }`}
        >
            <UserPlus className={`w-5 h-5 ${isTeamActive ? isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]' : 'text-zinc-700'}`} />
            <span className="text-[9px] font-bold uppercase tracking-wider">MEMBER SLOT #{slotIndex}</span>
            <span className="text-[8px]">{isTeamActive ? 'READY TO RECEIVE PICK' : 'AWAITING DRAFT'}</span>
        </div>
    );
}

/* ----------------------------------------------------
   4. 3D 10-SLOT MATRIX S-PATTERN
---------------------------------------------------- */
interface MatrixSlot {
    slotId: number;
    label: string;
    assignedTeam: 'RADIANT' | 'DIRE';
    player?: PlayerData;
}

function SnakeMatrix10Slots3D({
    slots,
    currentTurn,
    justDraftedId,
    timeLeft,
    isDraftComplete,
}: {
    slots: MatrixSlot[];
    currentTurn: number;
    justDraftedId: string | null;
    timeLeft: number;
    isDraftComplete: boolean;
}) {
    const activeTeam = slots[currentTurn]?.assignedTeam;

    return (
        <div className="w-full h-full flex flex-col justify-between items-center font-mono">
            <div className="w-full flex justify-between items-center bg-slate-950 border border-slate-800 p-3.5 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <div>
                    <div className="text-[9px] text-zinc-400 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-[#C9A84C]" /> ACTIVE PROTOCOL TURN
                    </div>
                    <div className="text-sm font-black mt-0.5 flex items-center gap-2">
                        {!isDraftComplete && activeTeam ? (
                            <>
                                <span className={activeTeam === 'RADIANT' ? 'text-[#00D4FF] drop-shadow-[0_0_10px_rgba(0,212,255,0.8)]' : 'text-[#C9A84C] drop-shadow-[0_0_10px_rgba(201,168,76,0.8)]'}>
                                    {activeTeam}
                                </span>
                                <span className="text-zinc-400 text-xs">(Slot #{currentTurn + 1})</span>
                            </>
                        ) : (
                            <span className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">DRAFT COMPLETED</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isDraftComplete && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-black text-xs transition-all ${timeLeft <= 5
                            ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-ping'
                            : timeLeft <= 10
                                ? 'bg-rose-500/10 border-rose-500/50 text-rose-400 animate-pulse'
                                : 'bg-slate-900 border-[#C9A84C]/40 text-[#C9A84C]'
                            }`}>
                            <Timer className="w-3.5 h-3.5" />
                            <span>{timeLeft}s</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full py-6 flex items-center justify-center perspective-[1400px]">
                <div
                    className="grid grid-cols-5 gap-3 md:gap-3.5 scale-95 md:scale-100 transition-transform duration-700"
                    style={{
                        transform: 'rotateX(46deg) rotateZ(-18deg)',
                        transformStyle: 'preserve-3d',
                    }}
                >
                    {slots.map((node, i) => {
                        const isActive = i === currentTurn && !isDraftComplete;
                        const isAssigned = !!node.player;
                        const isRadiant = node.assignedTeam === 'RADIANT';
                        const isLanding = node.player && node.player.id === justDraftedId;
                        const role = node.player ? ROLE_THEMES[node.player.pos] : null;

                        return (
                            <div
                                key={node.slotId}
                                className={`w-22 h-26.25 rounded-xl flex flex-col justify-between p-1.5 transition-all duration-500 border-2 relative overflow-hidden cursor-pointer hover:scale-110 ${isLanding
                                    ? 'animate-matrix-vortex-slam'
                                    : isActive
                                        ? isRadiant
                                            ? 'bg-[#00D4FF]/20 border-[#00D4FF] shadow-[0_0_30px_rgba(0,212,255,1)] scale-105'
                                            : 'bg-[#C9A84C]/20 border-[#C9A84C] shadow-[0_0_30px_rgba(201,168,76,1)] scale-105'
                                        : isAssigned
                                            ? isRadiant
                                                ? 'bg-slate-900 border-[#00D4FF]/80 shadow-[0_0_18px_rgba(0,212,255,0.45)] hover:shadow-[0_0_25px_rgba(0,212,255,0.8)]'
                                                : 'bg-slate-900 border-[#C9A84C]/80 shadow-[0_0_18px_rgba(201,168,76,0.45)] hover:shadow-[0_0_25px_rgba(201,168,76,0.8)]'
                                            : 'bg-slate-950/80 border-slate-800 text-zinc-600 hover:border-slate-600'
                                    }`}
                                style={{
                                    boxShadow: isActive
                                        ? isRadiant
                                            ? '0 8px 0 #0E7490, 0 0 25px rgba(0,212,255,0.9)'
                                            : '0 8px 0 #854D0E, 0 0 25px rgba(201,168,76,0.9)'
                                        : '0 5px 0 #020617',
                                    transform: isLanding
                                        ? 'translateZ(45px)'
                                        : isActive
                                            ? 'translateZ(25px)'
                                            : 'translateZ(0px)',
                                    transformStyle: 'preserve-3d',
                                }}
                            >
                                {node.player ? (
                                    <div className="w-full h-full flex flex-col justify-between text-center relative z-10">
                                        <div className="flex justify-between items-center text-[7px] font-black">
                                            <span className={isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}>
                                                {node.assignedTeam}
                                            </span>
                                            <span className="text-[6px] text-zinc-400">#{i + 1}</span>
                                        </div>

                                        <div className="w-8 h-8 mx-auto rounded bg-slate-950 border border-[#C9A84C]/60 flex items-center justify-center text-[9px] font-black text-[#C9A84C] shadow">
                                            {node.player.name.substring(0, 2).toUpperCase()}
                                        </div>

                                        <div>
                                            <div className="text-[8px] font-black text-white truncate px-0.5">
                                                {node.player.name}
                                            </div>
                                            <div
                                                className="text-[6px] font-black px-1 py-0.2 rounded mt-0.5"
                                                style={{ color: role?.hex, backgroundColor: '#020617' }}
                                            >
                                                POS {node.player.pos} ({role?.name})
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                        <span className="text-[8px] text-zinc-500 font-bold">SLOT #{i + 1}</span>
                                        <span className={`text-[9px] font-black mt-1 ${isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}`}>
                                            {node.assignedTeam}
                                        </span>
                                        <span className="text-[6px] text-zinc-600 mt-1">AWAITING</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="w-full bg-slate-950 p-2.5 rounded-xl border border-[#C9A84C]/30 text-[10px] text-zinc-400 text-center flex items-center justify-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-[#C9A84C]" />
                <span>ระบบจำกัดเวลา 30 วิ/รอบ: หากกัปตันไม่ทำการเลือก ระบบจะดำเนินการ Random Pick ให้ทันที</span>
            </div>
        </div>
    );
}

/* ----------------------------------------------------
   5. MASTER GOLD PLAYER CARD (Enhanced Neon Cyberpunk Glow)
---------------------------------------------------- */
function MasterGoldPlayerCard({
    player,
    isDrafting,
    disabled,
    onPick,
}: {
    player: PlayerData;
    isDrafting?: boolean;
    disabled?: boolean;
    onPick: () => void;
}) {
    const role = ROLE_THEMES[player.pos];

    return (
        <div
            className={`relative group w-full bg-slate-950 border-2 border-[#C9A84C]/50 hover:border-[#00D4FF] rounded-xl p-3 font-mono shadow-[0_0_20px_rgba(0,0,0,0.9)] hover:shadow-[0_0_30px_rgba(0,212,255,0.6)] transition-all duration-300 transform hover:-translate-y-1.5 cursor-pointer ${isDrafting ? 'animate-card-pick-warp pointer-events-none' : ''
                }`}
            style={{ transformStyle: 'preserve-3d' }}
        >
            {/* Ambient Background Glow Layer */}
            <div className="absolute inset-0 rounded-xl bg-linear-to-b from-[#00D4FF]/5 via-transparent to-[#C9A84C]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* Corner Bracket Accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#C9A84C] group-hover:border-[#00D4FF] transition-colors duration-300" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#C9A84C] group-hover:border-[#00D4FF] transition-colors duration-300" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#C9A84C] group-hover:border-[#00D4FF] transition-colors duration-300" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#C9A84C] group-hover:border-[#00D4FF] transition-colors duration-300" />

            <div className="flex items-center gap-3 relative z-10">
                <div className="relative shrink-0">
                    <div className="w-14 h-18 bg-slate-900 border-2 border-[#C9A84C]/80 group-hover:border-[#00D4FF] group-hover:shadow-[0_0_15px_rgba(0,212,255,0.5)] rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner group-hover:scale-105 transition-all duration-300">
                        <div className="w-full h-full bg-linear-to-tr from-black via-slate-900 to-[#1e2538] flex flex-col items-center justify-center">
                            <span className="text-[8px] text-[#C9A84C] group-hover:text-[#00D4FF] font-bold transition-colors">GACHA</span>
                            <span className="text-xs font-black text-white group-hover:text-cyan-200 transition-colors">{player.avatarPlaceholder || player.name.substring(0, 2).toUpperCase()}</span>
                        </div>
                    </div>
                    <div
                        className="absolute -bottom-2 -left-1 px-1.5 py-0.2 text-[8px] font-black rounded border tracking-wider shadow-md"
                        style={{ borderColor: role.hex, color: role.hex, backgroundColor: '#020617' }}
                    >
                        POS {player.pos}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 border-b border-[#C9A84C]/20 group-hover:border-[#00D4FF]/30 pb-1 transition-colors">
                        <div className="font-black text-xs text-zinc-100 truncate group-hover:text-cyan-300 transition-colors">{player.name}</div>
                        <span className="text-[8px] font-black tracking-wider" style={{ color: role.hex }}>
                            {role.name.toUpperCase()}
                        </span>
                    </div>

                    <div className="mt-1.5 bg-slate-900 border border-[#C9A84C]/40 group-hover:border-[#00D4FF]/40 rounded p-1.5 grid grid-cols-3 gap-1 text-[8px] transition-colors">
                        <div>
                            <div className="text-zinc-500 text-[6px] uppercase font-bold">Current Elo</div>
                            <div className="font-black text-[#C9A84C] group-hover:text-[#00D4FF] mt-0.5 transition-colors">{player.currentElo}</div>
                        </div>
                        <div>
                            <div className="text-zinc-500 text-[6px] uppercase font-bold">Peak Elo</div>
                            <div className="font-black text-zinc-300 mt-0.5">{player.peakElo}</div>
                        </div>
                        <div>
                            <div className="text-zinc-500 text-[6px] uppercase font-bold">Win Rate</div>
                            <div className="font-black text-emerald-400 mt-0.5">{player.winRate}%</div>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 flex flex-col items-center justify-between h-18 py-0.5">
                    <div className="relative w-7 h-7 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00D4FF] animate-spin" style={{ animationDuration: '8s' }} />
                        <div className="w-4 h-4 rounded-full border border-[#C9A84C] group-hover:border-[#00D4FF] flex items-center justify-center text-[5px] font-black text-[#C9A84C] group-hover:text-[#00D4FF] transition-colors">
                            HUD
                        </div>
                    </div>

                    <div className="flex gap-1 items-center">
                        {player.authProviders.includes('steam') && (
                            <span className="w-3.5 h-3.5 rounded bg-[#171a21] border border-[#00D4FF]/60 flex items-center justify-center text-[7px] text-[#00D4FF] font-black shadow-[0_0_8px_rgba(0,212,255,0.4)]">
                                S
                            </span>
                        )}
                        {player.authProviders.includes('google') && (
                            <span className="w-3.5 h-3.5 rounded bg-zinc-900 border border-[#C9A84C]/60 flex items-center justify-center text-[7px] text-[#C9A84C] font-black shadow-[0_0_8px_rgba(201,168,76,0.4)]">
                                G
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <button
                disabled={disabled}
                onClick={onPick}
                className={`mt-2.5 w-full py-2 rounded-lg text-xs font-black transition-all duration-300 flex items-center justify-center gap-1.5 shadow ${disabled
                    ? 'bg-slate-800 text-zinc-600 border border-slate-700 cursor-not-allowed opacity-50'
                    : 'bg-linear-to-r from-[#C9A84C]/20 via-[#C9A84C]/40 to-[#C9A84C]/20 hover:from-[#00D4FF] hover:to-cyan-400 text-[#C9A84C] hover:text-black border border-[#C9A84C]/60 hover:border-[#00D4FF] hover:shadow-[0_0_25px_rgba(0,212,255,0.8)] cursor-pointer'
                    }`}
            >
                <Zap className="w-3.5 h-3.5 fill-current" /> DRAFT INTO PROTOCOL <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

/* ----------------------------------------------------
   6. MAIN DRAFT PAGE
---------------------------------------------------- */
export default function SnakeDraftPage() {
    const router = useRouter();
    const [currentTurn, setCurrentTurn] = useState<number>(2);
    const [justDraftedId, setJustDraftedId] = useState<string | null>(null);
    const [launchingId, setLaunchingId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(30);

    const captainRadiant: PlayerData = {
        id: 'c1',
        name: '23savage_AFI',
        pos: 1,
        roleName: 'Hard Carry',
        currentElo: 2350,
        peakElo: 2420,
        winRate: 68,
        isCaptain: true,
        authProviders: ['steam', 'google'],
    };

    const captainDire: PlayerData = {
        id: 'c4',
        name: 'Devil-llou',
        pos: 1,
        roleName: 'Hard Carry',
        currentElo: 2310,
        peakElo: 2390,
        winRate: 66,
        isCaptain: true,
        authProviders: ['steam', 'google'],
    };

    const [teamRadiant, setTeamRadiant] = useState<PlayerData[]>([captainRadiant]);
    const [teamDire, setTeamDire] = useState<PlayerData[]>([captainDire]);

    const [matrixSlots, setMatrixSlots] = useState<MatrixSlot[]>([
        { slotId: 1, label: 'C1', assignedTeam: 'RADIANT', player: captainRadiant },
        { slotId: 2, label: 'C2', assignedTeam: 'DIRE', player: captainDire },
        { slotId: 3, label: 'Pick #1', assignedTeam: 'DIRE' },
        { slotId: 4, label: 'Pick #2', assignedTeam: 'RADIANT' },
        { slotId: 5, label: 'Pick #3', assignedTeam: 'RADIANT' },
        { slotId: 6, label: 'Pick #4', assignedTeam: 'DIRE' },
        { slotId: 7, label: 'Pick #5', assignedTeam: 'DIRE' },
        { slotId: 8, label: 'Pick #6', assignedTeam: 'RADIANT' },
        { slotId: 9, label: 'Pick #7', assignedTeam: 'RADIANT' },
        { slotId: 10, label: 'Pick #8', assignedTeam: 'DIRE' },
    ]);

    const [availablePool, setAvailablePool] = useState<PlayerData[]>([
        { id: 'p-1', name: 'Mikoto_God', pos: 2, roleName: 'Mid Laner', currentElo: 2280, peakElo: 2310, winRate: 64, authProviders: ['steam'] },
        { id: 'p-2', name: 'Cyber_Phantom', pos: 2, roleName: 'Mid Laner', currentElo: 2240, peakElo: 2280, winRate: 63, authProviders: ['steam'] },
        { id: 'p-3', name: 'Jabz_322', pos: 3, roleName: 'Offlaner', currentElo: 2190, peakElo: 2250, winRate: 61, authProviders: ['steam', 'google'] },
        { id: 'p-4', name: 'Neon_Viper', pos: 3, roleName: 'Offlaner', currentElo: 2170, peakElo: 2200, winRate: 60, authProviders: ['steam', 'google'] },
        { id: 'p-5', name: 'Q_Support', pos: 4, roleName: 'Soft Support', currentElo: 2110, peakElo: 2150, winRate: 59, authProviders: ['steam'] },
        { id: 'p-6', name: 'TIMS_Soft', pos: 4, roleName: 'Soft Support', currentElo: 2160, peakElo: 2210, winRate: 62, authProviders: ['steam', 'google'] },
        { id: 'p-7', name: 'Whitemon_V2', pos: 5, roleName: 'Hard Support', currentElo: 2090, peakElo: 2120, winRate: 58, authProviders: ['steam', 'google'] },
        { id: 'p-8', name: 'Jaunuel_Ward', pos: 5, roleName: 'Hard Support', currentElo: 2070, peakElo: 2100, winRate: 56, authProviders: ['steam'], isSecondaryFill: true },
    ]);

    const isDraftComplete = currentTurn >= 10 || availablePool.length === 0;
    const currentActiveTeam = !isDraftComplete ? matrixSlots[currentTurn]?.assignedTeam : null;

    const stateRef = useRef({ currentTurn, matrixSlots, teamRadiant, teamDire, availablePool, isDraftComplete });
    useEffect(() => {
        stateRef.current = { currentTurn, matrixSlots, teamRadiant, teamDire, availablePool, isDraftComplete };
    }, [currentTurn, matrixSlots, teamRadiant, teamDire, availablePool, isDraftComplete]);

    const executePick = useCallback((player: PlayerData) => {
        if (stateRef.current.isDraftComplete || launchingId) return;

        setLaunchingId(player.id);
        setTimeLeft(30);

        setTimeout(() => {
            const { currentTurn: turn, matrixSlots: slots, teamRadiant: radiant, teamDire: dire } = stateRef.current;
            const targetSlot = slots[turn];
            if (!targetSlot) {
                setLaunchingId(null);
                return;
            }

            setJustDraftedId(player.id);
            const isRadiant = targetSlot.assignedTeam === 'RADIANT';

            if (isRadiant) {
                const pickNum = radiant.filter((p) => !p.isCaptain).length + 1;
                setTeamRadiant((prev) => [...prev, { ...player, pickOrder: pickNum }]);
            } else {
                const pickNum = dire.filter((p) => !p.isCaptain).length + 1;
                setTeamDire((prev) => [...prev, { ...player, pickOrder: pickNum }]);
            }

            setMatrixSlots((prev) => prev.map((s, idx) => (idx === turn ? { ...s, player } : s)));
            setAvailablePool((prev) => prev.filter((p) => p.id !== player.id));
            setCurrentTurn((prev) => prev + 1);
            setTimeLeft(30);

            setLaunchingId(null);
            setTimeout(() => {
                setJustDraftedId(null);
            }, 700);
        }, 400);
    }, [launchingId]);

    // Timer Interval Engine
    useEffect(() => {
        if (isDraftComplete || launchingId) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [isDraftComplete, launchingId, currentTurn]);

    // Auto-Pick Trigger on Timeout
    useEffect(() => {
        if (timeLeft <= 0 && !isDraftComplete && !launchingId) {
            const { availablePool: pool } = stateRef.current;
            if (pool.length > 0) {
                const randomIndex = Math.floor(Math.random() * pool.length);
                executePick(pool[randomIndex]);
            }
        }
    }, [timeLeft, isDraftComplete, launchingId, executePick]);

    const renderTeamSection = (team: PlayerData[], side: 'RADIANT' | 'DIRE') => {
        const captain = team.find((p) => p.isCaptain);
        const members = team.filter((p) => !p.isCaptain);
        const emptySlotCount = 4 - members.length;
        const isTeamActive = currentActiveTeam === side && !isDraftComplete;

        return (
            <div className="flex flex-col justify-between h-full space-y-3">
                {captain && <CaptainHeaderCard player={captain} teamSide={side} />}

                <div className="grid grid-cols-2 gap-2.5 flex-1 items-stretch">
                    {members.map((m) => (
                        <VerticalDraftedCard
                            key={m.id}
                            player={m}
                            teamSide={side}
                            isJustDrafted={m.id === justDraftedId}
                        />
                    ))}
                    {Array.from({ length: emptySlotCount }).map((_, idx) => (
                        <VerticalEmptySlot
                            key={idx}
                            slotIndex={members.length + idx + 1}
                            isTeamActive={isTeamActive && idx === 0}
                            teamSide={side}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white pt-20 pb-16 px-4 md:px-6 font-mono relative overflow-hidden">
            <style jsx global>{`
                @keyframes cardPickWarp {
                    0% { transform: perspective(800px) rotateX(0deg) rotateY(0deg) scale(1); opacity: 1; }
                    50% { transform: perspective(800px) rotateX(-20deg) rotateY(360deg) translateY(-40px) scale(1.1); opacity: 0.9; filter: drop-shadow(0 0 30px #00D4FF) drop-shadow(0 0 50px #C9A84C); }
                    100% { transform: perspective(800px) rotateX(-40deg) rotateY(720deg) translateY(-100px) scale(0.2); opacity: 0; filter: drop-shadow(0 0 60px #C9A84C); }
                }
                .animate-card-pick-warp { animation: cardPickWarp 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards; }

                @keyframes matrixVortexSlam {
                    0% { transform: translateZ(120px) rotateZ(180deg) scale(1.4); opacity: 0; filter: brightness(2.5) drop-shadow(0 0 35px #C9A84C); }
                    60% { transform: translateZ(35px) rotateZ(-10deg) scale(1.05); opacity: 1; filter: brightness(1.5) drop-shadow(0 0 25px #00D4FF); }
                    100% { transform: translateZ(0px) rotateZ(0deg) scale(1); opacity: 1; filter: brightness(1) drop-shadow(0 0 15px rgba(201,168,76,0.5)); }
                }
                .animate-matrix-vortex-slam { animation: matrixVortexSlam 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

                @keyframes teamSlam {
                    0% { transform: perspective(700px) rotateY(-90deg) scale(0.7); opacity: 0; filter: drop-shadow(0 0 25px #00D4FF); }
                    70% { transform: perspective(700px) rotateY(15deg) scale(1.05); opacity: 1; filter: drop-shadow(0 0 15px #C9A84C); }
                    100% { transform: perspective(700px) rotateY(0deg) scale(1); opacity: 1; filter: drop-shadow(0 0 0 transparent); }
                }
                .animate-team-slam { animation: teamSlam 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
            `}</style>

            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] font-bold flex items-center gap-1.5 w-fit">
                            <Zap className="w-3 h-3 text-[#C9A84C]" /> CAPTAIN DRAFT SYSTEM
                        </span>
                        <h1 className="text-xl font-black text-white mt-1 font-['Orbitron']">
                            SNAKE DRAFT ARENA
                        </h1>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono">FEATURE-4210 BALANCED</div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    {/* Radiant Team Column */}
                    <div
                        className={`lg:col-span-4 bg-slate-900/90 rounded-2xl p-4 flex flex-col justify-between h-full min-h-145 transition-all duration-500 ${currentActiveTeam === 'RADIANT'
                            ? 'border-2 border-[#00D4FF] shadow-[0_0_30px_rgba(0,212,255,0.4)] scale-[1.01]'
                            : 'border border-[#00D4FF]/30 opacity-85'
                            }`}
                    >
                        <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2 mb-1">
                            <div className="flex items-center gap-1.5">
                                <Shield className="w-4 h-4 text-[#00D4FF]" />
                                <span className="font-black text-xs text-[#00D4FF] font-['Orbitron']">1: RADIANT (C1)</span>
                                {currentActiveTeam === 'RADIANT' && (
                                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#00D4FF] text-black font-black animate-pulse shadow-[0_0_10px_rgba(0,212,255,0.8)]">
                                        ACTIVE PICK
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-zinc-400">{teamRadiant.length}/5 PLAYERS</span>
                        </div>
                        {renderTeamSection(teamRadiant, 'RADIANT')}
                    </div>

                    {/* 3D Matrix Column */}
                    <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 min-h-145 h-full flex flex-col justify-between shadow-2xl">
                        <SnakeMatrix10Slots3D
                            slots={matrixSlots}
                            currentTurn={currentTurn}
                            justDraftedId={justDraftedId}
                            timeLeft={timeLeft}
                            isDraftComplete={isDraftComplete}
                        />
                    </div>

                    {/* Dire Team Column */}
                    <div
                        className={`lg:col-span-4 bg-slate-900/90 rounded-2xl p-4 flex flex-col justify-between h-full min-h-145 transition-all duration-500 ${currentActiveTeam === 'DIRE'
                            ? 'border-2 border-[#C9A84C] shadow-[0_0_30px_rgba(201,168,76,0.5)] scale-[1.01]'
                            : 'border border-[#C9A84C]/40 opacity-85'
                            }`}
                    >
                        <div className="flex items-center justify-between border-b border-[#C9A84C]/20 pb-2 mb-1">
                            <div className="flex items-center gap-1.5">
                                <Flame className="w-4 h-4 text-[#C9A84C]" />
                                <span className="font-black text-xs text-[#C9A84C] font-['Orbitron']">2: DIRE (C4)</span>
                                {currentActiveTeam === 'DIRE' && (
                                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#C9A84C] text-black font-black animate-pulse shadow-[0_0_10px_rgba(201,168,76,0.8)]">
                                        ACTIVE PICK
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-zinc-400">{teamDire.length}/5 PLAYERS</span>
                        </div>
                        {renderTeamSection(teamDire, 'DIRE')}
                    </div>
                </div>

                {/* Available Players Pool */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                            <Swords className="w-4 h-4 text-[#C9A84C]" />
                            <span className="font-black text-xs text-slate-200">3: AVAILABLE PLAYERS POOL</span>
                            <span className="text-[10px] text-zinc-400">
                                {isDraftComplete ? '(0 Draft Completed)' : `(${availablePool.length} Waiting to be drafted)`}
                            </span>
                        </div>
                    </div>

                    {isDraftComplete ? (
                        <div className="w-full py-8 flex flex-col items-center justify-center text-zinc-400 font-mono space-y-3 animate-in fade-in zoom-in duration-500">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                            <span className="text-emerald-400 font-black text-lg tracking-widest">
                                DRAFT PROTOCOL COMPLETED
                            </span>
                            <button
                                onClick={() => router.push(`/match/daily_${Date.now()}`)}
                                className="px-6 py-2.5 bg-linear-to-r from-[#00D4FF] to-cyan-600 hover:from-cyan-400 hover:to-[#00D4FF] text-slate-950 font-black text-xs rounded-lg tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:shadow-[0_0_30px_rgba(0,212,255,0.8)] hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                PROCEED TO MATCH SERVER →
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {availablePool.map((player) => (
                                <MasterGoldPlayerCard
                                    key={player.id}
                                    player={player}
                                    isDrafting={player.id === launchingId}
                                    disabled={isDraftComplete || launchingId !== null}
                                    onPick={() => executePick(player)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}