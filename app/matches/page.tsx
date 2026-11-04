'use client';

import React, { useState } from 'react';

type MatchRecord = {
  id: string;
  player: string;
  hero: string;
  heroRole: 'Carry' | 'Mid' | 'Offlane' | 'Support';
  result: 'WIN' | 'LOSS';
  kda: string;
  score: string;
  date: string;
  duration: string;
};

const mockMatches: MatchRecord[] = [
  { id: 'MATCH-9041', player: '23savage_AFI', hero: 'Morphling', heroRole: 'Carry', result: 'WIN', kda: '14 / 2 / 11', score: '38 - 19', date: 'Today, 06:45', duration: '34:12' },
  { id: 'MATCH-9040', player: 'Mikoto_God', hero: 'Storm Spirit', heroRole: 'Mid', result: 'WIN', kda: '18 / 3 / 15', score: '44 - 28', date: 'Today, 05:10', duration: '41:05' },
  { id: 'MATCH-9039', player: 'Jabz_322', hero: 'Pangolier', heroRole: 'Offlane', result: 'LOSS', kda: '4 / 7 / 18', score: '22 - 35', date: 'Yesterday', duration: '28:40' },
  { id: 'MATCH-9038', player: 'Q_Supp', hero: 'Mirana', heroRole: 'Support', result: 'WIN', kda: '3 / 4 / 26', score: '31 - 20', date: 'Yesterday', duration: '36:18' },
  { id: 'MATCH-9037', player: '23savage_AFI', hero: 'Terrorblade', heroRole: 'Carry', result: 'LOSS', kda: '8 / 6 / 4', score: '18 - 32', date: '2 days ago', duration: '31:50' },
];

export default function MatchHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const filteredMatches = mockMatches.filter((m) => {
    const matchSearch =
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.player.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.hero.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'ALL' || m.heroRole === roleFilter;
    const matchResult = resultFilter === 'ALL' || m.result === resultFilter;
    return matchSearch && matchRole && matchResult;
  });

  return (
    <div className="min-h-screen bg-void text-white pt-24 pb-12 px-4 md:px-8 flex flex-col items-center font-mono selection:bg-cyan selection:text-black">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-cyan)_1px,transparent_1px)] bg-size-[28px_28px] opacity-10 pointer-events-none" />

      <header className="w-full max-w-6xl border-b border-cyan/20 pb-4 mb-6 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
            <span className="text-cyan text-xs tracking-widest uppercase font-bold">DECRYPTED TELEMETRY LOGS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white mt-1">
            MATCH ARCHIVE & SEARCH
          </h1>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 bg-surface-2 p-1.5 rounded-xl border border-cyan/30 shadow-glow-cyan">
          <button
            onClick={() => setViewMode('card')}
            className={`cursor-pointer px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
              viewMode === 'card' ? 'bg-cyan text-black shadow-glow-cyan' : 'text-gray-400 hover:text-white'
            }`}
          >
            Tactical Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`cursor-pointer px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
              viewMode === 'table' ? 'bg-cyan text-black shadow-glow-cyan' : 'text-gray-400 hover:text-white'
            }`}
          >
            Data Matrix (Table)
          </button>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="w-full max-w-6xl bg-surface-2 border border-cyan/30 p-4 rounded-xl mb-6 z-10 flex flex-wrap items-center justify-between gap-4 shadow-glow-cyan">
        <div className="flex-1 min-w-65">
          <input
            type="text"
            placeholder="Search Match ID, Player Name, or Hero..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-void border border-gray-800 focus:border-cyan px-4 py-2 rounded-lg text-xs text-white placeholder-gray-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-void border border-gray-800 px-3 py-2 rounded-lg text-xs text-gray-300 outline-none focus:border-cyan"
          >
            <option value="ALL">All Roles</option>
            <option value="Carry">Carry</option>
            <option value="Mid">Mid</option>
            <option value="Offlane">Offlane</option>
            <option value="Support">Support</option>
          </select>

          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="bg-void border border-gray-800 px-3 py-2 rounded-lg text-xs text-gray-300 outline-none focus:border-cyan"
          >
            <option value="ALL">All Results</option>
            <option value="WIN">Victory Only</option>
            <option value="LOSS">Defeat Only</option>
          </select>
        </div>
      </div>

      {/* Results Section */}
      <div className="w-full max-w-6xl z-10">
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((m) => (
              <div
                key={m.id}
                className={`p-4 bg-surface-2 rounded-xl border transition-all ${
                  m.result === 'WIN' ? 'border-green-500/30 hover:border-green-500' : 'border-red-500/30 hover:border-red-500'
                }`}
              >
                <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-bold">{m.id}</span>
                    <span className="text-xs bg-cyan/10 text-cyan border border-cyan/30 px-1.5 py-0.5 rounded uppercase font-bold">
                      {m.heroRole}
                    </span>
                  </div>
                  <span className={`text-xs font-black ${m.result === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>
                    {m.result}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-white">{m.hero}</div>
                    <div className="text-xs text-gray-400">
                      Operator: <span className="text-cyan font-bold">{m.player}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ⏱ {m.duration} • {m.date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">K/D/A</div>
                    <div className="text-sm font-black text-white">{m.kda}</div>
                    <div className="text-xs text-gold font-bold mt-0.5">{m.score}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface-2 border border-cyan/30 rounded-xl overflow-x-auto shadow-glow-cyan">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 bg-void/80">
                  <th className="p-3.5">MATCH ID</th>
                  <th className="p-3.5">OPERATOR</th>
                  <th className="p-3.5">HERO & ROLE</th>
                  <th className="p-3.5">RESULT</th>
                  <th className="p-3.5">K/D/A</th>
                  <th className="p-3.5">DURATION</th>
                  <th className="p-3.5 text-right">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredMatches.map((m) => (
                  <tr key={m.id} className="hover:bg-white/2">
                    <td className="p-3.5 text-gray-400 font-bold">{m.id}</td>
                    <td className="p-3.5 text-cyan font-bold">{m.player}</td>
                    <td className="p-3.5 text-white font-bold">
                      {m.hero} <span className="text-xs text-gray-400 font-normal font-mono">({m.heroRole})</span>
                    </td>
                    <td className={`p-3.5 font-black ${m.result === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>
                      {m.result}
                    </td>
                    <td className="p-3.5 text-white font-mono">{m.kda}</td>
                    <td className="p-3.5 text-gray-400">{m.duration}</td>
                    <td className="p-3.5 text-right text-gray-400">{m.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}