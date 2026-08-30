'use client';

import React, { useState } from 'react';
import type { MonthlyDoubleEliminationBracket, BracketMatch } from '@/lib/tournament/monthlyDoubleElim';
import { MatchNode } from './MatchNode';

type BracketTab = 'WINNERS' | 'LOSERS' | 'FINALS';

interface BracketVisualizerProps {
  bracketData: MonthlyDoubleEliminationBracket;
  isAdminMode?: boolean;
  onMatchClick?: (matchId: string) => void;
}

export const BracketVisualizer: React.FC<BracketVisualizerProps> = ({
  bracketData,
  isAdminMode = false,
  onMatchClick,
}) => {
  const [activeTab, setActiveTab] = useState<BracketTab>('WINNERS');

  const grandFinalAsMatch: BracketMatch = {
    matchId: bracketData.grandFinal.matchId,
    roundNumber: 0,
    seed1: bracketData.grandFinal.seed1,
    seed2: bracketData.grandFinal.seed2,
    player1Id: null,
    player2Id: null,
    winnerAdvancesTo: null,
    loserAdvancesTo: null,
    status: bracketData.grandFinal.status,
  };

  const tabs: BracketTab[] = ['WINNERS', 'LOSERS', 'FINALS'];

  return (
    <div className="w-full bg-[#0A0A0F] rounded-xl border border-gray-800 p-6 flex flex-col gap-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-['Orbitron'] text-xs font-bold tracking-wider transition-all duration-200 ${
                isActive
                  ? 'bg-[#00D4FF]/10 text-[#00D4FF] border-b-2 border-[#00D4FF]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              }`}
            >
              {tab} BRACKET
            </button>
          );
        })}
      </div>

      {/* Bracket Stage Container */}
      <div className="overflow-x-auto pb-4">
        {activeTab === 'WINNERS' && (
          <div className="flex gap-8 items-start min-w-max">
            {bracketData.winnersTree.rounds.map((round, rIndex) => (
              <div key={rIndex} className="flex flex-col gap-4">
                <span className="font-['Orbitron'] text-xs text-[#C9A84C] font-semibold tracking-wider">
                  ROUND {rIndex + 1}
                </span>
                <div className="flex flex-col gap-6">
                  {round.matches.map((match) => (
                    <MatchNode
                      key={match.matchId}
                      match={match}
                      isAdminMode={isAdminMode}
                      onMatchClick={onMatchClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'LOSERS' && (
          <div className="flex gap-8 items-start min-w-max">
            {bracketData.losersTree.rounds.map((round, rIndex) => (
              <div key={rIndex} className="flex flex-col gap-4">
                <span className="font-['Orbitron'] text-xs text-[#E8384F] font-semibold tracking-wider">
                  ROUND {rIndex + 1}
                </span>
                <div className="flex flex-col gap-6">
                  {round.matches.map((match) => (
                    <MatchNode
                      key={match.matchId}
                      match={match}
                      isAdminMode={isAdminMode}
                      onMatchClick={onMatchClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'FINALS' && (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="font-['Orbitron'] text-sm text-[#C9A84C] font-bold tracking-widest mb-6">
              CHAMPIONSHIP GRAND FINAL
            </span>
            <MatchNode
              match={grandFinalAsMatch}
              isAdminMode={isAdminMode}
              onMatchClick={onMatchClick}
            />
            {bracketData.grandFinal.requiresReset && (
              <p className="mt-6 text-xs text-[#E8384F] bg-[#E8384F]/10 px-4 py-1.5 rounded-full border border-[#E8384F]/50 font-['JetBrains_Mono']">
                ⚠️ Bracket Reset Potential Active
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};