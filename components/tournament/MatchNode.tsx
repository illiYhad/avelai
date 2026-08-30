'use client';

import React from 'react';
import type { BracketMatch } from '@/lib/tournament/monthlyDoubleElim';

interface MatchNodeProps {
  match: BracketMatch;
  isAdminMode?: boolean;
  onMatchClick?: (matchId: string) => void;
}

export const MatchNode: React.FC<MatchNodeProps> = ({
  match,
  isAdminMode = false,
  onMatchClick,
}) => {
  const isClickable = isAdminMode ? true : match.status !== 'waiting';

  const getStatusStyles = () => {
    switch (match.status) {
      case 'ready':
        return 'border-[#00D4FF] bg-[#0A0A0F] text-white font-bold shadow-[0_0_15px_rgba(0,212,255,0.3)]';
      case 'completed':
        return 'border-[#C9A84C] bg-[#1a1a24] text-gray-300';
      case 'waiting':
      default:
        return 'border-gray-700 bg-[#12121A]/80 opacity-60 text-gray-500';
    }
  };

  return (
    <div
      onClick={() => isClickable && onMatchClick?.(match.matchId)}
      className={`relative w-64 rounded-lg border p-3 transition-all duration-200 ${getStatusStyles()} ${
        isClickable ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-not-allowed'
      }`}
    >
      {/* Match ID Badge */}
      <span className="absolute top-2 right-2 font-['Orbitron'] text-[8px] text-gray-500 uppercase tracking-wider">
        {match.matchId}
      </span>

      <div className="flex flex-col gap-2 mt-1">
        {/* Player 1 Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-['JetBrains_Mono'] text-[10px] text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded">
              #{match.seed1 ?? '?'}
            </span>
            <span className="truncate">{match.player1Id ?? 'TBD'}</span>
          </div>
          {match.status === 'completed' && (
            <span className="font-bold text-[#39FF6A] font-['JetBrains_Mono']">W</span>
          )}
        </div>

        <div className="h-px w-full bg-gray-800" />

        {/* Player 2 Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-['JetBrains_Mono'] text-[10px] text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded">
              #{match.seed2 ?? '?'}
            </span>
            <span className="truncate">{match.player2Id ?? 'TBD'}</span>
          </div>
          {match.status === 'completed' && (
            <span className="font-bold text-[#E8384F] font-['JetBrains_Mono']">L</span>
          )}
        </div>
      </div>
    </div>
  );
};