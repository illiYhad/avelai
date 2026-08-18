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

  // Mock Players 5v5 สำหรับทดสอบ Holo-Deck UI
  const [teamA] = useState([
    { id: '1', display_name: '23savage_AFI', elo: 11200, role: 'POS 1 (CARRY)' },
    { id: '2', display_name: 'Mikoto_God', elo: 10850, role: 'POS 2 (MID)' },
    { id: '3', display_name: 'Jabz_322', elo: 10500, role: 'POS 3 (OFFLANE)' },
    { id: '4', display_name: 'Q_Support', elo: 9800, role: 'POS 4 (SOFT SUP)' },
    { id: '5', display_name: 'Whitemon_V2', elo: 9650, role: 'POS 5 (HARD SUP)' },
  ]);

  const [teamB] = useState([
    { id: '6', display_name: 'Devil-llou', elo: 1500, role: 'POS 1 (CARRY)' },
    { id: '7', display_name: 'Cyber_Phantom', elo: 1500, role: 'POS 2 (MID)' },
    { id: '8', display_name: 'Neon_Viper', elo: 1500, role: 'POS 3 (OFFLANE)' },
    { id: '9', display_name: 'Glitch_Echo', elo: 1500, role: 'POS 4 (SOFT SUP)' },
    { id: '10', display_name: 'Zero_Latency', elo: 1500, role: 'POS 5 (HARD SUP)' },
  ]);

  return (
    <div className="min-h-screen bg-[#07090E] text-white p-4 md:p-8 flex flex-col items-center justify-start relative overflow-hidden font-mono selection:bg-[#00D4FF] selection:text-black">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#00D4FF_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

      {/* Top Bar / Header Status */}
      <header className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between border-b border-[#00D4FF]/20 pb-4 mb-8 z-10 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
            <span className="text-[#00D4FF] text-xs tracking-widest uppercase font-bold">AVELAi PROTOCOL ACTIVE</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white mt-1">
            CYBER HOLO-DECK
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

      {/* 5v5 Arena Grid */}
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-11 gap-6 items-center z-10 my-auto">
        {/* TEAM RADIANT (5 Slots) */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#00D4FF]/40 pb-2 mb-1">
            <h2 className="text-[#00D4FF] font-black text-lg tracking-widest flex items-center gap-2">
              <span>◈</span> TEAM RADIANT
            </h2>
            <span className="text-xs text-gray-400">AVG ELO: <b className="text-white">10,400</b></span>
          </div>

          <div className="space-y-3">
            {teamA.map((player) => (
              <ProfileCard key={player.id} player={player} />
            ))}
          </div>
        </section>

        {/* VS DIVISION CENTER */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center my-4 lg:my-0">
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#00D4FF] to-transparent hidden lg:block" />
          <div className="relative my-2">
            <div className="w-16 h-16 rounded-full border-2 border-[#C9A84C] bg-[#0B0F17] flex items-center justify-center font-black text-xl text-[#C9A84C] shadow-[0_0_20px_rgba(201,168,76,0.4)] animate-pulse">
              VS
            </div>
          </div>
          <div className="w-px h-16 bg-gradient-to-b from-[#00D4FF] via-[#00D4FF] to-transparent hidden lg:block" />
        </div>

        {/* TEAM DIRE (5 Slots) */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#C9A84C]/40 pb-2 mb-1">
            <h2 className="text-[#C9A84C] font-black text-lg tracking-widest flex items-center gap-2">
              <span>◈</span> TEAM DIRE
            </h2>
            <span className="text-xs text-gray-400">AVG ELO: <b className="text-white">1,500</b></span>
          </div>

          <div className="space-y-3">
            {teamB.map((player) => (
              <ProfileCard key={player.id} player={player} />
            ))}
          </div>
        </section>
      </main>

      {/* Footer Controls / Ready Check Action */}
      <footer className="w-full max-w-7xl flex flex-col sm:flex-row items-center justify-between border-t border-gray-800 pt-6 mt-8 z-10 gap-4">
        <button
          onClick={() => window.history.back()}
          className="px-6 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg transition-all text-xs tracking-widest uppercase font-bold"
        >
          ← ABORT & RETURN
        </button>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">STATUS: <b className="text-[#00D4FF]">LOCKING ROSTERS (10/10)</b></span>
          <button className="px-8 py-3 bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-black text-sm tracking-widest uppercase rounded-lg shadow-[0_0_25px_rgba(0,212,255,0.4)] transition-all hover:scale-105 active:scale-95">
            INITIALIZE MATCH
          </button>
        </div>
      </footer>
    </div>
  );
}