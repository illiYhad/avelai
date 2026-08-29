'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const POSITIONS = ['Global', 'Pos 1', 'Pos 2', 'Pos 3', 'Pos 4', 'Pos 5']

type Player = {
    id: string
    display_name: string
    avatar_url?: string
    current_elo: number
    karma_score: number
    win_rate?: number
    recent_form?: ('W' | 'L')[]
    preferred_position?: string
}

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState('Global')
    const [players, setPlayers] = useState<Player[]>([])
    const [prizePool, setPrizePool] = useState(0)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const target = 12750
        const duration = 1500
        const steps = 60
        const stepValue = target / steps
        let current = 0
        let stepCount = 0
        const timer = setInterval(() => {
            current += stepValue
            stepCount++
            if (stepCount >= steps) {
                setPrizePool(target)
                clearInterval(timer)
            } else {
                setPrizePool(Math.floor(current))
            }
        }, duration / steps)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const fetchPlayers = async () => {
            setLoading(true)
            try {
                let query = supabase
                    .from('users')
                    .select('id, display_name, avatar_url, current_elo, karma_score, win_rate, recent_form, preferred_position')
                    .order('current_elo', { ascending: false })
                    .limit(100)

                if (activeTab !== 'Global') {
                    query = query.eq('preferred_position', activeTab)
                }

                const { data, error } = await query

                if (error) {
                    console.error('profiles error:', error.message)
                    const { data: fallbackData } = await supabase
                        .from('users')
                        .select('id, display_name, current_elo, karma_score')
                        .order('current_elo', { ascending: false })
                        .limit(100)
                    if (fallbackData) setPlayers(fallbackData as Player[])
                } else if (data) {
                    setPlayers(data as Player[])
                }
            } catch (err) {
                console.error('DB error:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchPlayers()

        const channel = supabase
            .channel('realtime_leaderboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchPlayers())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchPlayers())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [activeTab, supabase])

 const renderHexForm = (form: any = ['W', 'W', 'L', 'W', 'W']) => {
    let formArray: ('W' | 'L')[] = ['W', 'W', 'L', 'W', 'W'];
    if (Array.isArray(form)) {
      formArray = form;
    } else if (typeof form === 'string') {
      try {
        const parsed = JSON.parse(form);
        if (Array.isArray(parsed)) formArray = parsed;
      } catch (e) {
        formArray = ['W', 'W', 'L', 'W', 'W'];
      }
    }

    return (
      <div className="flex items-center gap-1.5 justify-center">
        {formArray.map((result, i) => (
          <div
            key={i}
            className="w-5 h-6 flex items-center justify-center text-[10px] font-bold transition-all"
          >
            {result}
          </div>
        ))}
      </div>
    );
  };
    return (
        <main className="min-h-screen bg-[#030308] text-white pt-20 p-4 md:pt-24 md:p-8 font-mono relative overflow-hidden">
            {/* Cyberpunk ambient glow */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-yellow-500/3 rounded-full blur-[150px] pointer-events-none" />

            {/* Prize Pool */}
            <div className="flex flex-col items-center justify-center mb-10 mt-16">
                <div className="relative border border-yellow-500/40 bg-black/70 px-8 py-5 rounded-sm text-center min-w-[320px] md:min-w-[400px] shadow-[0_0_25px_rgba(234,179,8,0.15)] ring-1 ring-yellow-500/20">
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-yellow-500" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-yellow-500" />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-yellow-500" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-yellow-500" />
                    <p className="text-xs uppercase tracking-[0.25em] text-yellow-500/70 font-semibold mb-2">DAILY PRIZE POOL</p>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-black text-yellow-400">THB</span>
                        <h2 className="text-3xl md:text-4xl font-black text-yellow-400 tracking-wider">
                            {prizePool.toLocaleString()}
                        </h2>
                        <span className="text-lg font-medium text-yellow-500/80 self-end mb-1">THB</span>
                    </div>
                    <p className="text-[10px] text-gray-500 tracking-widest mt-2">75% COMMUNITY RETURN &middot; AUTO SEEDED</p>
                </div>
            </div>

            {/* Position Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-8">
                {POSITIONS.map(pos => (
                    <button
                        key={pos}
                        onClick={() => setActiveTab(pos)}
                        className={`px-4 py-2 text-xs md:text-sm font-bold border uppercase tracking-wider transition-all duration-300 ${activeTab === pos
                            ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10 shadow-[0_0_15px_rgba(0,212,255,0.25)] ring-1 ring-[#00D4FF]/30'
                            : 'border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                            }`}
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                    >
                        {pos}
                    </button>
                ))}
            </div>

            {/* Leaderboard Table */}
            <div className="max-w-6xl mx-auto border border-cyan-500/20 bg-black/60 rounded-sm p-1 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-cyan-500/20 text-cyan-400/80 text-[11px] uppercase tracking-[0.2em] font-semibold bg-cyan-950/20">
                                <th className="py-4 px-6 text-center w-[80px]">Rank</th>
                                <th className="py-4 px-6">Player</th>
                                <th className="py-4 px-6 text-center w-[120px]">Elo</th>
                                <th className="py-4 px-6 text-center w-[120px]">Win Rate</th>
                                <th className="py-4 px-6 text-center w-[180px]">Recent Form</th>
                                <th className="py-4 px-6 text-center w-[100px]">Karma</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-900/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-gray-500 animate-pulse tracking-widest text-sm">
                                        SCANNING SECURE NETWORKS...
                                    </td>
                                </tr>
                            ) : players.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-gray-500 tracking-widest text-sm">
                                        NO PLAYERS REGISTERED YET
                                    </td>
                                </tr>
                            ) : (
                                players.map((player, index) => {
                                    const displayWinRate = player.win_rate !== undefined ? `${player.win_rate}%` : '-'
                                    const displayForm = player.recent_form || []
                                    return (
                                        <tr
                                            key={player.id}
                                            className="group hover:bg-cyan-500/5 transition-all duration-200 border-b border-gray-900/30"
                                        >
                                            {/* Rank */}
                                            <td className="py-4 px-6 text-center">
                                                <span className={`text-sm font-bold ${index === 0 ? 'text-yellow-400 font-extrabold text-base drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' :
                                                    index === 1 ? 'text-slate-300' :
                                                        index === 2 ? 'text-amber-600' : 'text-gray-400'
                                                    }`}>
                                                    #{index + 1}
                                                </span>
                                            </td>

                                            {/* Player */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-8 h-8 border border-cyan-500/30 bg-cyan-950/40 rounded-sm overflow-hidden flex items-center justify-center flex-shrink-0">
                                                        {player.avatar_url ? (
                                                            <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[10px] text-cyan-400 font-bold uppercase">
                                                                {player.display_name?.slice(0, 2) || 'AV'}
                                                            </span>
                                                        )}
                                                        <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-black shadow-[0_0_4px_#10b981]" />
                                                    </div>
                                                    <div>
                                                        <a href={`/profile/${player.id}`} className="text-sm font-bold tracking-wide text-gray-200 group-hover:text-cyan-400 transition-colors duration-150">
                                                            {player.display_name || 'UNKNOWN AGENT'}
                                                        </a>
                                                        {player.preferred_position && (
                                                            <span className="ml-2 px-1.5 py-0.5 text-[8px] border border-cyan-500/40 text-cyan-400 bg-cyan-950/30 uppercase tracking-widest rounded-sm">
                                                                {player.preferred_position}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Elo */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="text-sm font-bold font-mono text-[#00D4FF] drop-shadow-[0_0_5px_rgba(0,212,255,0.15)]">
                                                    {player.current_elo || 1500}
                                                </span>
                                            </td>

                                            {/* Win Rate */}
                                            <td className="py-4 px-6 text-center text-sm font-bold text-gray-300 font-mono">
                                                {displayWinRate}
                                            </td>

                                            {/* Recent Form */}
                                            <td className="py-4 px-6 text-center">
                                                {displayForm.length > 0 ? renderHexForm(displayForm) : (
                                                    <span className="text-gray-600 text-xs">No data</span>
                                                )}
                                            </td>

                                            {/* Karma */}
                                            <td className="py-4 px-6 text-center">
                                                <span className={`text-xs font-extrabold px-2 py-1 rounded-sm border ${player.karma_score >= 80
                                                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                                                    : player.karma_score >= 50
                                                        ? 'border-yellow-500/40 text-yellow-400 bg-yellow-950/20'
                                                        : 'border-red-500/40 text-red-400 bg-red-950/20 animate-pulse'
                                                    }`}>
                                                    {player.karma_score || 100}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    )
}