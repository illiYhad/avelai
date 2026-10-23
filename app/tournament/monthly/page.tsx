/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export interface CircuitPlayer {
    rank: number;
    name: string;
    circuitPoints: number;
    winRate: number;
    isQualified: boolean;
}

export type IntegrityRarity = 'NONE' | 'COMMON' | 'EPIC' | 'LEGENDARY';
export type PlayerPosition = 1 | 2 | 3 | 4 | 5;

export interface IntegrityCardProps {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    rarity: IntegrityRarity;
    position: PlayerPosition;
    team: 'TEAM_A' | 'TEAM_B';
    karmaScore?: number;
    winRate?: number;
    cardArtworkUrl?: string;
    isCurrentUser?: boolean;
}

export interface StoreItem {
    itemId: string;
    name: string;
    description: string;
    category: 'TICKETS' | 'BOOSTERS' | 'MATERIALS' | 'COSMETICS';
    costRewardPoints: number;
    stockRemaining: number;
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    icon: string;
    badge?: string;
}

export interface BracketMatch {
    matchId: string;
    roundNumber: number;
    seed1: number | null;
    seed2: number | null;
    player1Id?: string | null;
    player2Id?: string | null;
    winnerAdvancesTo?: string | null;
    loserAdvancesTo?: string | null;
    status: 'waiting' | 'ready' | 'completed';
}

export interface BracketRound {
    roundId: string;
    roundNumber: number;
    matches: BracketMatch[];
}

export interface MonthlyDoubleEliminationBracket {
    bracketId: string;
    seasonId: string;
    tournamentId: string;
    winnersTree: { rounds: BracketRound[] };
    losersTree: { rounds: BracketRound[] };
    grandFinal: {
        matchId: string;
        seed1: number | null;
        seed2: number | null;
        requiresReset: boolean;
        status: 'waiting' | 'ready' | 'completed';
    };
    status: 'ready' | 'in_progress' | 'completed';
    createdAt: string;
}

// ============================================================================
// 2. CONSTANTS & MOCK DATA
// ============================================================================

const ROLE_COLORS: Record<PlayerPosition, string> = { 1: '#E8384F', 2: '#2E9BFF', 3: '#39FF6A', 4: '#D63CE8', 5: '#C8CDD4' };
const ROLE_NAMES: Record<PlayerPosition, string> = { 1: 'POS 1 · CARRY', 2: 'POS 2 · MID', 3: 'POS 3 · OFF', 4: 'POS 4 · SOFT', 5: 'POS 5 · HARD' };

const MOCK_LOBBY_PARTICIPANTS: IntegrityCardProps[] = [
    { userId: 'u1', displayName: 'AcesHigh', rarity: 'LEGENDARY', position: 1, team: 'TEAM_A', winRate: 64.2, karmaScore: 120 },
    { userId: 'u2', displayName: 'MidOrFeed', rarity: 'EPIC', position: 2, team: 'TEAM_A', winRate: 58.0, karmaScore: 105 },
    { userId: 'u3', displayName: 'OfflaneGod', rarity: 'COMMON', position: 3, team: 'TEAM_A', winRate: 51.5, karmaScore: 98 },
    { userId: 'u4', displayName: 'WardMaster', rarity: 'NONE', position: 4, team: 'TEAM_A', winRate: 48.0, karmaScore: 90, isCurrentUser: true },
    { userId: 'u5', displayName: 'SilentSupport', rarity: 'COMMON', position: 5, team: 'TEAM_A', winRate: 52.4, karmaScore: 100 },
    { userId: 'u6', displayName: 'ShadowFiend99', rarity: 'LEGENDARY', position: 1, team: 'TEAM_B', winRate: 68.0, karmaScore: 130 },
    { userId: 'u7', displayName: 'InvokerSpam', rarity: 'EPIC', position: 2, team: 'TEAM_B', winRate: 55.2, karmaScore: 110 },
    { userId: 'u8', displayName: 'AxeCuller', rarity: 'NONE', position: 3, team: 'TEAM_B', winRate: 49.0, karmaScore: 85 },
    { userId: 'u9', displayName: 'RoamingGank', rarity: 'COMMON', position: 4, team: 'TEAM_B', winRate: 50.0, karmaScore: 95 },
    { userId: 'u10', displayName: 'HardSave5', rarity: 'EPIC', position: 5, team: 'TEAM_B', winRate: 57.8, karmaScore: 112 },
];

const CATALOG_ITEMS: StoreItem[] = [
    { itemId: 'TICKET_GASHA_GENESIS', name: 'Genesis Gasha Ticket', description: 'ใช้สำหรับสุ่มการ์ด Match Integrity Card ระดับ Rare - Legendary', category: 'TICKETS', costRewardPoints: 100, stockRemaining: 999, rarity: 'RARE', icon: '🎟️', badge: 'HOT' },
    { itemId: 'PACK_BOOSTER_CARD_01', name: 'Alpha Cyber Booster Pack', description: 'การ์ดบูสเตอร์เสริมพลังแต้มโบนัส Hero Mastery + ชิ้นส่วนการ์ด 3 ชิ้น', category: 'BOOSTERS', costRewardPoints: 250, stockRemaining: 45, rarity: 'EPIC', icon: '📦', badge: 'LIMITED' },
    { itemId: 'MAT_CYBER_ALLOY_01', name: 'Cyber Alloy Shard (x10)', description: 'ชิ้นส่วนอัลลอยสำหรับคราฟต์กรอบ Avatar และตกแต่ง Profile Holo-Frame', category: 'MATERIALS', costRewardPoints: 50, stockRemaining: 200, rarity: 'COMMON', icon: '🔩' },
];

const RARITY_COLORS: Record<string, string> = {
    COMMON: 'border-gray-700 text-gray-300',
    UNCOMMON: 'border-[#39FF6A]/60 text-[#39FF6A]',
    RARE: 'border-[#2E9BFF]/70 text-[#2E9BFF]',
    EPIC: 'border-[#D63CE8]/70 text-[#D63CE8]',
    LEGENDARY: 'border-[#C9A84C] text-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.3)]',
};

function generateMockBracketData(): MonthlyDoubleEliminationBracket {
    // แก้ไข WB R1 ให้ครบ 8 แมทช์ (สำหรับ 16 ทีม) ตามคำท้วงของ QA
    const wbR1Matches: BracketMatch[] = Array.from({ length: 8 }, (_, i) => ({
        matchId: `WB_R1_M${i + 1}`,
        roundNumber: 1,
        seed1: (i * 2) + 1,
        seed2: (i * 2) + 2,
        player1Id: `Player ${(i * 2) + 1}`,
        player2Id: `Player ${(i * 2) + 2}`,
        winnerAdvancesTo: `WB_R2_M${Math.floor(i / 2) + 1}`,
        loserAdvancesTo: `LB_R1_M${Math.floor(i / 2) + 1}`,
        status: i === 0 ? 'completed' : 'ready'
    }));
    
    const wbR2Matches: BracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
        matchId: `WB_R2_M${i + 1}`,
        roundNumber: 2,
        seed1: null,
        seed2: null,
        winnerAdvancesTo: `WB_R3_M${Math.floor(i / 2) + 1}`,
        loserAdvancesTo: `LB_R2_M${i + 1}`,
        status: 'waiting'
    }));

    return {
        bracketId: `BRACKET_01`,
        seasonId: 'SS_01',
        tournamentId: 'MONTHLY_AUG',
        winnersTree: { rounds: [{ roundId: 'WB_R1', roundNumber: 1, matches: wbR1Matches }, { roundId: 'WB_R2', roundNumber: 2, matches: wbR2Matches }] },
        losersTree: { rounds: [{ roundId: 'LB_R1', roundNumber: 1, matches: [] }] },
        grandFinal: { matchId: 'GF_GAME1', seed1: null, seed2: null, requiresReset: true, status: 'waiting' },
        status: 'in_progress',
        createdAt: new Date().toISOString()
    };
}

// ============================================================================
// 3. SUB-COMPONENTS
// ============================================================================

const IntegrityCard: React.FC<IntegrityCardProps> = ({ displayName, avatarUrl, rarity, position, team, karmaScore = 100, winRate = 50.0, isCurrentUser = false }) => {
    const roleColor = ROLE_COLORS[position];
    const teamBorder = team === 'TEAM_A' ? '#00D4FF' : '#C9A84C';

    if (rarity === 'NONE') {
        return (
            <div className="relative w-full max-w-50 h-80 rounded-xl border border-dashed border-gray-700 bg-[#0A0A0F]/80 p-4 flex flex-col justify-between items-center text-center">
                <div className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border" style={{ borderColor: `${roleColor}55`, color: roleColor, backgroundColor: `${roleColor}15` }}>
                    {ROLE_NAMES[position]}
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-gray-500 font-bold mb-2 overflow-hidden">
                        {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-300">{displayName}</span>
                </div>
                <div className="w-full pt-2 border-t border-gray-800">
                    {isCurrentUser ? <button className="w-full py-1.5 bg-amber-500 text-black text-[10px] font-bold rounded">GET CARD</button> : <span className="text-[10px] text-gray-600">UNPROTECTED</span>}
                </div>
            </div>
        );
    }
    return (
        <div className={`relative w-full max-w-50 h-80 rounded-xl bg-[#0A0A0F] p-3 flex flex-col justify-between border ${rarity === 'LEGENDARY' ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,212,255,0.4)]' : rarity === 'EPIC' ? 'border-amber-400' : 'border-gray-500'}`}>
            <div className="relative z-10 flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: `${roleColor}88`, color: roleColor }}>{ROLE_NAMES[position]}</span>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${rarity === 'LEGENDARY' ? 'bg-cyan-400 text-black' : 'bg-gray-400 text-black'}`}>{rarity}</span>
            </div>
            <div className="relative z-10 w-full h-35 my-1.5 rounded-lg border border-gray-800 bg-gray-900 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full border-2 mb-1 flex items-center justify-center text-white overflow-hidden" style={{ borderColor: teamBorder }}>
                    {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
                </div>
            </div>
            <div className="relative z-10 pt-1.5 border-t border-gray-800 font-mono">
                <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-white truncate">{displayName}</span>
                    <span className="text-[10px] text-emerald-400">{winRate}%</span>
                </div>
                <div className="flex justify-between text-[9px] text-gray-400">
                    <span>KARMA</span>
                    <span className="text-cyan-400">{karmaScore}</span>
                </div>
            </div>
        </div>
    );
};

const BracketVisualizer: React.FC<{ bracketData: MonthlyDoubleEliminationBracket; isAdminMode?: boolean; onMatchClick?: (matchId: string) => void }> = ({ bracketData, isAdminMode, onMatchClick }) => {
    return (
        <div className="w-full bg-[#0D1117] border border-cyan-500/30 rounded-xl p-8 overflow-x-auto min-h-100 font-mono flex gap-12">
            {bracketData.winnersTree.rounds.map((round) => (
                <div key={round.roundId} className="flex flex-col justify-around gap-6">
                    <h4 className="text-center text-amber-400 text-[10px] font-bold">ROUND {round.roundNumber}</h4>
                    {round.matches.map((match) => {
                        const isClickable = isAdminMode ? true : match.status !== 'waiting';
                        return (
                            <div 
                                key={match.matchId} 
                                onClick={() => isClickable && onMatchClick?.(match.matchId)}
                                className={`w-48 rounded-lg border p-2 text-[10px] transition-all ${match.status === 'ready' ? 'border-cyan-400 bg-cyan-950/20' : 'border-gray-700 bg-gray-900/50'} ${isClickable ? 'cursor-pointer hover:border-cyan-300' : 'cursor-not-allowed opacity-60'}`}
                            >
                                <div className="flex justify-between pb-1">
                                    <span className={match.status === 'ready' ? 'text-white' : 'text-gray-500'}>{match.player1Id || 'TBD'}</span>
                                </div>
                                <div className="h-px w-full bg-gray-800 my-0.5" />
                                <div className="flex justify-between pt-1">
                                    <span className={match.status === 'ready' ? 'text-white' : 'text-gray-500'}>{match.player2Id || 'TBD'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// 4. MAIN PAGE
// ============================================================================

export default function MonthlyTournamentPage() {
    const [activeTab, setActiveTab] = useState<'double_elim' | 'circuit_rank' | 'season_info' | 'integrity_showcase' | 'rewards_store'>('double_elim');
    const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
    
    const [circuitRankings] = useState<CircuitPlayer[]>([
        { rank: 1, name: 'CyberShadow', circuitPoints: 260, winRate: 78.5, isQualified: true },
        { rank: 2, name: 'VortexSniper', circuitPoints: 220, winRate: 74.0, isQualified: true },
        { rank: 3, name: 'IronTide', circuitPoints: 185, winRate: 69.2, isQualified: true },
        { rank: 4, name: 'NeonHealer', circuitPoints: 155, winRate: 65.0, isQualified: true },
        { rank: 5, name: 'PhantomBlade', circuitPoints: 140, winRate: 62.1, isQualified: true },
        { rank: 6, name: 'StormStrike', circuitPoints: 125, winRate: 60.5, isQualified: true },
        { rank: 7, name: 'EchoBreaker', circuitPoints: 110, winRate: 58.0, isQualified: true },
        { rank: 8, name: 'Solaris', circuitPoints: 95, winRate: 55.4, isQualified: true },
    ]);

    const [walletBalance] = useState<number>(450);
    const [bracketData] = useState<MonthlyDoubleEliminationBracket>(() => generateMockBracketData());

    const teamA = MOCK_LOBBY_PARTICIPANTS.filter((p) => p.team === 'TEAM_A');
    const teamB = MOCK_LOBBY_PARTICIPANTS.filter((p) => p.team === 'TEAM_B');

    const handleMatchClick = (matchId: string) => {
        console.log('Clicked match ID:', matchId);
    };

    return (
        <div className="min-h-screen bg-[#090D14] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* 1. HEADER BANNER */}
                <div className="relative overflow-hidden bg-linear-to-r from-[#161B22] via-[#0D1117] to-[#1F242C] border border-amber-500/40 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                FEATURE-4300: MONTHLY CIRCUIT & FINALS
                            </span>
                            <h1 className="text-3xl font-black tracking-wide text-gray-100 mt-2">
                                MONTHLY CHAMPIONSHIP
                            </h1>
                            <p className="text-sm text-gray-400 mt-1 font-mono">
                                Circuit Points Top 16 • No Pay-to-Enter • Double Elimination Bracket
                            </p>
                        </div>

                        <div className="flex items-center gap-6 bg-[#0B0E14]/80 px-6 py-4 rounded-xl border border-gray-800">
                            <div className="text-right">
                                <div className="text-xs text-gray-400 font-mono">MONTHLY PRIZE POOL (40%)</div>
                                <div className="text-2xl font-black text-amber-400 font-mono">฿ 40,000</div>
                            </div>
                            <div className="border-l border-gray-700 pl-6 text-right">
                                <div className="text-xs text-gray-400 font-mono">SEASON PHASE</div>
                                <div className="text-lg font-black text-cyan-400 font-mono">WEEK 4 (FINALS)</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ADMIN MODE TOGGLE */}
                <div className="flex justify-end items-center">
                    <button
                        onClick={() => setIsAdminMode(!isAdminMode)}
                        className={`px-4 py-1.5 rounded-lg border font-['Orbitron'] text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer ${
                            isAdminMode
                                ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10 shadow-[0_0_10px_rgba(0,212,255,0.2)]'
                                : 'border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                    >
                        ADMIN MODE: {isAdminMode ? 'ACTIVE' : 'OFF'}
                    </button>
                </div>

                {/* 2. NAVIGATION TABS */}
                <div className="flex flex-wrap gap-4 border-b border-gray-800 pb-3">
                    <button 
                        onClick={() => setActiveTab('double_elim')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'double_elim' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(255,184,0,0.2)]' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        BRACKET VISUALIZER (PART 3)
                    </button>
                    <button 
                        onClick={() => setActiveTab('circuit_rank')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'circuit_rank' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        CIRCUIT RANKINGS
                    </button>
                    <button 
                        onClick={() => setActiveTab('integrity_showcase')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'integrity_showcase' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,212,255,0.2)]' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        INTEGRITY SHOWCASE (PART 1)
                    </button>
                    <button 
                        onClick={() => setActiveTab('rewards_store')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'rewards_store' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        REWARDS STORE (PART 2)
                    </button>
                    <button 
                        onClick={() => setActiveTab('season_info')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'season_info' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        RULES & KYC
                    </button>
                </div>

                {/* 3. TAB CONTENT VIEWS */}
                {activeTab === 'double_elim' && (
                    <div className="space-y-6">
                        <div className="bg-[#0D1117] border border-amber-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-amber-400 font-mono">
                            <span>*Interactive Data Tree from Part 3</span>
                        </div>
                        
                        {/* แก้ไขตาม QA: ส่ง isAdminMode และ onMatchClick ครบถ้วนแล้ว */}
                        {bracketData && (
                            <BracketVisualizer 
                                bracketData={bracketData} 
                                isAdminMode={isAdminMode}
                                onMatchClick={handleMatchClick}
                            />
                        )}
                        
                        <div className="bg-linear-to-b from-[#1C1F26] to-[#12151B] border-2 border-amber-400 rounded-xl p-6 text-center shadow-[0_0_25px_rgba(255,184,0,0.2)]">
                            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">GRAND FINAL (BO3 + BRACKET RESET RULE)</span>
                            <div className="text-xl font-black text-gray-100 mt-2">Upper Winner vs Lower Winner</div>
                            <div className="mt-4 inline-block text-xs font-bold text-black bg-amber-400 px-6 py-2 rounded-lg font-mono">CHAMPION PRIZE: ฿ 10,000 + HALL OF FAME ถาวร</div>
                        </div>
                    </div>
                )}

                {activeTab === 'integrity_showcase' && (
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 shadow-2xl font-mono">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                                <div className="border-b border-cyan-400/40 pb-2 text-cyan-400 font-bold text-sm">TEAM ALPHA (RADIANT)</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {teamA.map((player) => <IntegrityCard key={player.userId} {...player} />)}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="border-b border-amber-400/40 pb-2 text-amber-400 font-bold text-sm">TEAM OMEGA (DIRE)</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {teamB.map((player) => <IntegrityCard key={player.userId} {...player} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'rewards_store' && (
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 shadow-2xl font-mono space-y-6">
                        <div className="flex justify-between items-center bg-[#161B22] p-4 rounded-lg border border-amber-500/30">
                            <div className="text-gray-400 text-sm">CURRENT BALANCE</div>
                            <div className="text-2xl font-bold text-amber-400">{walletBalance} PTS</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {CATALOG_ITEMS.map((item) => (
                                <div key={item.itemId} className={`p-4 bg-[#161B22] rounded-lg border ${RARITY_COLORS[item.rarity]} flex flex-col justify-between`}>
                                    <div className="text-center mb-3">
                                        <div className="text-3xl mb-2">{item.icon}</div>
                                        <h3 className="text-sm font-bold text-white">{item.name}</h3>
                                        <span className="text-[9px] text-gray-400 tracking-widest">[{item.rarity}]</span>
                                    </div>
                                    <button className="mt-4 w-full py-2 bg-amber-500 text-black text-xs font-bold rounded hover:bg-amber-400 cursor-pointer">
                                        REDEEM ({item.costRewardPoints} PTS)
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'circuit_rank' && (
                    <div className="bg-[#0D1117] border border-gray-800 rounded-xl overflow-hidden shadow-xl font-mono">
                        <div className="p-5 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-sm font-bold tracking-wider uppercase text-gray-300">Top 16 Circuit Points Standings (Week 1-3)</h2>
                            <span className="text-xs text-emerald-400">QUALIFIED FOR MONTHLY FINAL</span>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#161B22] text-xs text-gray-400 uppercase border-b border-gray-800">
                                <tr>
                                    <th className="py-3 px-4">Rank</th>
                                    <th className="py-3 px-4">Player</th>
                                    <th className="py-3 px-4">Circuit Points (CP)</th>
                                    <th className="py-3 px-4">Weekly Win Rate</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                                {circuitRankings.map((p) => (
                                    <tr key={p.rank} className="hover:bg-[#161B22]/50">
                                        <td className="py-3.5 px-4 font-bold text-amber-400">#{p.rank}</td>
                                        <td className="py-3.5 px-4 font-bold text-gray-200">{p.name}</td>
                                        <td className="py-3.5 px-4 font-bold text-cyan-400">{p.circuitPoints} CP</td>
                                        <td className="py-3.5 px-4 text-emerald-400">{p.winRate}%</td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="text-[11px] px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
                                                QUALIFIED
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'season_info' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
                        <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-cyan-400 uppercase">Season Soft Reset Protocol</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                การแข่งขันจัดขึ้นในรูปแบบซีซั่นรอบละ 3 เดือน เมื่อสิ้นสุดซีซั่น คะแนน Season KP จะถูก Soft Reset ตามสูตรมาตรฐาน:
                            </p>
                            <div className="p-3 bg-[#161B22] rounded-lg border border-cyan-500/30 text-cyan-300 text-sm font-bold text-center">
                                KP_new = (KP_old × 0.5) + 1000
                            </div>
                        </div>
                        <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-amber-400 uppercase">KYC & Prize Payout Gateway</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                เงินรางวัลจากการแข่งขันทั้งหมดสามารถถอนผ่านระบบ PromptPay (TH) หรือ Bank Transfer โดยมีเงื่อนไขความปลอดภัย:
                            </p>
                            <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
                                <li>ต้องผ่านการยืนยันตัวตน KYC Gate ก่อนทำการเบิกเงินครั้งแรก</li>
                                <li>ระบบตัดรอบโอนเงินแบบ Batch รอบ 15:00 น. ทุกวันทำการ</li>
                            </ul>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}