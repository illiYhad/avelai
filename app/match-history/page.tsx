'use client';

import { useState, useMemo } from 'react';

interface PlayerStat {
    user_id: string;
    display_name: string;
    avatar_url: string;
    role: 'Pos 1' | 'Pos 2' | 'Pos 3' | 'Pos 4' | 'Pos 5';
    kills: number;
    deaths: number;
    assists: number;
    total_score: number;
    base_kp: number;
    is_radiant: boolean;
}

interface MatchRecord {
    match_id: string;
    duration: number; // minutes
    radiant_win: boolean;
    evaluated_at: string;
    user_won: boolean;
    user_stats: PlayerStat;
    players: PlayerStat[];
}

const ROLE_COLORS: Record<string, string> = {
    'Pos 1': '#E8384F',
    'Pos 2': '#2E9BFF',
    'Pos 3': '#39FF6A',
    'Pos 4': '#D63CE8',
    'Pos 5': '#C8CDD4',
};

const MOCK_MATCHES: MatchRecord[] = [
    {
        match_id: '7891045231',
        duration: 38,
        radiant_win: true,
        evaluated_at: '2026-08-20 18:30',
        user_won: true,
        user_stats: {
            user_id: 'u1',
            display_name: 'CipherGhost',
            avatar_url: '',
            role: 'Pos 1',
            kills: 14,
            deaths: 2,
            assists: 11,
            total_score: 98.4,
            base_kp: 820,
            is_radiant: true,
        },
        players: [
            { user_id: 'u1', display_name: 'CipherGhost', avatar_url: '', role: 'Pos 1', kills: 14, deaths: 2, assists: 11, total_score: 98.4, base_kp: 820, is_radiant: true },
            { user_id: 'u2', display_name: 'NeonViper', avatar_url: '', role: 'Pos 2', kills: 9, deaths: 4, assists: 15, total_score: 85.1, base_kp: 710, is_radiant: true },
            { user_id: 'u3', display_name: 'IronAegis', avatar_url: '', role: 'Pos 3', kills: 4, deaths: 5, assists: 22, total_score: 77.3, base_kp: 640, is_radiant: true },
            { user_id: 'u4', display_name: 'PulseByte', avatar_url: '', role: 'Pos 4', kills: 3, deaths: 7, assists: 24, total_score: 69.8, base_kp: 530, is_radiant: true },
            { user_id: 'u5', display_name: 'WiredMonk', avatar_url: '', role: 'Pos 5', kills: 1, deaths: 6, assists: 28, total_score: 72.0, base_kp: 590, is_radiant: true },
        ],
    },
    {
        match_id: '7890981244',
        duration: 44,
        radiant_win: false,
        evaluated_at: '2026-08-20 16:15',
        user_won: false,
        user_stats: {
            user_id: 'u1',
            display_name: 'CipherGhost',
            avatar_url: '',
            role: 'Pos 2',
            kills: 8,
            deaths: 7,
            assists: 9,
            total_score: 62.1,
            base_kp: 480,
            is_radiant: true,
        },
        players: [
            { user_id: 'u1', display_name: 'CipherGhost', avatar_url: '', role: 'Pos 2', kills: 8, deaths: 7, assists: 9, total_score: 62.1, base_kp: 480, is_radiant: true },
            { user_id: 'u6', display_name: 'ShadowBlade', avatar_url: '', role: 'Pos 1', kills: 5, deaths: 8, assists: 4, total_score: 51.2, base_kp: 390, is_radiant: true },
        ],
    },
    {
        match_id: '7890642190',
        duration: 29,
        radiant_win: true,
        evaluated_at: '2026-08-20 14:00',
        user_won: true,
        user_stats: {
            user_id: 'u1',
            display_name: 'CipherGhost',
            avatar_url: '',
            role: 'Pos 1',
            kills: 18,
            deaths: 1,
            assists: 8,
            total_score: 112.5,
            base_kp: 950,
            is_radiant: true,
        },
        players: [
            { user_id: 'u1', display_name: 'CipherGhost', avatar_url: '', role: 'Pos 1', kills: 18, deaths: 1, assists: 8, total_score: 112.5, base_kp: 950, is_radiant: true },
        ],
    },
];

export default function MatchHistoryPage() {
    const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C'>('A');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterResult, setFilterResult] = useState<'all' | 'win' | 'loss'>('all');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<MatchRecord>(MOCK_MATCHES[0]);

    const filteredMatches = useMemo(() => {
        return MOCK_MATCHES.filter((m) => {
            const matchSearch =
                m.match_id.includes(searchTerm) ||
                m.user_stats.display_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchResult =
                filterResult === 'all' ||
                (filterResult === 'win' && m.user_won) ||
                (filterResult === 'loss' && !m.user_won);
            const matchRole = filterRole === 'all' || m.user_stats.role === filterRole;
            return matchSearch && matchResult && matchRole;
        });
    }, [searchTerm, filterResult, filterRole]);

    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white p-4 md:p-8 relative overflow-hidden font-sans">
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@600;800&display=swap');
        .font-jetbrains { font-family: 'JetBrains Mono', monospace !important; }
        .font-orbitron { font-family: 'Orbitron', sans-serif !important; }
      `}</style>

            {/* Cyber Scanline */}
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 212, 255, 0.03) 2px, rgba(0, 212, 255, 0.03) 4px)`,
                }}
            />

            <div className="max-w-7xl mx-auto z-10 relative">
                {/* Header & Prototype Selector */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-[#00D4FF]/20 pb-4 gap-4">
                    <div>
                        <h1 className="font-orbitron text-2xl md:text-3xl text-[#00D4FF] tracking-wider">
                            [ 2.4 MATCH ARCHIVE ]
                        </h1>
                        <p className="text-xs text-gray-400 font-jetbrains mt-1">
                            Select Prototype Option to review UI/UX layout
                        </p>
                    </div>

                    <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
                        {(['A', 'B', 'C'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded font-orbitron text-xs transition-all ${activeTab === tab
                                        ? 'bg-[#00D4FF] text-black font-bold shadow-[0_0_10px_#00D4FF]'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Option {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Global Controls */}
                <div className="flex flex-wrap gap-4 mb-6 font-jetbrains text-sm">
                    <input
                        type="text"
                        placeholder="Search Match ID / Player..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-black/60 border border-gray-800 focus:border-[#00D4FF] px-4 py-2 rounded text-white outline-none w-full sm:w-64"
                    />
                    <select
                        value={filterResult}
                        onChange={(e) => setFilterResult(e.target.value as any)}
                        className="bg-black/60 border border-gray-800 focus:border-[#00D4FF] px-3 py-2 rounded text-gray-300 outline-none"
                    >
                        <option value="all">All Results</option>
                        <option value="win">Victories</option>
                        <option value="loss">Defeats</option>
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

                {/* --- OPTION A: Cyber Terminal Table --- */}
                {activeTab === 'A' && (
                    <div className="border border-gray-800 bg-gray-950/70 rounded-lg overflow-x-auto">
                        <table className="w-full text-left font-jetbrains text-xs">
                            <thead className="bg-gray-900/80 border-b border-gray-800 text-[#00D4FF]">
                                <tr>
                                    <th className="p-4">MATCH ID</th>
                                    <th className="p-4">TIME</th>
                                    <th className="p-4">RESULT</th>
                                    <th className="p-4">ROLE</th>
                                    <th className="p-4">KDA</th>
                                    <th className="p-4">SCORE</th>
                                    <th className="p-4">BASE KP</th>
                                    <th className="p-4">DURATION</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-900">
                                {filteredMatches.map((m) => (
                                    <tr key={m.match_id} className="hover:bg-gray-900/40 transition-colors">
                                        <td className="p-4 text-gray-300 font-bold">#{m.match_id}</td>
                                        <td className="p-4 text-gray-500">{m.evaluated_at}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${m.user_won ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                                                }`}>
                                                {m.user_won ? 'VICTORY' : 'DEFEAT'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span style={{ color: ROLE_COLORS[m.user_stats.role] }} className="font-bold">
                                                {m.user_stats.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {m.user_stats.kills} / <span className="text-red-400">{m.user_stats.deaths}</span> / {m.user_stats.assists}
                                        </td>
                                        <td className="p-4 text-[#C9A84C] font-bold">{m.user_stats.total_score}</td>
                                        <td className="p-4 text-gray-400">{m.user_stats.base_kp}</td>
                                        <td className="p-4 text-gray-500">{m.duration}m</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- OPTION B: Match Card Feed --- */}
                {activeTab === 'B' && (
                    <div className="flex flex-col gap-4 font-jetbrains">
                        {filteredMatches.map((m) => (
                            <div
                                key={m.match_id}
                                className={`border rounded-lg p-5 transition-all ${m.user_won ? 'border-[#00D4FF]/30 bg-gray-950/60' : 'border-[#EF4444]/30 bg-gray-950/60'
                                    }`}
                            >
                                <div className="flex flex-wrap justify-between items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-12 rounded ${m.user_won ? 'bg-[#00D4FF]' : 'bg-[#EF4444]'}`} />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-orbitron font-bold text-sm ${m.user_won ? 'text-[#00D4FF]' : 'text-[#EF4444]'
                                                    }`}>
                                                    {m.user_won ? 'VICTORY' : 'DEFEAT'}
                                                </span>
                                                <span className="text-gray-500 text-xs">#{m.match_id}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {m.evaluated_at} • {m.duration} mins
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 text-sm">
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase">Role</div>
                                            <span style={{ color: ROLE_COLORS[m.user_stats.role] }} className="font-bold">
                                                {m.user_stats.role}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase">K / D / A</div>
                                            <span>{m.user_stats.kills}/{m.user_stats.deaths}/{m.user_stats.assists}</span>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase">Score / KP</div>
                                            <span className="text-[#C9A84C] font-bold">{m.user_stats.total_score}</span>
                                            <span className="text-xs text-gray-500"> ({m.user_stats.base_kp} KP)</span>
                                        </div>
                                        <button
                                            onClick={() => setExpandedMatchId(expandedMatchId === m.match_id ? null : m.match_id)}
                                            className="px-3 py-1.5 border border-gray-800 hover:border-gray-600 rounded text-xs text-gray-400"
                                        >
                                            {expandedMatchId === m.match_id ? 'Hide Roster' : 'View Roster'}
                                        </button>
                                    </div>
                                </div>

                                {expandedMatchId === m.match_id && (
                                    <div className="mt-4 pt-4 border-t border-gray-900 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                        {m.players.map((p) => (
                                            <div key={p.user_id} className="flex justify-between bg-black/40 p-2 rounded border border-gray-900">
                                                <span className="text-gray-300">{p.display_name}</span>
                                                <span style={{ color: ROLE_COLORS[p.role] }}>{p.role}</span>
                                                <span className="text-gray-400">{p.kills}/{p.deaths}/{p.assists}</span>
                                                <span className="text-[#C9A84C]">{p.total_score}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* --- OPTION C: Split Panel NOC Dashboard --- */}
                {activeTab === 'C' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-jetbrains">
                        {/* Left List */}
                        <div className="lg:col-span-5 flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2">
                            {filteredMatches.map((m) => (
                                <div
                                    key={m.match_id}
                                    onClick={() => setSelectedMatch(m)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedMatch.match_id === m.match_id
                                            ? 'border-[#00D4FF] bg-[#00D4FF]/10'
                                            : 'border-gray-800 bg-gray-950/40 hover:bg-gray-900/40'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold ${m.user_won ? 'text-[#00D4FF]' : 'text-[#EF4444]'}`}>
                                            {m.user_won ? 'WIN' : 'LOSS'} • #{m.match_id}
                                        </span>
                                        <span className="text-xs text-gray-500">{m.duration}m</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                                        <span style={{ color: ROLE_COLORS[m.user_stats.role] }}>{m.user_stats.role}</span>
                                        <span>{m.user_stats.kills}/{m.user_stats.deaths}/{m.user_stats.assists}</span>
                                        <span className="text-[#C9A84C] font-bold">{m.user_stats.total_score} pts</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Right Inspector */}
                        <div className="lg:col-span-7 border border-[#00D4FF]/30 bg-gray-950/80 rounded-lg p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                                    <div>
                                        <h2 className="font-orbitron text-lg text-white">MATCH #{selectedMatch.match_id}</h2>
                                        <p className="text-xs text-gray-500 mt-1">Evaluated at {selectedMatch.evaluated_at}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded text-xs font-bold ${selectedMatch.user_won ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                                        }`}>
                                        {selectedMatch.user_won ? 'VICTORY' : 'DEFEAT'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 my-6 text-center">
                                    <div className="bg-black/50 p-3 rounded border border-gray-900">
                                        <div className="text-[10px] text-gray-500 uppercase">Duration</div>
                                        <div className="text-lg font-bold text-white mt-1">{selectedMatch.duration}m</div>
                                    </div>
                                    <div className="bg-black/50 p-3 rounded border border-gray-900">
                                        <div className="text-[10px] text-gray-500 uppercase">Base KP</div>
                                        <div className="text-lg font-bold text-[#00D4FF] mt-1">{selectedMatch.user_stats.base_kp}</div>
                                    </div>
                                    <div className="bg-black/50 p-3 rounded border border-gray-900">
                                        <div className="text-[10px] text-gray-500 uppercase">Total Score</div>
                                        <div className="text-lg font-bold text-[#C9A84C] mt-1">{selectedMatch.user_stats.total_score}</div>
                                    </div>
                                </div>

                                <h3 className="text-xs font-orbitron text-[#00D4FF] mb-3 uppercase tracking-wider">Player Breakdown</h3>
                                <div className="flex flex-col gap-2">
                                    {selectedMatch.players.map((p) => (
                                        <div key={p.user_id} className="flex justify-between items-center bg-black/40 p-2.5 rounded border border-gray-900 text-xs">
                                            <span className="text-gray-200 font-bold">{p.display_name}</span>
                                            <span style={{ color: ROLE_COLORS[p.role] }}>{p.role}</span>
                                            <span className="text-gray-400">{p.kills} / {p.deaths} / {p.assists}</span>
                                            <span className="text-[#C9A84C] font-bold">{p.total_score}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}