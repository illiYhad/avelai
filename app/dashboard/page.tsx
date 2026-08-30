'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

type TournamentScope = 'daily' | 'weekly' | 'monthly';

export default function DashboardPage() {
  const [scope, setScope] = useState<TournamentScope>('daily');
  const [activeTab, setActiveTab] = useState<'live' | 'recent'>('live');
  const [lastSync, setLastSync] = useState<string>('');

  // โหลดค่า Scope จาก LocalStorage แบบ Asynchronous Microtask
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && isMounted) {
        const savedScope = localStorage.getItem('avela_tournament_scope') as TournamentScope;
        if (savedScope && ['daily', 'weekly', 'monthly'].includes(savedScope)) {
          setScope(savedScope);
        }
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // ฟังก์ชันเปลี่ยน Scope พร้อมบันทึกลง LocalStorage
  const handleScopeChange = (newScope: TournamentScope) => {
    setScope(newScope);
    if (typeof window !== 'undefined') {
      localStorage.setItem('avela_tournament_scope', newScope);
    }
  };

  // Fallback Polling 30s ตามกฎ CTO (ป้องกัน Sync SetState ใน Effect)
  useEffect(() => {
    let isMounted = true;
    const initTimer = setTimeout(() => {
      if (isMounted) {
        setLastSync(new Date().toLocaleTimeString());
      }
    }, 0);

    const interval = setInterval(() => {
      if (isMounted) {
        setLastSync(new Date().toLocaleTimeString());
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  // ข้อมูลจำลองสถิติรวม (Global Stats)
  const stats = [
    { label: 'ACTIVE LOBBIES', value: '24', sub: '+4 in queue' },
    { label: 'PLAYERS ONLINE', value: '1,420', sub: 'High Traffic' },
    { label: 'MATCHES TODAY', value: '388', sub: 'Peak 45/hr' },
    { label: 'PRIZE POOL', value: scope === 'daily' ? '$12,500' : scope === 'weekly' ? '$50,000' : '$250,000', sub: 'Updated Realtime', highlight: true },
  ];

  // แมตช์สด (Live Match Feed)
  const liveMatches = [
    { id: 'LOBBY-901', radiant: 'Team Spirit Echo', dire: 'Blacklist Cyber', radiantScore: 18, direScore: 14, time: '24:15', tier: 'PRO TIER 1' },
    { id: 'LOBBY-902', radiant: 'Neon Gladiators', dire: 'Talon V2', radiantScore: 9, direScore: 12, time: '14:50', tier: 'CHALLENGER' },
    { id: 'LOBBY-903', radiant: 'Aurora Alpha', dire: 'Bleed Protocol', radiantScore: 31, direScore: 28, time: '38:10', tier: 'ELITE 8' },
  ];

  // ผลการแข่งล่าสุด (Recent Results)
  const recentMatches = [
    { id: 'MATCH-8899', winner: 'TEAM RADIANT', radiant: 'TNC Predator', dire: 'Execration Net', score: '42 - 24', time: '12m ago' },
    { id: 'MATCH-8898', winner: 'TEAM DIRE', radiant: 'Myth Avenue', dire: 'Geek Fam Cyber', score: '19 - 35', time: '28m ago' },
    { id: 'MATCH-8897', winner: 'TEAM RADIANT', radiant: 'Boom Esports', dire: 'Army Geniuses', score: '28 - 15', time: '45m ago' },
  ];

  // Top 3 Leaderboard Snapshot
  const topPlayers = [
    { rank: '01', name: '23savage_AFI', elo: '11,450', winRate: '76%' },
    { rank: '02', name: 'Mikoto_God', elo: '11,210', winRate: '72%' },
    { rank: '03', name: 'Jabz_322', elo: '10,980', winRate: '69%' },
  ];

  return (
    <div className="min-h-screen bg-[#07090E] text-white pt-24 pb-12 px-4 md:px-8 flex flex-col items-center relative font-mono selection:bg-[#00D4FF] selection:text-black">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#00D4FF_1px,transparent_1px)] bg-size-[28px_28px] opacity-10 pointer-events-none" />

      {/* Tournament Scope Controller Bar */}
      <aside aria-label="Tournament Scope Bar" className="w-full max-w-6xl mb-6 p-3 bg-[#12121A] border border-[#00D4FF]/30 rounded-xl flex flex-wrap items-center justify-between gap-4 z-20 shadow-[0_0_20px_rgba(0,212,255,0.1)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00D4FF] animate-pulse" />
          <span className="text-xs text-[#00D4FF] font-black tracking-widest uppercase">
            TOURNAMENT VIEW:
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleScopeChange('daily')}
            className={`cursor-pointer px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scope === 'daily'
                ? 'bg-[#00D4FF] text-black shadow-[0_0_12px_#00D4FF]'
                : 'bg-[#07090E] text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            ⚡ DAILY ARENA (3.3)
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange('weekly')}
            className={`cursor-pointer px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scope === 'weekly'
                ? 'bg-[#00D4FF] text-black shadow-[0_0_12px_#00D4FF]'
                : 'bg-[#07090E] text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            📊 WEEKLY LEAGUE (3.2)
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange('monthly')}
            className={`cursor-pointer px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scope === 'monthly'
                ? 'bg-[#00D4FF] text-black shadow-[0_0_12px_#00D4FF]'
                : 'bg-[#07090E] text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            🏛️ MONTHLY MAJOR (3.1)
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between border-b border-[#00D4FF]/20 pb-4 mb-6 z-10 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
            <span className="text-[#00D4FF] text-xs tracking-widest uppercase font-bold">AVELAi TOURNAMENT NETWORK</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white mt-1 uppercase">
            {scope === 'daily' ? 'DAILY ARENA DASHBOARD' : scope === 'weekly' ? 'WEEKLY LEAGUE MATRIX' : 'MONTHLY WAR ROOM (NOC)'}
          </h1>
        </div>
        <div className="flex items-center gap-3 bg-[#12121A] border border-[#00D4FF]/30 px-4 py-2 rounded-lg text-xs">
          <span className="text-gray-400">STATUS:</span>
          <span className="text-[#00D4FF] font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" /> LIVE STREAMING
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-[11px] text-gray-400">SYNC: {lastSync}</span>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3.3: DAILY ARENA (Bento Grid) */}
      {/* ========================================================================= */}
      {scope === 'daily' && (
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-4 z-10">
          <div className="md:col-span-12 bg-[#12121A] border border-[#00D4FF]/30 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs text-[#00D4FF] tracking-widest uppercase font-bold">DAILY TOURNAMENT SUMMARY</span>
              <h2 className="text-2xl font-black text-white mt-1">QUICK ARENA TELEMETRY</h2>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                <span>Active Lobbies: <b>24</b></span>
                <span>•</span>
                <span>Online Players: <b>1,420</b></span>
              </div>
            </div>
            <div className="bg-[#07090E] border border-[#C9A84C]/40 px-6 py-3 rounded-xl text-center">
              <div className="text-[10px] text-gray-400">DAILY PRIZE POOL</div>
              <div className="text-2xl font-black text-[#C9A84C]">$12,500</div>
            </div>
          </div>

          <div className="md:col-span-6 bg-[#12121A] border border-[#00D4FF]/30 p-5 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-[#00D4FF] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" /> LIVE MATCH FEED
            </div>
            {liveMatches.slice(0, 2).map((m, idx) => (
              <div key={idx} className="p-3 bg-[#07090E] border border-gray-800 rounded-xl flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">{m.radiant} vs {m.dire}</div>
                  <div className="text-[10px] text-gray-400 font-mono">⏱ {m.time}</div>
                </div>
                <div className="text-sm font-black text-[#00D4FF]">{m.radiantScore}:{m.direScore}</div>
              </div>
            ))}
          </div>

          <div className="md:col-span-6 bg-[#12121A] border border-[#00D4FF]/30 p-5 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-[#C9A84C]">RECENT DECRYPTED (DAILY)</div>
            {recentMatches.slice(0, 2).map((m, idx) => (
              <div key={idx} className="p-3 bg-[#07090E] border border-gray-800 rounded-xl flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">{m.radiant} vs {m.dire}</div>
                  <div className="text-[10px] text-gray-400">{m.time}</div>
                </div>
                <div className="text-xs font-bold text-green-400">{m.winner}</div>
              </div>
            ))}
          </div>

          <div className="md:col-span-12 bg-linear-to-r from-[#00D4FF]/10 via-[#12121A] to-[#C9A84C]/10 border border-[#00D4FF]/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-[#00D4FF]">DAILY TOP 3 OPERATORS</div>
              <div className="text-sm text-gray-300 mt-1 font-mono">
                🥇 23savage (11.4k) &nbsp;|&nbsp; 🥈 Mikoto (11.2k) &nbsp;|&nbsp; 🥉 Jabz (10.9k)
              </div>
            </div>
            <Link href="/leaderboard" className="px-5 py-2 bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-black text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(0,212,255,0.4)]">
              VIEW FULL LEADERBOARD →
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.2: WEEKLY LEAGUE (Tactical Matrix 4 Rows) */}
      {/* ========================================================================= */}
      {scope === 'weekly' && (
        <div className="w-full max-w-6xl space-y-6 z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s, idx) => (
              <div key={idx} className="bg-[#12121A]/80 border border-[#00D4FF]/30 p-4 rounded-lg">
                <span className="text-[10px] text-gray-400 uppercase">{s.label}</span>
                <div className={`text-2xl font-black mt-1 ${s.highlight ? 'text-[#C9A84C]' : 'text-white'}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#12121A] border border-[#00D4FF]/30 p-4 rounded-xl">
            <div className="text-xs font-bold text-[#00D4FF] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" /> WEEKLY ACTIVE MATCHES
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {liveMatches.map((m, idx) => (
                <div key={idx} className="p-3 bg-[#07090E] border border-gray-800 rounded-lg">
                  <div className="text-[10px] text-gray-400 flex justify-between">
                    <span>{m.id}</span>
                    <span className="text-[#00D4FF] font-bold">⏱ {m.time}</span>
                  </div>
                  <div className="text-xs font-bold text-white my-2">{m.radiant} vs {m.dire}</div>
                  <div className="text-center bg-[#12121A] py-1 text-xs font-black text-[#00D4FF] rounded">
                    {m.radiantScore} : {m.direScore}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#12121A] border border-[#00D4FF]/30 p-4 rounded-xl">
            <div className="text-xs font-bold text-[#00D4FF] mb-3">WEEKLY RESULTS MATRIX</div>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 pb-2">
                  <th className="pb-2">MATCH ID</th>
                  <th className="pb-2">TEAMS</th>
                  <th className="pb-2">SCORE</th>
                  <th className="pb-2 text-right">WINNER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {recentMatches.map((m, idx) => (
                  <tr key={idx} className="hover:bg-white/2">
                    <td className="py-2.5 text-gray-400">{m.id}</td>
                    <td className="py-2.5 text-white font-bold">{m.radiant} vs {m.dire}</td>
                    <td className="py-2.5 text-gray-300">{m.score}</td>
                    <td className="py-2.5 text-right font-bold text-green-400">{m.winner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[#12121A] border border-[#00D4FF]/30 p-4 rounded-xl">
            <div className="text-xs font-bold text-[#C9A84C] mb-3">WEEKLY LEAGUE TOP 3</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topPlayers.map((p, idx) => (
                <div key={idx} className="p-3 bg-[#07090E] border border-gray-800 rounded-lg text-center">
                  <div className="text-xs text-[#C9A84C] font-black">RANK #{p.rank}</div>
                  <div className="text-sm font-bold text-white mt-1">{p.name}</div>
                  <div className="text-xs text-[#00D4FF] font-bold mt-1">{p.elo} ELO</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.1: MONTHLY MAJOR (Cyber NOC 70/30) */}
      {/* ========================================================================= */}
      {scope === 'monthly' && (
        <div className="w-full max-w-6xl space-y-6 z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, idx) => (
              <div key={idx} className="bg-[#12121A] border border-[#00D4FF]/30 p-4 rounded-xl relative overflow-hidden">
                <div className="text-[10px] text-gray-400 tracking-wider uppercase">{s.label}</div>
                <div className={`text-2xl font-black mt-1 ${s.highlight ? 'text-[#C9A84C]' : 'text-white'}`}>{s.value}</div>
                <div className="text-[11px] text-[#00D4FF] mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] animate-pulse" /> {s.sub}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            <div className="lg:col-span-7 bg-[#12121A] border border-[#00D4FF]/30 p-5 rounded-xl flex flex-col">
              <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('live')}
                    className={`cursor-pointer px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'live'
                        ? 'bg-[#00D4FF] text-black shadow-[0_0_15px_rgba(0,212,255,0.4)]'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ● MAJOR LIVE FEED
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('recent')}
                    className={`cursor-pointer px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'recent'
                        ? 'bg-[#00D4FF] text-black shadow-[0_0_15px_rgba(0,212,255,0.4)]'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    MAJOR RESULTS
                  </button>
                </div>
                <span className="text-[11px] text-gray-400 hidden sm:inline">WAR ROOM NOC 70%</span>
              </div>

              <div className="space-y-3 flex-1">
                {activeTab === 'live' ? (
                  liveMatches.map((m, idx) => (
                    <div key={idx} className="p-3.5 bg-[#07090E]/60 border border-gray-800 hover:border-[#00D4FF]/40 rounded-lg flex items-center justify-between transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 px-1.5 py-0.5 rounded font-bold">{m.tier}</span>
                          <span className="text-xs text-gray-400">{m.id}</span>
                        </div>
                        <div className="text-sm font-bold text-white mt-1">
                          {m.radiant} <span className="text-[#00D4FF]">vs</span> {m.dire}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-[#00D4FF]">{m.radiantScore} : {m.direScore}</div>
                        <div className="text-[11px] text-gray-400 font-mono">⏱ {m.time}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  recentMatches.map((m, idx) => (
                    <div key={idx} className="p-3.5 bg-[#07090E]/60 border border-gray-800 hover:border-[#C9A84C]/40 rounded-lg flex items-center justify-between transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40 px-1.5 py-0.5 rounded font-bold">DECRYPTED</span>
                          <span className="text-xs text-gray-400">{m.id}</span>
                        </div>
                        <div className="text-sm font-bold text-white mt-1">
                          {m.radiant} vs {m.dire}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-green-400">{m.winner}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{m.score} ({m.time})</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-3 bg-[#12121A] border border-[#00D4FF]/30 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-3 mb-4">
                  <span className="text-xs font-bold text-[#00D4FF] tracking-wider">MAJOR TOP 3</span>
                  <span className="text-[10px] text-[#C9A84C]">PRO ELO</span>
                </div>
                <div className="space-y-3">
                  {topPlayers.map((p, idx) => (
                    <div key={idx} className="p-3 bg-[#07090E]/60 border border-gray-800 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-[#C9A84C]">#{p.rank}</span>
                        <div>
                          <div className="text-xs font-bold text-white">{p.name}</div>
                          <div className="text-[10px] text-gray-400">WR: {p.winRate}</div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-[#00D4FF]">{p.elo}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/leaderboard" className="mt-4 block text-center py-2 bg-[#07090E] border border-gray-700 hover:border-[#00D4FF] text-xs text-gray-300 hover:text-white rounded-lg transition-all">
                VIEW FULL MAJOR STANDINGS →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}