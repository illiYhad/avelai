/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import Link from 'next/link';

export type IntegrityRarity = 'NONE' | 'COMMON' | 'EPIC' | 'LEGENDARY';
export type PlayerPosition = 1 | 2 | 3 | 4 | 5;

export interface IntegrityCardProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  rarity: IntegrityRarity;
  position: PlayerPosition;
  team: 'TEAM_A' | 'TEAM_B';
  karmaScore?: number;
  winRate?: number;
  cardArtworkUrl?: string;
  isCurrentUser?: boolean;
}

const ROLE_COLORS: Record<PlayerPosition, string> = {
  1: '#E8384F', // Pos 1 - Carry
  2: '#2E9BFF', // Pos 2 - Mid
  3: '#39FF6A', // Pos 3 - Offlane
  4: '#D63CE8', // Pos 4 - Soft Support
  5: '#C8CDD4', // Pos 5 - Hard Support
};

const ROLE_NAMES: Record<PlayerPosition, string> = {
  1: 'POS 1 · CARRY',
  2: 'POS 2 · MID',
  3: 'POS 3 · OFF',
  4: 'POS 4 · SOFT',
  5: 'POS 5 · HARD',
};

export const IntegrityCard: React.FC<IntegrityCardProps> = ({
  displayName,
  avatarUrl,
  rarity,
  position,
  team,
  karmaScore = 100,
  winRate = 50.0,
  cardArtworkUrl,
  isCurrentUser = false,
}) => {
  const roleColor = ROLE_COLORS[position];
  const teamBorder = team === 'TEAM_A' ? '#00D4FF' : '#C9A84C';

  // 1. สถานะไม่มีการ์ด (NONE) -> TFT-Style Empty Slot + FOMO Action Prompt
  if (rarity === 'NONE') {
    return (
      <div className="relative w-full max-w-52.5 h-85 rounded-xl border border-dashed border-gray-700/80 bg-[#0A0A0F]/80 p-4 flex flex-col justify-between items-center text-center backdrop-blur-sm group hover:border-gray-500 transition-colors">
        <div
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
          style={{ borderColor: `${roleColor}55`, color: roleColor, backgroundColor: `${roleColor}15` }}
        >
          {ROLE_NAMES[position]}
        </div>

        <div className="flex flex-col items-center my-auto">
          <div className="w-16 h-16 rounded-full border border-gray-700 bg-gray-900/60 flex items-center justify-center text-gray-500 text-xl font-mono font-bold mb-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full rounded-full object-cover grayscale opacity-60" />
            ) : (
              displayName.slice(0, 2).toUpperCase()
            )}
          </div>
          <span className="text-xs font-mono font-bold text-gray-300 truncate max-w-35">
            {displayName}
          </span>
          <span className="text-[10px] text-gray-600 font-mono mt-0.5">UNPROTECTED</span>
        </div>

        <div className="w-full pt-2 border-t border-gray-800/80">
          {isCurrentUser ? (
            <Link className="block w-full py-2 bg-linear-to-r from-[#00D4FF] to-[#C9A84C] text-[#0A0A0F] font-['Orbitron'] text-[10px] font-black rounded shadow-[0_0_15px_rgba(0,212,255,0.4)] hover:brightness-110 active:scale-95 transition-all text-center tracking-wider" href="/gacha">
              GET INTEGRITY CARD
            </Link>
          ) : (
            <span className="text-[10px] font-mono text-gray-600 tracking-tighter">NO BADGE EQUIPPED</span>
          )}
        </div>
      </div>
    );
  }

  // 2. สไตล์ตามระดับความหายาก (Rarity Tiers)
  const getRarityConfig = () => {
    switch (rarity) {
      case 'LEGENDARY':
        return {
          frameClass: 'border-2 border-[#00D4FF] shadow-[0_0_25px_rgba(0,212,255,0.5)]',
          badgeBg: 'bg-[#00D4FF] text-[#0A0A0F]',
          badgeText: 'LEGENDARY AVE',
          glowLayer: (
            <>
              <div className="absolute -inset-px rounded-xl bg-linear-to-b from-[#00D4FF] via-transparent to-[#C9A84C] opacity-40 animate-pulse pointer-events-none" />
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(0,212,255,0.15)_45%,rgba(201,168,76,0.15)_55%,transparent_80%)] animate-[shimmer_3s_infinite] pointer-events-none" />
            </>
          ),
        };
      case 'EPIC':
        return {
          frameClass: 'border-2 border-[#C9A84C] shadow-[0_0_20px_rgba(201,168,76,0.35)]',
          badgeBg: 'bg-[#C9A84C] text-[#0A0A0F]',
          badgeText: 'EPIC HOLO',
          glowLayer: (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.2),transparent_70%)] pointer-events-none" />
          ),
        };
      case 'COMMON':
      default:
        return {
          frameClass: 'border border-[#C8CDD4]/50 shadow-[0_0_10px_rgba(200,205,212,0.1)]',
          badgeBg: 'bg-[#C8CDD4] text-[#0A0A0F]',
          badgeText: 'COMMON STEEL',
          glowLayer: null,
        };
    }
  };

  const config = getRarityConfig();

  return (
    <div
      className={`relative w-full max-w-52.5 h-85 rounded-xl bg-[#0A0A0F] p-3 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:scale-105 hover:z-20 ${config.frameClass}`}
    >
      {config.glowLayer}

      <div className="relative z-10 flex items-center justify-between">
        <span
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
          style={{ borderColor: `${roleColor}88`, color: roleColor, backgroundColor: `${roleColor}18` }}
        >
          {ROLE_NAMES[position]}
        </span>
        <span className={`text-[8px] font-['Orbitron'] font-black px-1.5 py-0.5 rounded ${config.badgeBg}`}>
          {config.badgeText}
        </span>
      </div>

      <div className="relative z-10 w-full h-38.75 my-1.5 rounded-lg overflow-hidden border border-gray-800 bg-gray-950 flex items-center justify-center">
        {cardArtworkUrl ? (
          <img
            src={cardArtworkUrl}
            alt="Card Artwork"
            className={`w-full h-full object-cover ${rarity === 'LEGENDARY' ? 'scale-110 animate-[float_4s_ease-in-out_infinite]' : ''}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-2">
            <div
              className="w-14 h-14 rounded-full border-2 mb-1.5 overflow-hidden flex items-center justify-center bg-gray-900"
              style={{ borderColor: teamBorder }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-['Orbitron'] font-bold text-white text-lg">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-gray-400">AVE GUARDIAN</span>
          </div>
        )}
      </div>

      <div className="relative z-10 pt-1.5 border-t border-gray-800/80 font-mono">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-white truncate max-w-27.5" title={displayName}>
            {displayName}
          </span>
          <span className="text-[10px] text-[#39FF6A] font-bold">
            {winRate.toFixed(1)}% WR
          </span>
        </div>

        <div className="flex items-center justify-between text-[9px] text-gray-400">
          <span>KARMA INDEX</span>
          <span className="text-[#00D4FF] font-bold">{karmaScore} PTS</span>
        </div>
      </div>
    </div>
  );
};