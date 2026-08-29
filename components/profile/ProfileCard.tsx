'use client';

import React from 'react';

export interface PlayerData {
  id: string;
  display_name?: string;
  elo?: number;
  role?: string;
  rank_tier?: string;
  signature_hero?: string;
  card_rarity?: 'COMMON' | 'RARE' | 'CYBER_HOLO' | 'GENESIS_MYTHIC';
  avatar_url?: string;
}

interface ProfileCardProps {
  player?: PlayerData;
  teamType?: 'radiant' | 'dire';
}

export function ProfileCard({ player, teamType = 'radiant' }: ProfileCardProps) {
  if (!player) return null;

  const isRadiant = teamType === 'radiant';
  const themeAccent = isRadiant ? '#00D4FF' : '#C9A84C';
  const themeBorder = isRadiant ? 'border-[#00D4FF]/40' : 'border-[#C9A84C]/40';

  return (
    <div
      className={`relative flex flex-col justify-between w-full h-[230px] bg-[#0A0E17] border ${themeBorder} rounded-xl p-3 shadow-lg overflow-hidden group hover:scale-[1.02] transition-all duration-300 font-mono select-none`}
    >
      {/* Background Glow */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none group-hover:opacity-25 transition-opacity"
        style={{
          background: `radial-gradient(circle at 50% 20%, ${themeAccent}, transparent 70%)`,
        }}
      />

      {/* Header: Role & Badge */}
      <div className="flex justify-between items-center z-10">
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/60 border border-gray-700 text-gray-300 font-bold uppercase">
          {player.role ? player.role.split(' ')[0] : 'POS'}
        </span>
        <span
          className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase"
          style={{ color: themeAccent, border: `1px solid ${themeAccent}40` }}
        >
          {player.card_rarity || 'CYBER_HOLO'}
        </span>
      </div>

      {/* Avatar / Center Info */}
      <div className="my-auto flex flex-col items-center justify-center z-10 text-center">
        <div
          className="w-12 h-12 rounded-full border-2 flex items-center justify-center bg-[#111622] shadow-[0_0_12px_rgba(0,0,0,0.8)] relative"
          style={{ borderColor: themeAccent }}
        >
          <span className="text-sm font-black text-white">
            {player.display_name?.slice(0, 2).toUpperCase() || 'AV'}
          </span>
          <span className="absolute -bottom-1 text-[7px] font-bold px-1 rounded bg-black text-gray-300 border border-gray-700">
            {player.rank_tier || 'PRO'}
          </span>
        </div>

        <h3 className="font-black text-xs text-gray-100 mt-2 tracking-wide truncate max-w-[110px]">
          {player.display_name || 'UNKNOWN OPERATOR'}
        </h3>
        <p className="text-[9px] text-gray-400 mt-0.5">
          {player.role || 'Player'}
        </p>
      </div>

      {/* Footer: ELO Rating */}
      <div className="flex justify-between items-end border-t border-gray-800/80 pt-1.5 z-10">
        <div>
          <div className="text-[8px] text-gray-500 uppercase">RATING</div>
          <div className="text-[11px] font-black" style={{ color: themeAccent }}>
            {(player.elo || 1500).toLocaleString()} ELO
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[8px] text-emerald-400 font-bold">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
          READY
        </span>
      </div>
    </div>
  );
}

export default ProfileCard;