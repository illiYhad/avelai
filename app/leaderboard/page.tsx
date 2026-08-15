'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const POSITIONS = ['Global', 'Pos 1', 'Pos 2', 'Pos 3', 'Pos 4', 'Pos 5']

type Player = {
    id: string
    display_name: string
    current_elo: number
    karma_score: number
}

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState('Global')
    const [players, setPlayers] = useState<Player[]>([])
    const [prizePool, setPrizePool] = useState(0)
    const supabase = createClient()

    useEffect(() => {
        const target = 12750
        const duration = 2000
        const step = target / (duration / 16)
        let current = 0
        const timer = setInterval(() => {
            current += step
            if (current >= target) { current = target; clearInterval(timer) }
            setPrizePool(Math.floor(current))
        }, 16)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const fetchPlayers = async () => {
            const { data } = await supabase
                .from('users')
                .select('id, display_name, current_elo, karma_score')
                .order('current_elo', { ascending: false })
                .limit(100)
            if (data) setPlayers(data)
        }
        fetchPlayers()
        const channel = supabase
            .channel('leaderboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchPlayers)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    return (
        <main className="min-h-screen bg-[#0A0A0F] text-white px-4 py-8">
            <div className="text-center mb-10">
                <div className="inline-block border border-[#C9A84C] px-8 py-4 rounded">
                    <p className="font-mono text-sm text-[#C9A84C] tracking-widest mb-1">DAILY PRIZE POOL</p>
                    <p className="font-mono text-4xl font-bold text-white">�{prizePool.toLocaleString()} THB</p>
                    <p className="text-xs text-gray-400 mt-1">75% Community Return</p>
                </div>
            </div>
            <div className="flex gap-2 mb-6 overflow-x-auto">
                {POSITIONS.map(pos => (
                    <button key={pos} onClick={() => setActiveTab(pos)}
                        className={`px-4 py-2 text-sm font-mono border rounded whitespace-nowrap transition-all ${activeTab === pos ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10' : 'border-gray-700 text-gray-400'
                            }`}>
                        {pos.toUpperCase()}
                    </button>
                ))}
            </div>
            <div className="border border-gray-800 rounded overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#12121A] text-xs text-gray-400 font-mono tracking-widest">
                            <th className="py-3 px-4 text-left">RANK</th>
                            <th className="py-3 px-4 text-left">PLAYER</th>
                            <th className="py-3 px-4 text-right">ELO</th>
                            <th className="py-3 px-4 text-right">KARMA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player, index) => (
                            <tr key={player.id} className="border-t border-gray-800/50 hover:bg-[#00D4FF]/5 transition-colors">
                                <td className="py-3 px-4">
                                    <span className={`font-mono font-bold text-sm ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                                        #{index + 1}
                                    </span>
                                </td>
                                <td className="py-3 px-4">
                                    <a href={`/profile/${player.id}`} className="font-mono text-sm text-white hover:text-[#00D4FF] transition-colors">
                                        {player.display_name || 'UNKNOWN'}
                                    </a>
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-[#C9A84C] font-bold">{player.current_elo}</td>
                                <td className="py-3 px-4 text-right font-mono text-sm text-gray-300">{player.karma_score}</td>
                            </tr>
                        ))}
                        {players.length === 0 && (
                            <tr><td colSpan={4} className="py-12 text-center font-mono text-gray-600 text-sm">NO PLAYERS REGISTERED YET</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    )
}
