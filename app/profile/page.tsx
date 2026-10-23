/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Flame, Shield, Trophy, Target, Bot, Zap, Wifi, WifiOff, Swords } from 'lucide-react';
import { CareerTimeline } from '@/components/profile/CareerTimeline';

export interface UserProfile {
  id?: string;
  userId?: string;
  displayName?: string;
  display_name?: string;
  steamId?: string;
  avatarUrl?: string;
  avatar_url?: string;
  karmaScore?: number;
  karma_score?: number;
  elo_rating?: number;
  winRate?: number;
  win_rate?: string | number;
  rankTier?: string;
  totalMatches?: number;
  [key: string]: unknown;
}

const supabase = createClient();

const RadarGraph = ({ stats }: { stats: number[] }) => {
  const labels = ['KDA', 'Objective', 'Teamwork', 'Survival', 'Aggression'];
  const cx = 120, cy = 120, r = 90;
  const angles = labels.map((_, i) => (i * 2 * Math.PI) / 5 - Math.PI / 2);
  const points = (values: number[]) =>
    values.map((v, i) => {
      const ratio = v / 100;
      return [cx + ratio * r * Math.cos(angles[i]), cy + ratio * r * Math.sin(angles[i])];
    });
  const gridPoints = (ratio: number) =>
    angles.map(a => [cx + ratio * r * Math.cos(a), cy + ratio * r * Math.sin(a)]);
  const toPath = (pts: number[][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';

  return (
    <svg viewBox="0 0 240 240" className="w-48 h-48">
      {[0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <path key={i} d={toPath(gridPoints(ratio))} fill="none" stroke="#3f3f46" strokeWidth="0.8" />
      ))}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#3f3f46" strokeWidth="0.8" />
      ))}
      <path d={toPath(points(stats))} fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5" />
      {points(stats).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#ef4444" />
      ))}
      {labels.map((label, i) => {
        const x = cx + (r + 16) * Math.cos(angles[i]);
        const y = cy + (r + 16) * Math.sin(angles[i]);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#a1a1aa">{label}</text>;
      })}
    </svg>
  );
};

const statusConfig = {
  online: { icon: <Wifi className="w-3 h-3" />, label: 'Online', color: 'text-emerald-400 border-emerald-800/40 bg-emerald-950/30' },
  dnd: { icon: <WifiOff className="w-3 h-3" />, label: 'Do Not Disturb', color: 'text-red-400 border-red-800/40 bg-red-950/30' },
  ingame: { icon: <Swords className="w-3 h-3" />, label: 'In-Game', color: 'text-amber-400 border-amber-800/40 bg-amber-950/30' },
  offline: { icon: <WifiOff className="w-3 h-3" />, label: 'Offline', color: 'text-zinc-500 border-zinc-700 bg-zinc-900/30' },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'online' | 'dnd' | 'offline' | 'ingame'>('online');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      setProfile(data as UserProfile);
      setLoading(false);
    };
    fetchProfile();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-zinc-500 animate-pulse font-mono">Loading Passport...</div>
    </div>
  );

  const battleTag = `#AVL-${profile?.id?.substring(0, 6).toUpperCase()}`;
  const radarStats = [72, 85, 60, 78, 90];
  const st = statusConfig[status];

  const mockMatches = [
    { id: 'M-9021', result: 'VICTORY', score: '13-5', elo: '+25', tag: 'MVP' },
    { id: 'M-8982', result: 'VICTORY', score: '13-10', elo: '+18', tag: 'Clutch God' },
    { id: 'M-8901', result: 'DEFEAT', score: '8-13', elo: '-12', tag: 'Fought Hard' },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 pt-16 pb-12 px-4 md:px-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* ZONE 1: IDENTITY */}
        <div className="relative p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start gap-5">
            <div className="relative">
              <img
                src={profile?.avatar_url || profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.id}`}
                alt="Profile Avatar"
                className="w-20 h-20 rounded-2xl border-2 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.3)] object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-zinc-900" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-extrabold text-white">{profile?.display_name || profile?.displayName || 'Unknown'}</h1>
                <span className="text-xs font-mono text-zinc-500">{battleTag}</span>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${st.color}`}>
                  {st.icon} {st.label}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                <span>Change status:</span>
                {(['online', 'dnd', 'offline'] as const).map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`px-2 py-0.5 rounded border text-xs transition-all cursor-pointer ${status === s ? statusConfig[s].color : 'border-zinc-700 text-zinc-600 hover:text-zinc-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/30 border border-amber-700/40 text-amber-400 text-xs font-bold">
                  <Trophy className="w-3 h-3" /> Monthly Champion
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-300 text-xs font-bold">
                  <Zap className="w-3 h-3 text-yellow-400" /> Founder
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-xs font-bold">
                  <Shield className="w-3 h-3" /> Karma Guardian
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ZONE 2: CARD SHOWCASE */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Card Waiting Room Showcase</p>
          <div className="relative flex items-center justify-center h-32 rounded-xl border border-amber-500/30 bg-linear-to-br from-zinc-900 via-red-950/20 to-zinc-900 shadow-[0_0_30px_rgba(245,158,11,0.1)] overflow-hidden">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(239,68,68,0.03)_10px,rgba(239,68,68,0.03)_11px)]" />
            <div className="text-center z-10">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-xs font-bold text-amber-400">AVE FOUNDER HOLOGRAM</div>
              <div className="text-xs text-zinc-500 mt-1">Neon Red & Gold Edition</div>
            </div>
            <button className="absolute bottom-3 right-3 px-3 py-1 text-xs rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-all cursor-pointer">
              Customize Card
            </button>
          </div>
        </div>

        {/* ZONE 3: METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Flame className="w-5 h-5 fill-red-500 text-red-500" />, label: 'ELO Rating', value: profile?.elo_rating?.toLocaleString() ?? '1,000', color: 'text-red-400 border-red-800/40 bg-red-950/20' },
            { icon: <Shield className="w-5 h-5 text-emerald-400" />, label: 'Karma Score', value: `${profile?.karma_score ?? profile?.karmaScore ?? 100}`, color: 'text-emerald-400 border-emerald-800/40 bg-emerald-950/20' },
            { icon: <Trophy className="w-5 h-5 text-amber-400" />, label: 'Win Rate', value: `${profile?.win_rate ?? profile?.winRate ?? '0.00'}%`, color: 'text-amber-400 border-amber-800/40 bg-amber-950/20' },
            { icon: <Target className="w-5 h-5 text-cyan-400" />, label: 'Total Matches', value: '0 Games', color: 'text-cyan-400 border-cyan-800/40 bg-cyan-950/20' },
          ].map((m, i) => (
            <div key={i} className={`p-4 rounded-2xl border ${m.color} flex flex-col items-center gap-2 text-center`}>
              {m.icon}
              <div className="text-2xl font-black font-mono">{m.value}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">{m.label}</div>
            </div>
          ))}
        </div>

        {/* ZONE 4: AVE AI */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 text-xs text-red-500 font-bold uppercase tracking-widest">
                <Bot className="w-4 h-4" /> AVE AI Insight
              </div>
              <div className="p-4 rounded-xl bg-zinc-950 border border-red-900/30 text-sm text-zinc-300 leading-relaxed font-mono">
                &quot;AVE Analysis: สายบุกดุดัน ปิดเกมไว Tactical Superiority อยู่ในระดับ{' '}
                <span className="text-red-400 font-bold">Top 5%</span>&quot;
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <RadarGraph stats={radarStats} />
              <span className="text-xs text-zinc-600">Combat Radar</span>
            </div>
          </div>
        </div>

        {/* ZONE 5: LINKED + MATCHES */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Connected Accounts</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { name: 'Riot Games', connected: false },
                { name: 'Steam', connected: false },
                { name: 'Discord', connected: false },
              ].map((app, i) => (
                <div key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${app.connected ? 'border-emerald-700 bg-emerald-950/30 text-emerald-400' : 'border-zinc-700 bg-zinc-800 text-zinc-500'}`}>
                  {app.connected ? '✅' : '🔗'} {app.name}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Recent Matches</p>
            <div className="space-y-2">
              {mockMatches.map((m, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm ${m.result === 'VICTORY' ? 'border-emerald-900/40 bg-emerald-950/10' : 'border-red-900/40 bg-red-950/10'}`}>
                  <span className="font-mono text-zinc-500 text-xs">#{m.id}</span>
                  <span className={`font-bold text-xs ${m.result === 'VICTORY' ? 'text-emerald-400' : 'text-red-400'}`}>{m.result}</span>
                  <span className="text-zinc-300 font-mono text-xs">{m.score}</span>
                  <span className={`font-black font-mono text-xs ${m.elo.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{m.elo} ELO</span>
                  <span className="text-xs text-zinc-500 hidden md:block">[{m.tag}]</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Career Tournament Timeline */}
        <div className="mt-8">
          <CareerTimeline />
        </div>

      </div>
    </div>
  );
}