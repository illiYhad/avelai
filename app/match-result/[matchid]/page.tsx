'use client';

import React, { use } from 'react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    matchId: string;
  }>;
}

export default function MatchResultPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const matchId = resolvedParams.matchId;

  // ข้อมูลจำลองสถิติผู้เล่นหลังจบแมตช์
  const radiantPlayers = [
    { name: '23savage_AFI', hero: 'Morphling', kda: '18 / 2 / 9', eloChange: '+25', isMvp: true, damage: '42.8k' },
    { name: 'Mikoto_God', hero: 'Storm Spirit', kda: '12 / 4 / 15', eloChange: '+25', isMvp: false, damage: '31.2k' },
    { name: 'Jabz_322', hero: 'Centaur Warrunner', kda: '6 / 5 / 22', eloChange: '+25', isMvp: false, damage: '22.4k' },
    { name: 'Q_Support', hero: 'Mirana', kda: '4 / 6 / 28', eloChange: '+25', isMvp: false, damage: '16.5k' },
    { name: 'Whitemon_V2', hero: 'Disruptor', kda: '2 / 7 / 24', eloChange: '+25', isMvp: false, damage: '11.0k' },
  ];

  const direPlayers = [
    { name: 'Devil-llou', hero: 'Faceless Void', kda: '8 / 8 / 6', eloChange: '-25', damage: '24.1k' },
    { name: 'Cyber_Phantom', hero: 'Invoker', kda: '7 / 9 / 8', eloChange: '-25', damage: '26.8k' },
    { name: 'Neon_Viper', hero: 'Slardar', kda: '4 / 8 / 10', eloChange: '-25', damage: '14.2k' },
    { name: 'Glitch_Echo', hero: 'Rubick', kda: '3 / 9 / 12', eloChange: '-25', damage: '12.6k' },
    { name: 'Zero_Latency', hero: 'Crystal Maiden', kda: '2 / 10 / 11', eloChange: '-25', damage: '8.4k' },
  ];

  return (
    <div className="min-h-screen bg-[#07090E] text-white p-4 md:p-8 flex flex-col items-center relative overflow-hidden font-mono selection:bg-[#00D4FF] selection:text-black">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#00D4FF_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between border-b border-[#00D4FF]/20 pb-4 mb-6 z-10 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#00D4FF] text-xs tracking-widest uppercase font-bold">TERMINAL DECRYPTION PROTOCOL</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white mt-1">
            POST-MATCH INTEL
          </h1>
        </div>

        <div className="flex items-center gap-3 bg-[#0B0F17] border border-[#C9A84C]/40 px-4 py-2 rounded-lg">
          <span className="text-[10px] text-gray-400">MATCH ID:</span>
          <span className="text-[#C9A84C] font-black tracking-wider">{matchId}</span>
        </div>
      </header>

      {/* Victory Banner */}
      <div className="w-full max-w-6xl mb-8 p-6 bg-gradient-to-r from-[#00D4FF]/10 via-[#0B0F17] to-[#00D4FF]/10 border border-[#00D4FF]/40 rounded-xl text-center relative z-10 shadow-[0_0_30px_rgba(0,212,255,0.15)]">
        <div className="text-xs text-[#00D4FF] tracking-widest uppercase mb-1">ARENA RESOLUTION</div>
        <h2 className="text-3xl sm:text-4xl font-black tracking-widest text-[#00D4FF] drop-shadow-[0_0_15px_rgba(0,212,255,0.8)]">
          VICTORY: TEAM RADIANT
        </h2>
        <div className="mt-2 text-xs text-gray-400 flex items-center justify-center gap-4 font-mono">
          <span>DURATION: <b className="text-white">38:42</b></span>
          <span>•</span>
          <span>SCORE: <b className="text-[#00D4FF]">42</b> - <b className="text-[#C9A84C]">24</b></span>
        </div>
      </div>

      {/* Stats Tables */}
      <main className="w-full max-w-6xl space-y-6 z-10">
        {/* Radiant Side */}
        <div className="bg-[#0B0F17]/90 border border-[#00D4FF]/30 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 border-b border-[#00D4FF]/20 mb-3">
            <span className="text-[#00D4FF] font-bold text-sm tracking-wider">TEAM RADIANT (WINNERS)</span>
            <span className="text-xs text-green-400">+25 ELO POOL ALLOCATED</span>
          </div>
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="pb-2">OPERATOR</th>
                <th className="pb-2">HERO</th>
                <th className="pb-2 text-center">K / D / A</th>
                <th className="pb-2 text-right">HERO DMG</th>
                <th className="pb-2 text-right">RATING</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {radiantPlayers.map((p, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 flex items-center gap-2">
                    <span className="font-bold text-white">{p.name}</span>
                    {p.isMvp && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-[#C9A84C]/20 border border-[#C9A84C] text-[#C9A84C] font-black rounded">
                        MVP
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-gray-300">{p.hero}</td>
                  <td className="py-2.5 text-center text-gray-300">{p.kda}</td>
                  <td className="py-2.5 text-right text-gray-400">{p.damage}</td>
                  <td className="py-2.5 text-right font-bold text-green-400">{p.eloChange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dire Side */}
        <div className="bg-[#0B0F17]/90 border border-[#C9A84C]/30 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 border-b border-[#C9A84C]/20 mb-3">
            <span className="text-[#C9A84C] font-bold text-sm tracking-wider">TEAM DIRE (DEFEATED)</span>
            <span className="text-xs text-red-400">-25 ELO DEDUCTED</span>
          </div>
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="pb-2">OPERATOR</th>
                <th className="pb-2">HERO</th>
                <th className="pb-2 text-center">K / D / A</th>
                <th className="pb-2 text-right">HERO DMG</th>
                <th className="pb-2 text-right">RATING</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {direPlayers.map((p, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 font-bold text-white">{p.name}</td>
                  <td className="py-2.5 text-gray-300">{p.hero}</td>
                  <td className="py-2.5 text-center text-gray-300">{p.kda}</td>
                  <td className="py-2.5 text-right text-gray-400">{p.damage}</td>
                  <td className="py-2.5 text-right font-bold text-red-400">{p.eloChange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="w-full max-w-6xl flex justify-between items-center mt-8 pt-6 border-t border-gray-800 z-10">
        <Link
          href="/dashboard"
          className="px-6 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg transition-all text-xs tracking-widest uppercase font-bold"
        >
          ← RETURN TO DASHBOARD
        </Link>
        <Link
          href="/leaderboard"
          className="px-6 py-2.5 bg-[#C9A84C] hover:bg-[#C9A84C]/80 text-black rounded-lg transition-all text-xs tracking-widest uppercase font-black shadow-[0_0_15px_rgba(201,168,76,0.3)]"
        >
          VIEW LEADERBOARD →
        </Link>
      </footer>
    </div>
  );
}