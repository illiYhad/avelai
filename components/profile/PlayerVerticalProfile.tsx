'use client';

import React from 'react';
import Image from 'next/image';
export interface PlayerVerticalProfileProps {
  userId?: string;
  username?: string;
  avatarUrl?: string;
  rankTitle?: string;
  subTier?: 'PRO_380' | 'FREE';
  gachaFrameUrl?: string | null; // Slot รองรับ Dynamic Avatar Frame จาก Genesis_Gacha
  gachaTitleBadgeUrl?: string | null; // Slot สำหรับป้ายฉายา/Cosmetic Badge
  circuitPoints?: number;
  tokens?: number;
  cashBalanceThb?: number;
  isLoading?: boolean;
}

export const PlayerVerticalProfile: React.FC<PlayerVerticalProfileProps> = ({
  userId = 'usr_unknown',
  username = 'CyberOperator',
  avatarUrl,
  rankTitle = 'Cyber Duelist IV',
  subTier = 'FREE',
  gachaFrameUrl = null,
  gachaTitleBadgeUrl = null,
  circuitPoints = 0,
  tokens = 0,
  cashBalanceThb = 0,
  isLoading = false,
}) => {
  // Skeleton Loading Fallback State
  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[420px] bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-6 flex flex-col items-center justify-between animate-pulse relative overflow-hidden backdrop-blur-md">
        <div className="w-full flex justify-between items-center">
          <div className="h-4 w-16 bg-slate-800 rounded" />
          <div className="h-4 w-12 bg-slate-800 rounded-full" />
        </div>
        <div className="h-28 w-28 rounded-2xl bg-slate-800 mt-4" />
        <div className="w-full space-y-2 mt-4 text-center">
          <div className="h-5 w-32 bg-slate-800 mx-auto rounded" />
          <div className="h-3 w-20 bg-slate-800 mx-auto rounded" />
        </div>
        <div className="w-full space-y-2 mt-6">
          <div className="h-10 w-full bg-slate-800 rounded-xl" />
          <div className="h-10 w-full bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  const isPro = subTier === 'PRO_380';

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-2xl backdrop-blur-md transition-all duration-300 group overflow-hidden">
      {/* Cyberpunk Decorative Corner Cut / Accent Lines */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-8 h-[2px] bg-cyan-400/60" />
      <div className="absolute top-0 left-0 w-[2px] h-8 bg-cyan-400/60" />

      {/* 1. Header: Sub Tier & Operator ID */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
            ID: {userId}
          </span>
          <span
            className={`text-[10px] font-black px-2.5 py-0.5 rounded-md tracking-wider border font-mono uppercase ${isPro
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
          >
            {isPro ? 'PRO 380' : 'FREE TIER'}
          </span>
        </div>

        {/* 2. Avatar & Genesis_Gacha Frame Slot */}
        <div className="relative flex justify-center mt-6 mb-4">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Base Avatar Image / Placeholder */}
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 group-hover:border-cyan-400/50 transition-colors flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-mono text-3xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                  {username.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* GENESIS_GACHA SLOT: Custom Cosmetic Frame */}
            {gachaFrameUrl ? (
              <img
                src={gachaFrameUrl}
                alt="Gacha Frame"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse"
              />
            ) : (
              // Default Fallback Cyber Ring (เมื่อยังไม่สวม Frame จาก Gacha)
              <div className="absolute inset-0 border border-dashed border-cyan-500/30 rounded-2xl pointer-events-none group-hover:scale-105 transition-transform" />
            )}
          </div>
        </div>

        {/* 3. Name & Gacha Title Slot */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-black text-white tracking-wide truncate group-hover:text-cyan-300 transition-colors font-mono">
            {username}
          </h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>{rankTitle}</span>
          </div>

          {/* Optional: Cosmetic Title / Badge จาก Gacha */}
          {gachaTitleBadgeUrl && (
            <div className="mt-1 flex justify-center">
              <img src={gachaTitleBadgeUrl} alt="Title Badge" className="h-5 object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* 4. Competitive Stats (Circuit Points & Wallets) */}
      <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-800/80">
        {/* Circuit Points Metric */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
              Circuit Points
            </div>
            <div className="text-base font-black text-indigo-400 font-mono">
              {circuitPoints.toLocaleString()} <span className="text-[11px] font-normal text-slate-500">CP</span>
            </div>
          </div>
          <div className="text-indigo-400/40 text-xl font-mono font-black">#88</div>
        </div>

        {/* Tokens & Cash Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-950/70 border border-amber-500/20 rounded-xl p-2.5">
            <div className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">
              Tokens
            </div>
            <div className="text-xs font-black text-amber-400 font-mono">
              {tokens} <span className="text-[10px] text-slate-500 font-normal">({tokens * 9}฿)</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-emerald-500/20 rounded-xl p-2.5">
            <div className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">
              Cash Pot
            </div>
            <div className="text-xs font-black text-emerald-400 font-mono">
              ฿{cashBalanceThb.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};