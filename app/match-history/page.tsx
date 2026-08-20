'use client';

import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface PlayerStat {
    id?: string;
    user_id: string;
    role: string;
    kills: number;
    deaths: number;
    assists: number;
    total_score: number;
    base_kp: number;
    is_radiant?: boolean;
    users?: {
        display_name: string;
        avatar_url: string;
    };
}

interface MatchRecord {
    match_id: string;
    duration: number;
    radiant_win: boolean;
    evaluated_at: string;
    match_players: PlayerStat[];
}

const ROLE_COLORS: Record<string, string> = {
    'Pos 1': '#E8384F',
    'Pos 2': '#2E9BFF',
    'Pos 3': '#39FF6A',
    'Pos 4': '#D63CE8',
    'Pos 5': '#C8CDD4',
};

export default function MatchHistoryPage() {
    const [matches, setMatches] = useState<MatchRecord[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterResult, setFilterResult] = useState<string>('all');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
    );

    useEffect(() => {
        async function fetchMatchHistory() {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('matches')
                    .select(`
            match_id,
            duration,
            radiant_win,
            evaluated_at,
            match_players (
              id,
              user_id,
              role,
              kills,
              deaths,
              assists,
              total_score,
              base_kp,
              is_radiant,
              users (
                display_name,
                avatar_url
              )
            )
          `)
                    .order('evaluated_at', { ascending: false });

                if (error) throw error;

                if (data && data.length > 0) {
                    setMatches(data as any);
                    setSelectedMatch(data[0] as any);
                }
            } catch (err) {
                console.error('Error fetching match history:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchMatchHistory();
    }, []);

    const filteredMatches = useMemo(() => {
        return matches.filter((m) => {
            const matchSearch =
                m.match_id?.toString().includes(searchTerm) ||
                m.match_players?.some((p) =>
                    p.users?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
                );

            const isRadiantWon = m.radiant_win;
            const matchResult =
                filterResult === 'all' ||
                (filterResult === 'win' && isRadiantWon) ||
                (filterResult === 'loss' && !isRadiantWon);

            const matchRole =
                filterRole === 'all' ||
                m.match_players?.some((p) => p.role === filterRole);

            return matchSearch && matchResult && matchRole;
        });
    }, [matches, searchTerm, filterResult, filterRole]);

    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white px-4 md:px-8 pb-12 pt-24 md:pt-28 relative overflow-hidden font-mono">
            {/* Cyber Scanline */}
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 212, 255, 0.03) 2px, rgba(0, 212, 255, 0.03) 4px)',
                }}
            />

            <div className="max-w-7xl mx-auto z-10 relative">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[#00D4FF]/20 pb-6 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl text-[#00D4FF] tracking-wider font-bold">
                            [ MATCH ARCHIVE ]
                        </h1>
                        <p className="text-xs text-gray-400 mt-1">
                            Live Esports Combat Network & Match Analytics
                        </p>
                    </div>
                </div>

                {/* Global Controls */}
                <div className="flex flex-wrap gap-4 mb-6 text-sm">
                    <input
                        type="text"
                        placeholder="Search Match ID / Player..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-black/60 border border-gray-800 focus:border-[#00D4FF] px-4 py-2 rounded text-white outline-none w-full sm:w-64"
                    />
                    <select
                        value={filterResult}
                        onChange={(e) => setFilterResult(e.target.value)}
                        className="bg-black/60 border border-gray-800 focus:border-[#00D4FF] px-3 py-2 rounded text-gray-300 outline-none"
                    >
                        <option value="all">All Results</option>
                        <option value="win">Radiant Victory</option>
                        <option value="loss">Dire Victory</option>
                    </select>
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="bg-black/60 border border-gray-800 focus:border-[#00D4FF] px-3 py-2 rounded text-gray-300 outline-none"
                    >
                        <option value="all">All Roles</option>
                        <option value="Pos 1">Pos 1 (Carry)</option>
                        <option value="Pos 2">Pos 2 (Mid)</option>
                        <option value="Pos 3">Pos 3 (Offlane)</option>
                        <option value="Pos 4">Pos 4 (Soft Supp)</option>
                        <option value="Pos 5">Pos 5 (Hard Supp)</option>
                    </select>
                </div>

                {/* --- Option C: Split Panel Layout --- */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500 animate-pulse">
                        [ INITIALIZING ARCHIVE STREAM... ]
                    </div>
                ) : filteredMatches.length === 0 ? (
                    <div className="text-center py-20 text-gray-600 border border-gray-900 rounded-lg bg-black/40">
                        NO MATCH DATA DETECTED
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left List */}
                        <div className="lg:col-span-5 flex flex-col gap-3 max-h-[650px] overflow-y-auto pr-2">
                            {filteredMatches.map((m) => {
                                const leadPlayer = m.match_players?.[0];
                                return (
                                    <div
                                        key={m.match_id}
                                        onClick={() => setSelectedMatch(m)}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedMatch?.match_id === m.match_id
                                            ? 'border-[#00D4FF] bg-[#00D4FF]/10 shadow-[0_0_15px_rgba(0,212,255,0.15)]'
                                            : 'border-gray-800 bg-gray-950/40 hover:bg-gray-900/40'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span
                                                className={`text-xs font-bold ${m.radiant_win ? 'text-[#00D4FF]' : 'text-[#EF4444]'
                                                    }`}
                                            >
                                                {m.radiant_win ? 'RADIANT WIN' : 'DIRE WIN'} • #{m.match_id}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {Math.floor(m.duration / 60)}m {m.duration % 60}s
                                            </span>
                                        </div>
                                        {leadPlayer && (
                                            <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                                                <span
                                                    style={{
                                                        color: ROLE_COLORS[leadPlayer.role] || '#C8CDD4',
                                                    }}
                                                    className="font-bold"
                                                >
                                                    {leadPlayer.role || 'Player'}
                                                </span>
                                                <span>
                                                    {leadPlayer.kills}/{leadPlayer.deaths}/{leadPlayer.assists}
                                                </span>
                                                <span className="text-[#C9A84C] font-bold">
                                                    {leadPlayer.total_score || 0} pts
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right Inspector */}
                        {selectedMatch && (
                            <div className="lg:col-span-7 border border-[#00D4FF]/30 bg-gray-950/80 rounded-lg p-6 flex flex-col justify-between backdrop-blur-sm shadow-xl">
                                <div>
                                    <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                                        <div>
                                            <h2 className="text-lg text-white font-bold tracking-wide">
                                                MATCH #{selectedMatch.match_id}
                                            </h2>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Evaluated at {new Date(selectedMatch.evaluated_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div
                                            className={`px-3 py-1 rounded text-xs font-bold ${selectedMatch.radiant_win
                                                ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                                                : 'bg-[#EF4444]/20 text-[#EF4444]'
                                                }`}
                                        >
                                            {selectedMatch.radiant_win ? 'RADIANT VICTORY' : 'DIRE VICTORY'}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 my-6 text-center">
                                        <div className="bg-black/50 p-3 rounded border border-gray-900">
                                            <div className="text-[10px] text-gray-500 uppercase">Duration</div>
                                            <div className="text-lg font-bold text-white mt-1">
                                                {Math.floor(selectedMatch.duration / 60)}m {selectedMatch.duration % 60}s
                                            </div>
                                        </div>
                                        <div className="bg-black/50 p-3 rounded border border-gray-900">
                                            <div className="text-[10px] text-gray-500 uppercase">Total KP Pool</div>
                                            <div className="text-lg font-bold text-[#00D4FF] mt-1">
                                                {selectedMatch.match_players?.reduce((acc, p) => acc + (p.base_kp || 0), 0)}
                                            </div>
                                        </div>
                                        <div className="bg-black/50 p-3 rounded border border-gray-900">
                                            <div className="text-[10px] text-gray-500 uppercase">Avg Score</div>
                                            <div className="text-lg font-bold text-[#C9A84C] mt-1">
                                                {(
                                                    selectedMatch.match_players?.reduce((acc, p) => acc + (p.total_score || 0), 0) /
                                                    Math.max(selectedMatch.match_players?.length || 1, 1)
                                                ).toFixed(1)}
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-xs text-[#00D4FF] mb-3 uppercase tracking-wider font-bold">
                                        Player Breakdown
                                    </h3>
                                    <div className="flex flex-col gap-2">
                                        {selectedMatch.match_players?.map((p, idx) => (
                                            <div
                                                key={p.id || idx}
                                                className="flex justify-between items-center bg-black/40 p-3 rounded border border-gray-900 text-xs hover:border-gray-800 transition-colors"
                                            >
                                                <span className="text-gray-200 font-bold">
                                                    {p.users?.display_name || `Player ${idx + 1}`}
                                                </span>
                                                <span
                                                    style={{
                                                        color: ROLE_COLORS[p.role] || '#C8CDD4',
                                                    }}
                                                    className="font-bold"
                                                >
                                                    {p.role || 'Pos 5'}
                                                </span>
                                                <span className="text-gray-400">
                                                    {p.kills} / <span className="text-red-400">{p.deaths}</span> / {p.assists}
                                                </span>
                                                <span className="text-[#C9A84C] font-bold">
                                                    {p.total_score || 0}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}