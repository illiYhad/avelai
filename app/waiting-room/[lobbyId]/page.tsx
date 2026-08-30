/* eslint-disable @next/next/no-img-element */
'use client';

import React, { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export interface TierProfile {
    tierCode?: string;
    formLevel?: number;
}

export interface LobbyPlayer {
    userId: string;
    assignedPosition?: number;
    card_rarity?: string;
    tierProfile?: TierProfile;
}

export interface LobbyFormation {
    teamA?: LobbyPlayer[];
    teamB?: LobbyPlayer[];
    averageFormLevelTeamA?: string | number;
    averageFormLevelTeamB?: string | number;
}

export interface LobbyData {
    id: string;
    status?: string;
    formation?: LobbyFormation;
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

const ROLE_COLORS: Record<PlayerPosition, string> = { 
    1: '#E8384F', 
    2: '#2E9BFF', 
    3: '#39FF6A', 
    4: '#D63CE8', 
    5: '#C8CDD4' 
};

const ROLE_NAMES: Record<PlayerPosition, string> = { 
    1: 'POS 1 · CARRY', 
    2: 'POS 2 · MID', 
    3: 'POS 3 · OFF', 
    4: 'POS 4 · SOFT', 
    5: 'POS 5 · HARD' 
};

const CATALOG_ITEMS: StoreItem[] = [
    { itemId: 'TICKET_GASHA_GENESIS', name: 'Genesis Gasha Ticket', description: 'สุ่มการ์ด Match Integrity Card ระดับ Rare - Legendary', category: 'TICKETS', costRewardPoints: 100, stockRemaining: 999, rarity: 'RARE', icon: '🎟️', badge: 'HOT' },
    { itemId: 'PACK_BOOSTER_CARD_01', name: 'Alpha Cyber Booster Pack', description: 'การ์ดบูสเตอร์เสริมพลัง + ชิ้นส่วนการ์ด 3 ชิ้น', category: 'BOOSTERS', costRewardPoints: 250, stockRemaining: 45, rarity: 'EPIC', icon: '📦', badge: 'LIMITED' },
    { itemId: 'MAT_CYBER_ALLOY_01', name: 'Cyber Alloy Shard (x10)', description: 'ชิ้นส่วนอัลลอยสำหรับคราฟต์กรอบ Avatar', category: 'MATERIALS', costRewardPoints: 50, stockRemaining: 200, rarity: 'COMMON', icon: '🔩' },
];

const RARITY_COLORS: Record<string, string> = {
    COMMON: 'border-gray-700 text-gray-300', 
    UNCOMMON: 'border-[#39FF6A]/60 text-[#39FF6A]', 
    RARE: 'border-[#2E9BFF]/70 text-[#2E9BFF]', 
    EPIC: 'border-[#D63CE8]/70 text-[#D63CE8]', 
    LEGENDARY: 'border-[#C9A84C] text-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.3)]',
};

function generateMockBracketData(): MonthlyDoubleEliminationBracket {
    const wbR1Matches: BracketMatch[] = Array.from({ length: 4 }, (_, i) => ({
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
    const wbR2Matches: BracketMatch[] = Array.from({ length: 2 }, (_, i) => ({
        matchId: `WB_R2_M${i + 1}`, 
        roundNumber: 2, 
        seed1: null, 
        seed2: null, 
        winnerAdvancesTo: `WB_R3_M1`, 
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

const IntegrityCard: React.FC<IntegrityCardProps> = ({ 
    displayName, 
    avatarUrl, 
    rarity, 
    position, 
    team, 
    karmaScore = 100, 
    winRate = 50.0, 
    isCurrentUser = false 
}) => {
    const roleColor = ROLE_COLORS[position] || ROLE_COLORS[1];
    const teamBorder = team === 'TEAM_A' ? '#00D4FF' : '#C9A84C';

    if (rarity === 'NONE') {
        return (
            <div className="relative w-full max-w-52.5 h-85 rounded-xl border border-dashed border-gray-700/80 bg-[#0A0A0F]/80 p-4 flex flex-col justify-between items-center text-center">
                <div className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border" style={{ borderColor: `${roleColor}55`, color: roleColor, backgroundColor: `${roleColor}15` }}>
                    {ROLE_NAMES[position]}
                </div>
                <div className="flex flex-col items-center my-auto">
                    <div className="w-16 h-16 rounded-full border border-gray-700 bg-gray-900/60 flex items-center justify-center text-gray-500 font-bold mb-2 overflow-hidden">
                        {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-300 truncate max-w-35">{displayName}</span>
                    <span className="text-[10px] text-gray-600 font-mono mt-0.5">UNPROTECTED</span>
                </div>
                <div className="w-full pt-2 border-t border-gray-800/80">
                    <button className={`w-full py-2 text-[10px] font-black rounded tracking-wider ${isCurrentUser ? 'bg-linear-to-r from-[#00D4FF] to-[#C9A84C] text-[#0A0A0F] shadow-[0_0_15px_rgba(0,212,255,0.4)]' : 'bg-gray-800 text-gray-400'}`}>
                        GET INTEGRITY CARD
                    </button>
                </div>
            </div>
        );
    }

    const isLegendary = rarity === 'LEGENDARY';
    const isEpic = rarity === 'EPIC';

    return (
        <div className={`relative w-full max-w-52.5 h-85 rounded-xl bg-[#0A0A0F] p-3 flex flex-col justify-between overflow-hidden transition-all hover:scale-105 border-2 ${isLegendary ? 'border-[#00D4FF] shadow-[0_0_25px_rgba(0,212,255,0.5)]' : isEpic ? 'border-[#C9A84C]' : 'border-gray-500'}`}>
            <div className="relative z-10 flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: `${roleColor}88`, color: roleColor, backgroundColor: `${roleColor}18` }}>
                    {ROLE_NAMES[position]}
                </span>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${isLegendary ? 'bg-[#00D4FF] text-[#0A0A0F]' : isEpic ? 'bg-[#C9A84C] text-[#0A0A0F]' : 'bg-gray-400 text-[#0A0A0F]'}`}>
                    {rarity}
                </span>
            </div>
            <div className="relative z-10 w-full h-38.75 my-1.5 rounded-lg border border-gray-800 bg-gray-950 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full border-2 mb-1.5 overflow-hidden flex items-center justify-center bg-gray-900" style={{ borderColor: teamBorder }}>
                    {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" /> : <span className="font-bold text-white text-lg">{displayName.slice(0, 2).toUpperCase()}</span>}
                </div>
                <span className="text-[10px] font-mono text-gray-400">AVE GUARDIAN</span>
            </div>
            <div className="relative z-10 pt-1.5 border-t border-gray-800/80 font-mono">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white truncate max-w-27.5">{displayName}</span>
                    <span className="text-[10px] text-[#39FF6A] font-bold">{winRate.toFixed(1)}% WR</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-gray-400">
                    <span>KARMA INDEX</span>
                    <span className="text-[#00D4FF] font-bold">{karmaScore} PTS</span>
                </div>
            </div>
        </div>
    );
};

const BracketVisualizer: React.FC<{ bracketData: MonthlyDoubleEliminationBracket }> = ({ bracketData }) => {
    return (
        <div className="w-full bg-[#0B0F17] border border-[#00D4FF]/20 rounded-xl overflow-hidden font-mono text-white flex flex-col relative p-6 min-h-100">
            <div className="flex gap-12 overflow-x-auto pb-6">
                {bracketData.winnersTree.rounds.map((round) => (
                    <div key={round.roundId} className="flex flex-col justify-around gap-6 relative">
                        <h4 className="text-center text-[#C9A84C] text-[10px] font-bold tracking-widest uppercase">ROUND {round.roundNumber}</h4>
                        {round.matches.map((match) => (
                            <div key={match.matchId} className={`w-48 rounded-lg border p-2 text-[10px] ${match.status === 'ready' ? 'border-[#00D4FF] bg-[#0A0A0F] shadow-[0_0_15px_rgba(0,212,255,0.3)]' : 'border-gray-700 bg-gray-900/50'}`}>
                                <div className="flex justify-between pb-1">
                                    <span className={match.status === 'ready' ? 'text-white font-bold' : 'text-gray-500'}>{match.player1Id || 'TBD'}</span>
                                </div>
                                <div className="h-px w-full bg-gray-800 my-0.5" />
                                <div className="flex justify-between pt-1">
                                    <span className={match.status === 'ready' ? 'text-white font-bold' : 'text-gray-500'}>{match.player2Id || 'TBD'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// 4. MAIN PAGE
// ============================================================================

interface PageProps {
    params: Promise<{
        lobbyId: string;
    }>;
}

export default function WaitingRoomPage({ params }: PageProps) {
    const resolvedParams = use(params);
    const lobbyId = resolvedParams.lobbyId;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lobbyData, setLobbyData] = useState<LobbyData | null>(null);

    const [activeTab, setActiveTab] = useState<'lobby' | 'store' | 'bracket'>('lobby');
    const [walletBalance] = useState<number>(450);
    const [bracketData] = useState<MonthlyDoubleEliminationBracket>(() => generateMockBracketData());

    useEffect(() => {
        const supabase = createClient();

        async function fetchLobby() {
            try {
                setLoading(true);
                const { data, error: fetchError } = await supabase
                    .from('daily_arena_lobbies')
                    .select('*')
                    .eq('id', lobbyId)
                    .single();

                if (fetchError || !data) {
                    throw new Error('Lobby not found or expired');
                }

                setLobbyData(data as LobbyData);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to load lobby';
                setError(message);
            } finally {
                setLoading(false);
            }
        }

        if (lobbyId) fetchLobby();

        const channel = supabase
            .channel(`lobby-${lobbyId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'daily_arena_lobbies', filter: `id=eq.${lobbyId}` },
                (payload) => setLobbyData(payload.new as LobbyData)
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [lobbyId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07090E] text-[#00D4FF] flex flex-col items-center justify-center font-mono space-y-4">
                <span className="w-8 h-8 rounded-full border-2 border-[#00D4FF] border-t-transparent animate-spin" />
                <p className="tracking-widest uppercase text-sm animate-pulse">Syncing Cyber Holo-Deck Protocol...</p>
            </div>
        );
    }

    if (error || !lobbyData) {
        return (
            <div className="min-h-screen bg-[#07090E] text-rose-400 flex flex-col items-center justify-center font-mono space-y-4">
                <p className="tracking-widest uppercase font-bold">⚠️ Connection Error: {error}</p>
                <button onClick={() => window.history.back()} className="px-6 py-2 border border-rose-500/50 hover:bg-rose-500/10 text-white rounded-lg text-xs tracking-widest uppercase transition-all">
                    ← Return to Arena
                </button>
            </div>
        );
    }

    const formation = lobbyData.formation || {};
    const teamA = formation.teamA || [];
    const teamB = formation.teamB || [];
    const avgLevelA = formation.averageFormLevelTeamA ?? (teamA.length > 0 ? (teamA.reduce((acc: number, p: LobbyPlayer) => acc + (p.tierProfile?.formLevel || 10), 0) / teamA.length).toFixed(1) : 0);
    const avgLevelB = formation.averageFormLevelTeamB ?? (teamB.length > 0 ? (teamB.reduce((acc: number, p: LobbyPlayer) => acc + (p.tierProfile?.formLevel || 10), 0) / teamB.length).toFixed(1) : 0);

    return (
        <div className="min-h-screen bg-[#07090E] text-white pt-24 pb-12 p-4 md:p-8 flex flex-col justify-between font-mono selection:bg-[#00D4FF] selection:text-black">
            <div className="absolute inset-0 bg-[radial-gradient(#00D4FF_1px,transparent_1px)] bg-size-[28px_28px] opacity-10 pointer-events-none" />

            <div className="w-full max-w-7xl mx-auto space-y-8 z-10">
                {/* ----------------- ORIGINAL HEADER ----------------- */}
                <header className="flex flex-col md:flex-row items-center justify-between border-b border-[#00D4FF]/20 pb-4 gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
                            <span className="text-[#00D4FF] text-xs tracking-widest uppercase font-bold">AVELAi PROTOCOL ACTIVE</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white mt-1">CYBER HOLO-DECK 1.2</h1>
                    </div>
                    <div className="flex items-center gap-4 bg-[#0B0F17] border border-[#C9A84C]/40 px-5 py-2 rounded-lg shadow-[0_0_15px_rgba(201,168,76,0.15)]">
                        <div className="text-right">
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest">LOBBY ID</div>
                            <div className="text-[#C9A84C] font-black text-lg tracking-widest">{lobbyId}</div>
                        </div>
                        <div className="h-8 w-px bg-gray-800" />
                        <div className="text-left">
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest">MATCH STATUS</div>
                            <div className="text-white font-bold text-sm tracking-wider uppercase">{lobbyData.status || 'READY'}</div>
                        </div>
                    </div>
                </header>

                {/* ----------------- TAB NAVIGATION ----------------- */}
                <div className="flex flex-wrap gap-3 border-b border-gray-800 pb-2">
                    <button onClick={() => setActiveTab('lobby')} className={`px-4 py-2 text-xs font-bold tracking-widest rounded-t-lg transition-colors cursor-pointer ${activeTab === 'lobby' ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-gray-500 hover:text-gray-300'}`}>
                        MATCH LOBBY (SHOWCASE)
                    </button>
                    <button onClick={() => setActiveTab('store')} className={`px-4 py-2 text-xs font-bold tracking-widest rounded-t-lg transition-colors cursor-pointer ${activeTab === 'store' ? 'bg-[#C9A84C]/20 text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-gray-500 hover:text-gray-300'}`}>
                        REWARDS STORE
                    </button>
                    <button onClick={() => setActiveTab('bracket')} className={`px-4 py-2 text-xs font-bold tracking-widest rounded-t-lg transition-colors cursor-pointer ${activeTab === 'bracket' ? 'bg-rose-500/20 text-rose-400 border-b-2 border-rose-500' : 'text-gray-500 hover:text-gray-300'}`}>
                        BRACKET VISUALIZER
                    </button>
                </div>

                <main className="space-y-6">
                    {/* ----------------- TAB 1: INTEGRITY SHOWCASE & MATCH LOBBY ----------------- */}
                    {activeTab === 'lobby' && (
                        <div className="space-y-6">
                            <section className="bg-[#0B0F17]/80 border border-[#00D4FF]/30 p-4 rounded-xl shadow-xl space-y-3">
                                <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
                                    <h2 className="text-[#00D4FF] font-black text-sm tracking-widest flex items-center gap-2">
                                        <span>◈</span> TEAM RADIANT (TEAM A)
                                    </h2>
                                    <span className="text-xs text-gray-400">AVG FORM: <b className="text-white">{avgLevelA}</b></span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 justify-items-center">
                                    {teamA.map((player: LobbyPlayer, idx: number) => {
                                        const rarityMap: Record<string, IntegrityRarity> = { 'CYBER_HOLO': 'LEGENDARY', 'RARE': 'EPIC', 'COMMON': 'COMMON' };
                                        const mappedRarity = (player.card_rarity && rarityMap[player.card_rarity]) ? rarityMap[player.card_rarity] : 'NONE';
                                        return (
                                            <IntegrityCard 
                                                key={player.userId || idx} 
                                                userId={player.userId} 
                                                displayName={player.userId?.slice(0, 10) || `P${idx + 1}`} 
                                                rarity={mappedRarity} 
                                                position={(player.assignedPosition || idx + 1) as PlayerPosition} 
                                                team="TEAM_A" 
                                                karmaScore={(player.tierProfile?.formLevel || 10) * 100} 
                                                winRate={55.0} 
                                            />
                                        );
                                    })}
                                </div>
                            </section>

                            <div className="flex items-center justify-center gap-4">
                                <div className="flex-1 h-px bg-linear-to-r from-transparent via-[#00D4FF]/40 to-transparent" />
                                <div className="w-10 h-10 rounded-full border border-[#C9A84C] bg-[#0B0F17] flex items-center justify-center font-black text-sm text-[#C9A84C] shadow-[0_0_15px_rgba(201,168,76,0.3)]">
                                    VS
                                </div>
                                <div className="flex-1 h-px bg-linear-to-r from-transparent via-[#C9A84C]/40 to-transparent" />
                            </div>

                            <section className="bg-[#0B0F17]/80 border border-[#C9A84C]/30 p-4 rounded-xl shadow-xl space-y-3">
                                <div className="flex items-center justify-between border-b border-[#C9A84C]/20 pb-2">
                                    <h2 className="text-[#C9A84C] font-black text-sm tracking-widest flex items-center gap-2">
                                        <span>◈</span> TEAM DIRE (TEAM B)
                                    </h2>
                                    <span className="text-xs text-gray-400">AVG FORM: <b className="text-white">{avgLevelB}</b></span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 justify-items-center">
                                    {teamB.map((player: LobbyPlayer, idx: number) => {
                                        const rarityMap: Record<string, IntegrityRarity> = { 'CYBER_HOLO': 'LEGENDARY', 'RARE': 'EPIC', 'COMMON': 'COMMON' };
                                        const mappedRarity = (player.card_rarity && rarityMap[player.card_rarity]) ? rarityMap[player.card_rarity] : 'NONE';
                                        return (
                                            <IntegrityCard 
                                                key={player.userId || idx} 
                                                userId={player.userId} 
                                                displayName={player.userId?.slice(0, 10) || `P${idx + 1}`} 
                                                rarity={mappedRarity} 
                                                position={(player.assignedPosition || idx + 1) as PlayerPosition} 
                                                team="TEAM_B" 
                                                karmaScore={(player.tierProfile?.formLevel || 10) * 100} 
                                                winRate={50.5} 
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* ----------------- TAB 2: REWARDS STORE ----------------- */}
                    {activeTab === 'store' && (
                        <div className="bg-[#0B0F17] border border-[#C9A84C]/30 rounded-xl p-6 shadow-2xl font-mono space-y-6">
                            <div className="flex justify-between items-center bg-[#12121A] p-4 rounded-lg border border-[#C9A84C]/30">
                                <div className="text-gray-400 text-sm">CURRENT BALANCE</div>
                                <div className="text-2xl font-bold text-[#C9A84C]">{walletBalance} PTS</div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {CATALOG_ITEMS.map((item) => (
                                    <div key={item.itemId} className={`p-4 bg-[#12121A] rounded-lg border ${RARITY_COLORS[item.rarity]} flex flex-col justify-between`}>
                                        <div className="text-center mb-3">
                                            <div className="text-3xl mb-2">{item.icon}</div>
                                            <h3 className="text-sm font-bold text-white">{item.name}</h3>
                                            <span className="text-[9px] text-gray-400 tracking-widest">[{item.rarity}]</span>
                                        </div>
                                        <button className="mt-4 w-full py-2 bg-[#C9A84C] text-black text-xs font-bold rounded hover:bg-[#C9A84C]/80 transition-colors cursor-pointer">
                                            REDEEM ({item.costRewardPoints} PTS)
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ----------------- TAB 3: BRACKET VISUALIZER ----------------- */}
                    {activeTab === 'bracket' && (
                        <div className="space-y-6">
                            <div className="bg-[#0B0F17] border border-rose-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-rose-400 font-mono">
                                <span>*Interactive Tournament Bracket Preview</span>
                            </div>
                            {bracketData && <BracketVisualizer bracketData={bracketData} />}
                        </div>
                    )}
                </main>

                {/* ----------------- ORIGINAL FOOTER ----------------- */}
                <footer className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-800 pt-4 gap-4">
                    <button onClick={() => window.history.back()} className="px-6 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg transition-all text-xs tracking-widest uppercase font-bold cursor-pointer">
                        ← ABORT & RETURN
                    </button>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">
                            STATUS: <b className="text-[#00D4FF]">ROSTERS LOCKED ({teamA.length + teamB.length}/10)</b>
                        </span>
                        <button className="px-8 py-3 bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-black text-xs tracking-widest uppercase rounded-lg shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all hover:scale-105 active:scale-95 cursor-pointer">
                            INITIALIZE MATCH
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}