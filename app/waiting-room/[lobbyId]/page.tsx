'use client';

import React, { use, useState } from 'react';
import { ProfileCard } from '@/components/profile/ProfileCard';

interface PageProps {
  params: Promise<{
    lobbyId: string;
  }>;
}

export default function WaitingRoomPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const lobbyId = resolvedParams.lobbyId;

  // 5v5 Data
  const [teamA] = useState([
    { id: '1', display_name: '23savage_AFI', elo: 11200, role: 'POS 1 (CARRY)', card_rarity: 'GENESIS_MYTHIC' as const, rank_tier: 'IMMORTAL' },
    { id: '2', display_name: 'Mikoto_God', elo: 10850, role: 'POS 2 (MID)', card_rarity: 'CYBER_HOLO' as const, rank_tier: 'DIVINE V' },
    { id: '3', display_name: 'Jabz_322', elo: 10500, role: 'POS 3 (OFFLANE)', card_rarity: 'RARE' as const, rank_tier: 'DIVINE III' },
    { id: '4', display_name: 'Q_Support', elo: 9800, role: 'POS 4 (SOFT SUP)', card_rarity: 'COMMON' as const, rank_tier: 'DIVINE I' },
    { id: '5', display_name: 'Whitemon_V2', elo: 9650, role: 'POS 5 (HARD SUP)', card_rarity: 'CYBER_HOLO' as const, rank_tier: 'DIVINE I' },
  ]);

  const [teamB] = useState([
    { id: '6', display_name: 'Devil-llou', elo: 1500, role: 'POS 1 (CARRY)', card_rarity: 'CYBER_HOLO' as const, rank_tier: 'HERALD I' },
    { id: '7', display_name: 'Cyber_Phantom', elo: 1500, role: 'POS 2 (MID)', card_rarity: 'RARE' as const, rank_tier: 'HERALD I' },
    { id: '8', display_name: 'Neon_Viper', elo: 1500, role: 'POS 3 (OFFLANE)', card_rarity: 'COMMON' as const, rank_tier: 'HERALD I' },
    { id: '9', display_name: 'Glitch_Echo', elo: 1500, role: 'POS 4 (SOFT SUP)', card_rarity: 'COMMON' as const, rank_tier: 'HERALD I' },
    { id: '10', display_name: 'Zero_Latency', elo: 1500, role: 'POS 5 (HARD SUP)', card_rarity: 'COMMON' as const, rank_tier: 'HERALD I' },
  ]);

  return (
    <div className="min-h-screen bg-[#07090E] text-white pt-24 pb-12 p-4 md:p-8 flex flex-col justify-between font-mono selection:bg-[#00D4FF] selection:text-black">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#00D4FF_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto space-y-8 z-10">
        {/* Top Bar */}
        <header className="flex flex-col md:flex-row items-center justify-between border-b border-[#00D4FF]/20 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
              <span className="text-[#00D4FF] text-xs tracking-widest uppercase font-bold">AVELAi PROTOCOL ACTIVE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white mt-1">
              CYBER HOLO-DECK 1.2
            </h1>
          </div>

          <div className="flex items-center gap-4 bg-[#0B0F17] border border-[#C9A84C]/40 px-5 py-2 rounded-lg shadow-[0_0_15px_rgba(201,168,76,0.15)]">
            <div className="text-right">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">LOBBY ID</div>
              <div className="text-[#C9A84C] font-black text-lg tracking-widest">{lobbyId}</div>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div className="text-left">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">MATCH TYPE</div>
              <div className="text-white font-bold text-sm tracking-wider">5v5 RANKED ARENA</div>
            </div>
          </div>
        </header>

        {/* 5v5 Arena Section */}
        <main className="space-y-6">
          {/* TEAM RADIANT */}
          <section className="bg-[#0B0F17]/80 border border-[#00D4FF]/30 p-4 rounded-xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
              <h2 className="text-[#00D4FF] font-black text-sm tracking-widest flex items-center gap-2">
                <span>◈</span> TEAM RADIANT
              </h2>
              <span className="text-xs text-gray-400">AVG ELO: <b className="text-white">10,400</b></span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {teamA.map((player) => (
                <ProfileCard key={player.id} player={player} teamType="radiant" />
              ))}
            </div>
          </section>

          {/* VS Divider */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/40 to-transparent" />
            <div className="w-10 h-10 rounded-full border border-[#C9A84C] bg-[#0B0F17] flex items-center justify-center font-black text-sm text-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.3)]">
              VS
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/40 to-transparent" />
          </div>

          {/* TEAM DIRE */}
          <section className="bg-[#0B0F17]/80 border border-[#C9A84C]/30 p-4 rounded-xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#C9A84C]/20 pb-2">
              <h2 className="text-[#C9A84C] font-black text-sm tracking-widest flex items-center gap-2">
                <span>◈</span> TEAM DIRE
              </h2>
              <span className="text-xs text-gray-400">AVG ELO: <b className="text-white">1,500</b></span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {teamB.map((player) => (
                <ProfileCard key={player.id} player={player} teamType="dire" />
              ))}
            </div>
          </section>
        </main>

        {/* Footer Actions */}
        <footer className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-800 pt-4 gap-4">
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg transition-all text-xs tracking-widest uppercase font-bold cursor-pointer"
          >
            ← ABORT & RETURN
          </button>

          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">STATUS: <b className="text-[#00D4FF]">LOCKING ROSTERS (10/10)</b></span>
            <button className="px-8 py-3 bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-black text-xs tracking-widest uppercase rounded-lg shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all hover:scale-105 active:scale-95 cursor-pointer">
              INITIALIZE MATCH
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}