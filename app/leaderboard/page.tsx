'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SampleChip } from '@/components/tournament/TournamentHub'

const POSITIONS = ['Global', 'Pos 1', 'Pos 2', 'Pos 3', 'Pos 4', 'Pos 5']

type Player = {
    id: string
    display_name: string
    avatar_url?: string
    current_elo: number
    karma_score?: number // K-AV-FIX2: ไม่อยู่ใน public_profiles_v → ไม่ได้อ่าน (แสดง —)
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
                    .from('public_profiles_v')
                    .select('id, display_name, avatar_url, current_elo, win_rate, preferred_position')
                    .order('current_elo', { ascending: false })
                    .limit(100)

                if (activeTab !== 'Global') {
                    query = query.eq('preferred_position', activeTab)
                }

                const { data, error } = await query

                if (error) {
                    console.error('profiles error:', error.message)
                    const { data: fallbackData } = await supabase
                        .from('public_profiles_v')
                        .select('id, display_name, current_elo')
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
    // K-AV-UX4c: ค่าเริ่มต้น W W L W W เป็นข้อมูลสมมติ → ติดชิปเมื่อใช้ค่านี้
    let isSample = true;
    if (Array.isArray(form)) {
      formArray = form;
      isSample = false;
    } else if (typeof form === 'string') {
      try {
        const parsed = JSON.parse(form);
        if (Array.isArray(parsed)) { formArray = parsed; isSample = false; }
      } catch (e) {
        formArray = ['W', 'W', 'L', 'W', 'W'];
      }
    }

    return (
      <div className="flex items-center gap-1.5 justify-center">
        {formArray.map((result, i) => (
          <div
            key={i}
            className="w-5 h-6 flex items-center justify-center text-xs font-bold transition-all"
          >
            {result}
          </div>
        ))}
        {isSample && <SampleChip />}
      </div>
    );
  };
    return (
        <main className="min-h-screen text-ink pt-20 p-4 md:pt-24 md:p-8 font-mono relative overflow-hidden">
            {/* K-AV-UX4b: แสงพื้นหลังมาจาก body ของ UX4 แล้ว */}

            {/* Prize Pool */}
            <div className="flex flex-col items-center justify-center mb-10 mt-16">
                <div className="hud-panel hud-panel-gold ci-corners hud-hero relative px-8 py-5 rounded-xl text-center w-full max-w-100">
                    <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-2">DAILY PRIZE POOL</p>
                    <div className="flex justify-center mb-2"><SampleChip /></div>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-black text-gold">THB</span>
                        <h2 className="text-3xl md:text-4xl font-black text-gold tracking-wider">
                            {prizePool.toLocaleString()}
                        </h2>
                        <span className="text-lg font-medium text-gold self-end mb-1">THB</span>
                    </div>
                    <p className="text-xs text-ink-muted tracking-widest mt-2">75% COMMUNITY RETURN &middot; AUTO SEEDED</p>
                </div>
            </div>

            {/* Position Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-8">
                {POSITIONS.map(pos => (
                    <button
                        key={pos}
                        onClick={() => setActiveTab(pos)}
                        className={`px-4 py-2 text-xs md:text-sm font-bold border uppercase tracking-wider transition-all duration-300 ${activeTab === pos
                            ? 'border-cyan text-cyan bg-cyan/10 shadow-glow-cyan'
                            : 'border-line text-ink-muted hover:border-cyan/40 hover:text-ink'
                            }`}
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                    >
                        {pos}
                    </button>
                ))}
            </div>

            {/* Leaderboard Table */}
            <div className="max-w-6xl mx-auto hud-panel ci-corners rounded-xl p-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-cyan/20 text-cyan/80 text-xs uppercase tracking-[0.2em] font-semibold bg-cyan/10">
                                <th className="py-4 px-6 text-center w-[80px]">Rank</th>
                                <th className="py-4 px-6">Player</th>
                                <th className="py-4 px-6 text-center w-[120px]">Elo</th>
                                <th className="py-4 px-6 text-center w-[120px]">Win Rate</th>
                                <th className="py-4 px-6 text-center w-[180px]">Recent Form</th>
                                <th className="py-4 px-6 text-center w-[100px]">Karma</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-ink-muted animate-pulse tracking-widest text-sm">
                                        SCANNING SECURE NETWORKS...
                                    </td>
                                </tr>
                            ) : players.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-ink-muted tracking-widest text-sm">
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
                                            className="group hover:bg-cyan/5 transition-all duration-200 border-b border-line"
                                        >
                                            {/* Rank */}
                                            <td className="py-4 px-6 text-center">
                                                <span className={`text-sm font-bold ${index === 0 ? 'text-gold font-extrabold text-base drop-shadow-glow-gold' :
                                                    index === 1 ? 'text-ink' :
                                                        index === 2 ? 'text-gold-deep' : 'text-ink-muted'
                                                    }`}>
                                                    #{index + 1}
                                                </span>
                                            </td>

                                            {/* Player */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-8 h-8 border border-cyan/30 bg-cyan/10 rounded-sm overflow-hidden flex items-center justify-center flex-shrink-0">
                                                        {player.avatar_url ? (
                                                            <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs text-cyan font-bold uppercase">
                                                                {player.display_name?.slice(0, 2) || 'AV'}
                                                            </span>
                                                        )}
                                                        <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-black" />
                                                    </div>
                                                    <div>
                                                        <a href={`/profile/${player.id}`} className="text-sm font-bold tracking-wide text-ink group-hover:text-cyan transition-colors duration-150">
                                                            {player.display_name || 'UNKNOWN AGENT'}
                                                        </a>
                                                        {player.preferred_position && (
                                                            <span className="ml-2 px-1.5 py-0.5 text-xs border border-cyan/40 text-cyan bg-cyan/10 uppercase tracking-widest rounded-sm">
                                                                {player.preferred_position}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Elo */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="text-sm font-bold font-mono text-cyan drop-shadow-glow-cyan">
                                                    {player.current_elo || 1500}
                                                </span>
                                            </td>

                                            {/* Win Rate */}
                                            <td className="py-4 px-6 text-center text-sm font-bold text-ink font-mono">
                                                {displayWinRate}
                                            </td>

                                            {/* Recent Form */}
                                            <td className="py-4 px-6 text-center">
                                                {displayForm.length > 0 ? renderHexForm(displayForm) : (
                                                    <span className="text-ink-muted/60 text-xs">No data</span>
                                                )}
                                            </td>

                                            {/* Karma */}
                                            <td className="py-4 px-6 text-center">
                                                {player.karma_score === undefined ? (
                                                    <span className="text-ink-muted/60 text-xs">—</span>
                                                ) : (
                                                <span className={`text-xs font-extrabold px-2 py-1 rounded-sm border ${player.karma_score >= 80
                                                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                                                    : player.karma_score >= 50
                                                        ? 'border-gold/40 text-gold bg-gold/10'
                                                        : 'border-red-500/40 text-red-400 bg-red-950/20 animate-pulse'
                                                    }`}>
                                                    {player.karma_score}
                                                </span>
                                                )}
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