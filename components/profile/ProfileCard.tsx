import React from 'react';

interface ProfileCardProps {
  player?: {
    id: string;
    display_name?: string;
    elo?: number;
    avatar_url?: string;
    role?: string;
  };
}

export function ProfileCard({ player }: ProfileCardProps) {
  if (!player) return null;

  return (
    <div className="bg-[#0D121F]/80 border border-[#00D4FF]/30 p-4 rounded-lg flex items-center gap-4 hover:border-[#00D4FF] transition-all">
      <div className="w-12 h-12 rounded-full border border-[#00D4FF] bg-gray-900 flex items-center justify-center font-mono font-bold text-[#00D4FF]">
        {player.display_name?.slice(0, 2).toUpperCase() || 'AV'}
      </div>
      <div>
        <h4 className="font-mono font-bold text-white text-base">
          {player.display_name || 'UNKNOWN OPERATOR'}
        </h4>
        <div className="flex gap-3 text-xs font-mono text-gray-400 mt-1">
          <span className="text-[#C9A84C]">ELO: {player.elo || 1500}</span>
          {player.role && <span className="text-[#00D4FF]">ROLE: {player.role}</span>}
        </div>
      </div>
    </div>
  );
}

export default ProfileCard;