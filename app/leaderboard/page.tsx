'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Shield, Flame, Medal, Sparkles, Bot } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getAVEStatus = (elo: number, karma: number) => {
  if (elo >= 1500 && karma >= 100) return { label: 'Dominant', color: 'text-red-400 border-red-800/40 bg-red-950/30' };
  if (elo >= 1300) return { label: 'Rising Star', color: 'text-amber-400 border-amber-800/40 bg-amber-950/30' };
  if (karma >= 90) return { label: 'Tactical', color: 'text-cyan-400 border-cyan-800/40 bg-cyan-950/30' };
  return { label: 'Recruit', color: 'text-zinc-400 border-zinc-700 bg-zinc-900/30' };
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, elo_rating, karma_score')
      .order('elo_rating', { ascending: false })
      .limit(50);
    setPlayers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  const rankStyle = (rank: number) => {
    if (rank === 1) return 'border-l-2 border-amber-500 bg-amber-500/5 shadow-[inset_0_0_30px_rgba(245,158,11,0.05)]';
    if (rank === 2) return 'border-l-2 border-slate-400 bg-slate-400/5';
    if (rank === 3) return 'border-l-2 border-amber-700 bg-amber-700/5';
    return '';
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return (
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
        <Trophy className="w-5 h-5 fill-amber-400 text-amber-400" />
      </div>
    );
    if (rank === 2) return (
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-300/20 border border-slate-300/60 shadow-[0_0_12px_rgba(203,213,225,0.3)]">
        <Medal className="w-5 h-5 fill-slate-300 text-slate-300" />
      </div>
    );
    if (rank === 3) return (
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-700/20 border border-amber-700/60 shadow-[0_0_12px_rgba(180,83,9,0.3)]">
        <Medal className="w-5 h-5 fill-amber-700 text-amber-700" />
      </div>
    );
    return <span className="text-zinc-500 font-black text-lg w-9 text-center">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-zinc-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="relative mb-8 p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest mb-1">
                <Sparkles className="w-4 h-4" /> AVELAi Hall of Fame
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                ARENA <span style={{ color: '#C9A84C' }}>LEADERBOARD</span>
              </h1>
              <p className="text-sm text-zinc-400 mt-1">ตารางจัดอันดับเหล่านักสู้แห่งสังเวียน AVELAi</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-cyan-400">
                <Bot className="w-4 h-4" /> AVE Online
              </div>
              <button onClick={fetchLeaderboard} className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-all active:scale-95">
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-zinc-950/80 border border-zinc-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="py-4 px-6 text-center w-20">Rank</th>
                  <th className="py-4 px-6">Player</th>
                  <th className="py-4 px-6 text-center">ELO</th>
                  <th className="py-4 px-6 text-center">Karma</th>
                  <th className="py-4 px-6 text-center">AVE Analytics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-sm">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-6"><div className="h-6 w-6 bg-zinc-800 rounded-full mx-auto" /></td>
                      <td className="py-4 px-6"><div className="h-6 w-36 bg-zinc-800 rounded" /></td>
                      <td className="py-4 px-6"><div className="h-6 w-16 bg-zinc-800 rounded mx-auto" /></td>
                      <td className="py-4 px-6"><div className="h-6 w-16 bg-zinc-800 rounded mx-auto" /></td>
                      <td className="py-4 px-6"><div className="h-6 w-24 bg-zinc-800 rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : players.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">ยังไม่มีนักสู้ในสังเวียน</td>
                  </tr>
                ) : (
                  players.map((player, index) => {
                    const rank = index + 1;
                    const ave = getAVEStatus(player.elo_rating ?? 1000, player.karma_score ?? 100);
                    return (
                      <tr key={player.id} className={`transition-colors hover:bg-zinc-900/60 ${rankStyle(rank)}`}>
                        <td className="py-4 px-6 text-center">
                          <div className="flex justify-center">{rankBadge(rank)}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={player.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.id}`}
                                alt={player.username}
                                className={`w-10 h-10 rounded-xl object-cover bg-zinc-800 border ${rank === 1 ? 'border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'border-zinc-700'}`}
                              />
                              {rank === 1 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-zinc-950 animate-ping" />}
                            </div>
                            <div>
                              <div className="font-bold text-zinc-100">{player.username ?? 'Unknown'}</div>
                              <div className="text-xs text-zinc-500 font-mono">ID: {player.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/30 border border-red-800/40 text-red-400 font-black font-mono">
                            <Flame className="w-4 h-4 fill-red-500" />
                            {player.elo_rating ?? 1000}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 font-bold font-mono">
                            <Shield className="w-4 h-4" />
                            {player.karma_score ?? 100}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${ave.color}`}>
                            <Bot className="w-3 h-3" />
                            {ave.label}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}