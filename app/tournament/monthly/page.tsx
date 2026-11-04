/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import HudScan from '@/components/ui/HudScan'
import { SampleChip } from '@/components/tournament/TournamentHub'

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
    COMMON: 'border-line text-ink',
    UNCOMMON: 'border-[#39FF6A]/60 text-[#39FF6A]',
    RARE: 'border-[#2E9BFF]/70 text-[#2E9BFF]',
    EPIC: 'border-[#D63CE8]/70 text-[#D63CE8]',
    LEGENDARY: 'border-gold text-gold shadow-glow-gold',
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
    const teamBorder = team === 'TEAM_A' ? 'var(--color-cyan)' : 'var(--color-gold)';

    if (rarity === 'NONE') {
        return (
            <div className="relative w-full max-w-50 h-80 rounded-xl border border-dashed border-line bg-panel/80 p-4 flex flex-col justify-between items-center text-center">
                <div className="text-xs font-mono font-bold px-2 py-0.5 rounded border" style={{ borderColor: `${roleColor}55`, color: roleColor, backgroundColor: `${roleColor}15` }}>
                    {ROLE_NAMES[position]}
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full border border-line bg-surface-2 flex items-center justify-center text-ink-muted font-bold mb-2 overflow-hidden">
                        {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-mono font-bold text-ink">{displayName}</span>
                </div>
                <div className="w-full pt-2 border-t border-line">
                    {isCurrentUser ? <button className="w-full py-1.5 bg-gold text-void text-xs font-bold rounded">GET CARD</button> : <span className="text-xs text-ink-muted/60">UNPROTECTED</span>}
                </div>
            </div>
        );
    }
    return (
        <div className={`relative w-full max-w-50 h-80 rounded-xl bg-panel p-3 flex flex-col justify-between border ${rarity === 'LEGENDARY' ? 'border-cyan shadow-glow-cyan' : rarity === 'EPIC' ? 'border-gold' : 'border-ink-muted'}`}>
            <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: `${roleColor}88`, color: roleColor }}>{ROLE_NAMES[position]}</span>
                <span className={`text-xs font-black px-1.5 py-0.5 rounded ${rarity === 'LEGENDARY' ? 'bg-cyan text-void' : 'bg-ink-muted text-void'}`}>{rarity}</span>
            </div>
            <div className="relative z-10 w-full h-35 my-1.5 rounded-lg border border-line bg-surface-2 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full border-2 mb-1 flex items-center justify-center text-ink overflow-hidden" style={{ borderColor: teamBorder }}>
                    {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" /> : displayName.slice(0, 2).toUpperCase()}
                </div>
            </div>
            <div className="relative z-10 pt-1.5 border-t border-line font-mono">
                <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-ink truncate">{displayName}</span>
                    <span className="text-xs text-emerald-400">{winRate}%</span>
                </div>
                <div className="flex justify-between text-xs text-ink-muted">
                    <span>KARMA</span>
                    <span className="text-cyan">{karmaScore}</span>
                </div>
            </div>
        </div>
    );
};

const BracketVisualizer: React.FC<{ bracketData: MonthlyDoubleEliminationBracket; isAdminMode?: boolean; onMatchClick?: (matchId: string) => void }> = ({ bracketData, isAdminMode, onMatchClick }) => {
    return (
        <div className="w-full hud-panel rounded-xl p-8 overflow-x-auto min-h-100 font-mono flex gap-12">
            {bracketData.winnersTree.rounds.map((round) => (
                <div key={round.roundId} className="flex flex-col justify-around gap-6">
                    <h4 className="text-center text-gold text-xs font-bold">ROUND {round.roundNumber}</h4>
                    {round.matches.map((match) => {
                        const isClickable = isAdminMode ? true : match.status !== 'waiting';
                        return (
                            <div 
                                key={match.matchId} 
                                onClick={() => isClickable && onMatchClick?.(match.matchId)}
                                className={`w-48 rounded-lg border p-2 text-xs transition-all ${match.status === 'ready' ? 'border-cyan bg-cyan/10' : 'border-line bg-surface-2'} ${isClickable ? 'cursor-pointer hover:border-cyan' : 'cursor-not-allowed opacity-60'}`}
                            >
                                <div className="flex justify-between pb-1">
                                    <span className={match.status === 'ready' ? 'text-ink' : 'text-ink-muted'}>{match.player1Id || 'TBD'}</span>
                                </div>
                                <div className="h-px w-full bg-surface-2 my-0.5" />
                                <div className="flex justify-between pt-1">
                                    <span className={match.status === 'ready' ? 'text-ink' : 'text-ink-muted'}>{match.player2Id || 'TBD'}</span>
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
    // K-AV-UX4b: เอาปุ่มสลับโหมดแอดมินออกจากหน้าผู้เล่น — ปิดโหมดแอดมินเสมอ
    const isAdminMode = false;
    
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

    const handleMatchClick = (_matchId: string) => {
        // ข้อมูลตัวอย่าง: ยังไม่มีหน้าแมตช์ให้เปิด (K-AV-POLISH เอา console.log ออก)
    };

    return (
        <div className="min-h-screen text-ink p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* 1. HEADER BANNER */}
                <div className="hud-panel hud-panel-gold hud-hero relative overflow-hidden rounded-2xl p-6 md:p-8">
                    {/* K-AV-UX4: พาเนล HUD (ทอง · เอียงเล็กน้อยบนจอใหญ่ · แสงสแกน) แทนกล่อง slate เรียบ */}
                    <HudScan />
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="hud-title text-3xl text-ink">
                                MONTHLY CHAMPIONSHIP
                            </h1>
                            <p className="text-sm text-ink-muted mt-1 font-mono">
                                Circuit Points Top 16 • No Pay-to-Enter • Double Elimination Bracket
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 bg-void/80 px-6 py-4 rounded-xl border border-line">
                            <SampleChip />
                            <div className="text-right">
                                <div className="text-xs text-ink-muted font-mono">MONTHLY PRIZE POOL (40%)</div>
                                <div className="text-2xl font-black text-gold font-mono">฿ 40,000</div>
                            </div>
                            <div className="border-l border-line pl-6 text-right">
                                <div className="text-xs text-ink-muted font-mono">SEASON PHASE</div>
                                <div className="text-lg font-black text-cyan font-mono">WEEK 4 (FINALS)</div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* 2. NAVIGATION TABS */}
                <div className="flex flex-wrap gap-4 border-b border-line pb-3">
                    <button 
                        onClick={() => setActiveTab('double_elim')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'double_elim' ? 'bg-gold/20 text-gold border border-gold/40 shadow-glow-gold' : 'text-ink-muted hover:text-ink'}`}
                    >
                        BRACKET VISUALIZER
                    </button>
                    <button 
                        onClick={() => setActiveTab('circuit_rank')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'circuit_rank' ? 'bg-gold/20 text-gold border border-gold/40' : 'text-ink-muted hover:text-ink'}`}
                    >
                        CIRCUIT RANKINGS
                    </button>
                    <button 
                        onClick={() => setActiveTab('integrity_showcase')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'integrity_showcase' ? 'bg-cyan/20 text-cyan border border-cyan/40 shadow-glow-cyan' : 'text-ink-muted hover:text-ink'}`}
                    >
                        INTEGRITY SHOWCASE
                    </button>
                    <button 
                        onClick={() => setActiveTab('rewards_store')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'rewards_store' ? 'bg-gold/20 text-gold border border-gold/40' : 'text-ink-muted hover:text-ink'}`}
                    >
                        REWARDS STORE
                    </button>
                    <button 
                        onClick={() => setActiveTab('season_info')} 
                        className={`px-5 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${activeTab === 'season_info' ? 'bg-gold/20 text-gold border border-gold/40' : 'text-ink-muted hover:text-ink'}`}
                    >
                        RULES & KYC
                    </button>
                </div>

                {/* 3. TAB CONTENT VIEWS */}
                {activeTab === 'double_elim' && (
                    <div className="space-y-6">
                        <SampleChip />
                        
                        {/* แก้ไขตาม QA: ส่ง isAdminMode และ onMatchClick ครบถ้วนแล้ว */}
                        {bracketData && (
                            <BracketVisualizer 
                                bracketData={bracketData} 
                                isAdminMode={isAdminMode}
                                onMatchClick={handleMatchClick}
                            />
                        )}
                        
                        <div className="hud-panel hud-panel-gold ci-corners rounded-xl p-6 text-center flex flex-col items-center gap-2">
                            <SampleChip />
                            <span className="text-xs font-mono uppercase tracking-widest text-gold font-bold">GRAND FINAL (BO3 + BRACKET RESET RULE)</span>
                            <div className="text-xl font-black text-ink mt-2">Upper Winner vs Lower Winner</div>
                            <div className="mt-4 inline-block text-xs font-bold text-void bg-gold px-6 py-2 rounded-lg font-mono">CHAMPION PRIZE: ฿ 10,000 + HALL OF FAME ถาวร</div>
                        </div>
                    </div>
                )}

                {activeTab === 'integrity_showcase' && (
                    <div className="hud-panel ci-corners rounded-xl p-6 font-mono space-y-4">
                        <SampleChip />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                                <div className="border-b border-cyan/40 pb-2 text-cyan font-bold text-sm">TEAM ALPHA (RADIANT)</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {teamA.map((player) => <IntegrityCard key={player.userId} {...player} />)}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="border-b border-gold/40 pb-2 text-gold font-bold text-sm">TEAM OMEGA (DIRE)</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {teamB.map((player) => <IntegrityCard key={player.userId} {...player} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'rewards_store' && (
                    <div className="hud-panel ci-corners rounded-xl p-6 font-mono space-y-6">
                        <SampleChip />
                        <div className="flex justify-between items-center bg-surface-2 p-4 rounded-lg border border-gold/30">
                            <div className="text-ink-muted text-sm">CURRENT BALANCE</div>
                            <div className="text-2xl font-bold text-gold">{walletBalance} PTS</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {CATALOG_ITEMS.map((item) => (
                                <div key={item.itemId} className={`p-4 bg-surface-2 rounded-lg border ${RARITY_COLORS[item.rarity]} flex flex-col justify-between`}>
                                    <div className="text-center mb-3">
                                        <div className="text-3xl mb-2">{item.icon}</div>
                                        <h3 className="text-sm font-bold text-ink">{item.name}</h3>
                                        <span className="text-xs text-ink-muted tracking-widest">[{item.rarity}]</span>
                                    </div>
                                    <button className="mt-4 w-full py-2 bg-gold text-void text-xs font-bold rounded hover:bg-gold-hover cursor-pointer">
                                        REDEEM ({item.costRewardPoints} PTS)
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'circuit_rank' && (
                    <div className="hud-panel rounded-xl overflow-hidden font-mono">
                        <div className="p-5 border-b border-line flex justify-between items-center">
                            <h2 className="text-sm font-bold tracking-wider uppercase text-ink flex flex-wrap items-center gap-2">Top 16 Circuit Points Standings (Week 1-3) <SampleChip /></h2>
                            <span className="text-xs text-emerald-400">QUALIFIED FOR MONTHLY FINAL</span>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-2 text-xs text-ink-muted uppercase border-b border-line">
                                <tr>
                                    <th className="py-3 px-4">Rank</th>
                                    <th className="py-3 px-4">Player</th>
                                    <th className="py-3 px-4">Circuit Points (CP)</th>
                                    <th className="py-3 px-4">Weekly Win Rate</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {circuitRankings.map((p) => (
                                    <tr key={p.rank} className="hover:bg-surface-2/50">
                                        <td className="py-3.5 px-4 font-bold text-gold">#{p.rank}</td>
                                        <td className="py-3.5 px-4 font-bold text-ink">{p.name}</td>
                                        <td className="py-3.5 px-4 font-bold text-cyan">{p.circuitPoints} CP</td>
                                        <td className="py-3.5 px-4 text-emerald-400">{p.winRate}%</td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="text-xs px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
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
                        <div className="hud-panel rounded-xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-cyan uppercase">Season Soft Reset Protocol</h3>
                            <p className="text-xs text-ink-muted leading-relaxed">
                                การแข่งขันจัดขึ้นในรูปแบบซีซั่นรอบละ 3 เดือน เมื่อสิ้นสุดซีซั่น คะแนน Season KP จะถูก Soft Reset ตามสูตรมาตรฐาน:
                            </p>
                            <div className="p-3 bg-surface-2 rounded-lg border border-cyan/30 text-cyan text-sm font-bold text-center">
                                KP_new = (KP_old × 0.5) + 1000
                            </div>
                        </div>
                        <div className="hud-panel rounded-xl p-6 space-y-4">
                            <h3 className="text-sm font-bold text-gold uppercase">KYC & Prize Payout Gateway</h3>
                            <p className="text-xs text-ink-muted leading-relaxed">
                                เงินรางวัลจากการแข่งขันทั้งหมดสามารถถอนผ่านระบบ PromptPay (TH) หรือ Bank Transfer โดยมีเงื่อนไขความปลอดภัย:
                            </p>
                            <ul className="text-xs text-ink space-y-2 list-disc pl-4">
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