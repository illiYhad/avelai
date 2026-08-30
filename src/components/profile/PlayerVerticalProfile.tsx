/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import Link from 'next/link';

export interface PlayerVerticalProfileProps {
    userId: string;
    username: string;
    avatarUrl?: string;
    rankTitle: string;
    subTier: 'PRO_380' | 'FREE';
    gachaFrameUrl: string | null;
    circuitPoints: number;
    tokens: number;
    cashBalanceThb: number;
}

export function PlayerVerticalProfile({
    userId,
    username,
    rankTitle,
    subTier,
    gachaFrameUrl,
    circuitPoints,
    tokens,
    cashBalanceThb,
}: PlayerVerticalProfileProps) {
    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl space-y-6">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <span>ID: {userId.toUpperCase()}</span>
                <span className="px-2.5 py-0.5 rounded bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] font-bold">
                    {subTier.replace('_', ' ')}
                </span>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
                <Link href="/tournament/daily" className="relative group cursor-pointer block">
                    <div className="w-24 h-24 rounded-2xl bg-slate-950 border-2 border-[#00D4FF]/40 flex items-center justify-center font-['Orbitron'] font-black text-2xl text-[#00D4FF] shadow-[0_0_20px_rgba(0,212,255,0.2)] overflow-hidden transition-all group-hover:border-[#00D4FF] group-hover:shadow-[0_0_30px_rgba(0,212,255,0.4)]">
                        {gachaFrameUrl ? (
                            <img src={gachaFrameUrl} alt="Avatar Frame" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                            <span className="group-hover:scale-110 transition-transform duration-300">{username.slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-[#C9A84C] text-[#C9A84C] font-bold">
                        PILOT
                    </span>
                </Link>
                <div>
                    <h2 className="text-xl font-bold text-white font-['Orbitron']">{username}</h2>
                    <span className="text-xs font-mono text-[#00D4FF]">● {rankTitle}</span>
                </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3 font-mono">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">CIRCUIT POINTS:</span>
                    <span className="font-bold text-[#00D4FF]">{circuitPoints.toLocaleString()} CP</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">TOKENS:</span>
                    <span className="font-bold text-amber-400">{tokens} Tokens</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">CASH WALLET:</span>
                    <span className="font-bold text-emerald-400">฿{cashBalanceThb.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
}