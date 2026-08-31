'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Shield, 
  Flame, 
  Zap, 
  ArrowLeft,
  Coins
} from 'lucide-react';
import { IntegrityCard, IntegrityRarity, PlayerPosition } from '@/components/showcase/IntegrityCard';


// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export interface TierProfile {
  tierCode?: string;
  formLevel?: number;
}

export interface LobbyPlayer {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  assignedPosition?: number;
  card_rarity?: string;
  tierProfile?: TierProfile;
  karmaScore?: number;
  winRate?: number;
  currentElo?: number;
}

export interface LobbyFormation {
  teamA?: LobbyPlayer[];
  teamB?: LobbyPlayer[];
}

export interface LobbyData {
  id: string;
  status?: string;
  formation?: LobbyFormation;
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

const CATALOG_ITEMS: StoreItem[] = [
  { itemId: 'TICKET_GASHA_GENESIS', name: 'Genesis Gasha Ticket', description: 'สุ่มการ์ด Match Integrity Card ระดับ Rare - Legendary', category: 'TICKETS', costRewardPoints: 100, stockRemaining: 999, rarity: 'RARE', icon: '🎟️', badge: 'HOT' },
  { itemId: 'PACK_BOOSTER_CARD_01', name: 'Alpha Cyber Booster Pack', description: 'การ์ดบูสเตอร์เสริมพลัง + ชิ้นส่วนการ์ด 3 ชิ้น', category: 'BOOSTERS', costRewardPoints: 250, stockRemaining: 45, rarity: 'EPIC', icon: '📦', badge: 'LIMITED' },
  { itemId: 'MAT_CYBER_ALLOY_01', name: 'Cyber Alloy Shard (x10)', description: 'ชิ้นส่วนอัลลอยสำหรับคราฟต์กรอบ Avatar', category: 'MATERIALS', costRewardPoints: 50, stockRemaining: 200, rarity: 'COMMON', icon: '🔩' },
];

// ============================================================================
// 2. MAIN PAGE
// ============================================================================

interface PageProps {
  params: Promise<{
    lobbyId: string;
  }>;
}

export default function WaitingRoomPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const lobbyId = resolvedParams.lobbyId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobbyData, setLobbyData] = useState<LobbyData | null>(null);
  const [activeTab, setActiveTab] = useState<'lobby' | 'store'>('lobby');

  useEffect(() => {
    const supabase = createClient();

    async function fetchLobby() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('daily_arena_lobbies')
          .select('*')
          .eq('id', lobbyId)
          .maybeSingle();

        if (fetchError || !data) {
          setLobbyData({
            id: lobbyId,
            status: 'ROSTERS_LOCKED',
            formation: {
              teamA: [
                { userId: 'u-1', displayName: '23savage_AFI', assignedPosition: 1, currentElo: 2350, winRate: 68, card_rarity: 'LEGENDARY' },
                { userId: 'u-2', displayName: 'Mikoto_God', assignedPosition: 2, currentElo: 2280, winRate: 64, card_rarity: 'EPIC' },
                { userId: 'u-3', displayName: 'Jabz_322', assignedPosition: 3, currentElo: 2190, winRate: 61, card_rarity: 'COMMON' },
                { userId: 'u-4', displayName: 'Q_Supp', assignedPosition: 4, currentElo: 2110, winRate: 59, card_rarity: 'EPIC' },
                { userId: 'u-5', displayName: 'Whitemon_V2', assignedPosition: 5, currentElo: 2090, winRate: 58, card_rarity: 'NONE' },
              ],
              teamB: [
                { userId: 'u-6', displayName: 'Devil-llou', assignedPosition: 1, currentElo: 2310, winRate: 66, card_rarity: 'LEGENDARY' },
                { userId: 'u-7', displayName: 'Cyber_Phantom', assignedPosition: 2, currentElo: 2240, winRate: 63, card_rarity: 'EPIC' },
                { userId: 'u-8', displayName: 'Neon_Viper', assignedPosition: 3, currentElo: 2170, winRate: 60, card_rarity: 'COMMON' },
                { userId: 'u-9', displayName: 'TIMS_Soft', assignedPosition: 4, currentElo: 2160, winRate: 62, card_rarity: 'EPIC' },
                { userId: 'u-10', displayName: 'Jaunuel_Ward', assignedPosition: 5, currentElo: 2070, winRate: 56, card_rarity: 'COMMON' },
              ],
            }
          });
        } else {
          setLobbyData(data as LobbyData);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load lobby';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    if (lobbyId) fetchLobby();
  }, [lobbyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090E] text-[#00D4FF] flex flex-col items-center justify-center font-mono space-y-4">
        <span className="w-10 h-10 rounded-full border-2 border-[#00D4FF] border-t-transparent animate-spin" />
        <p className="tracking-widest uppercase text-xs animate-pulse">Syncing Cyber Holo-Deck Protocol...</p>
      </div>
    );
  }

  if (error && !lobbyData) {
    return (
      <div className="min-h-screen bg-[#07090E] text-rose-400 flex flex-col items-center justify-center font-mono space-y-4">
        <p className="tracking-widest uppercase font-bold text-xs">⚠️ Connection Error: {error}</p>
        <button onClick={() => router.push('/dashboard')} className="px-6 py-2 border border-rose-500/50 hover:bg-rose-500/10 text-white rounded-lg text-xs tracking-widest uppercase transition-all">
          ← Return to Dashboard
        </button>
      </div>
    );
  }

  const formation = lobbyData?.formation || {};
  const teamA = formation.teamA || [];
  const teamB = formation.teamB || [];

  return (
    <div className="min-h-screen bg-[#07090E] text-white pt-24 pb-12 px-4 md:px-8 flex flex-col justify-between font-mono selection:bg-[#00D4FF] selection:text-black">
      <div className="absolute inset-0 bg-[radial-gradient(#00D4FF_1px,transparent_1px)] bg-size-[28px_28px] opacity-10 pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto space-y-6 z-10">
        
        {/* TOP HEADER */}
        <header className="flex flex-col md:flex-row items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00D4FF] animate-ping" />
              <span className="text-[#00D4FF] text-xs tracking-widest uppercase font-bold">CYBER HOLO-DECK 1.2</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white mt-1">
              10-MAN INTEGRITY SHOWCASE
            </h1>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-950 border border-[#C9A84C]/40 px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(201,168,76,0.15)]">
            <div className="text-right">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest">LOBBY ID</div>
              <div className="text-[#C9A84C] font-black text-base tracking-widest">{lobbyId}</div>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div className="text-left">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest">PROTOCOL</div>
              <div className="text-emerald-400 font-bold text-xs tracking-wider uppercase">ALL CARDS READY</div>
            </div>
          </div>
        </header>

        {/* Tab Selector */}
        <div className="flex gap-3 border-b border-slate-800 pb-2">
          <button 
            onClick={() => setActiveTab('lobby')} 
            className={`px-4 py-2 text-xs font-bold tracking-widest rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'lobby' ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            VERSUS SHOWCASE (5v5)
          </button>
          <button 
            onClick={() => setActiveTab('store')} 
            className={`px-4 py-2 text-xs font-bold tracking-widest rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'store' ? 'bg-[#C9A84C]/20 text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            REWARDS STORE
          </button>
        </div>

        {/* MAIN BODY */}
        {activeTab === 'lobby' ? (
          <main className="space-y-6">
            
            {/* TEAM RADIANT */}
            <section className="bg-slate-950/80 border border-[#00D4FF]/40 p-5 rounded-2xl shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
                <h2 className="text-[#00D4FF] font-black text-sm tracking-widest flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00D4FF]"/> TEAM RADIANT (ORIGIN C1)
                </h2>
                <span className="text-xs text-zinc-400">STATUS: <b className="text-white">5/5 DECK LOCKED</b></span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 justify-items-center">
                {teamA.map((player: LobbyPlayer, idx: number) => (
                  <IntegrityCard
                    key={player.userId || idx}
                    userId={player.userId}
                    displayName={player.displayName ?? `Operator_${idx + 1}`}
                    avatarUrl={player.avatarUrl}
                    rarity={((player.card_rarity as IntegrityRarity) ?? 'NONE')}
                    position={((player.assignedPosition || idx + 1) as PlayerPosition)}
                    team="TEAM_A"
                    karmaScore={player.karmaScore}
                    winRate={player.winRate}
                    isCurrentUser={idx === 4}
                  />
                ))}
              </div>
            </section>

            {/* VS Divider */}
            <div className="flex items-center justify-center gap-4 my-2">
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-[#00D4FF]/40 to-transparent" />
              <div className="w-11 h-11 rounded-full border-2 border-[#C9A84C] bg-slate-950 flex items-center justify-center font-black text-sm text-[#C9A84C] shadow-[0_0_20px_rgba(201,168,76,0.4)] animate-pulse">
                VS
              </div>
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-[#C9A84C]/40 to-transparent" />
            </div>

            {/* TEAM DIRE */}
            <section className="bg-slate-950/80 border border-[#C9A84C]/40 p-5 rounded-2xl shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#C9A84C]/20 pb-2">
                <h2 className="text-[#C9A84C] font-black text-sm tracking-widest flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#C9A84C]"/> TEAM DIRE (ORIGIN C4)
                </h2>
                <span className="text-xs text-zinc-400">STATUS: <b className="text-white">5/5 DECK LOCKED</b></span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 justify-items-center">
                {teamB.map((player: LobbyPlayer, idx: number) => (
                  <IntegrityCard
                    key={player.userId || idx}
                    userId={player.userId}
                    displayName={player.displayName ?? `Operator_${idx + 6}`}
                    avatarUrl={player.avatarUrl}
                    rarity={((player.card_rarity as IntegrityRarity) ?? 'NONE')}
                    position={((player.assignedPosition || idx + 1) as PlayerPosition)}
                    team="TEAM_B"
                    karmaScore={player.karmaScore}
                    winRate={player.winRate}
                  />
                ))}
              </div>
            </section>
          </main>
        ) : (
          <main className="bg-slate-950 border border-[#C9A84C]/30 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-[#C9A84C]/30">
              <div className="text-zinc-400 text-xs">AVAILABLE BALANCE</div>
              <div className="text-2xl font-black text-[#C9A84C] flex items-center gap-2">
                <Coins className="w-6 h-6"/> 450 PTS
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATALOG_ITEMS.map((item) => (
                <div key={item.itemId} className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div className="text-center mb-3">
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <h3 className="text-sm font-bold text-white">{item.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1">{item.description}</p>
                  </div>
                  <button className="mt-4 w-full py-2.5 bg-[#C9A84C] text-slate-950 text-xs font-black rounded-lg hover:bg-amber-400 transition-colors cursor-pointer">
                    REDEEM ({item.costRewardPoints} PTS)
                  </button>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* FOOTER */}
        <footer className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 pt-5 gap-4">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-zinc-400 hover:text-white rounded-xl transition-all text-xs tracking-widest uppercase font-bold flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5"/> ABORT TO DASHBOARD
          </button>

          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-400">
              ROSTERS: <b className="text-[#00D4FF]">10/10 READY</b>
            </span>
            <button 
              onClick={() => router.push(`/match/${lobbyId || 'match_01'}`)}
              className="px-8 py-3 bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-slate-950 font-black text-xs tracking-widest uppercase rounded-xl shadow-[0_0_25px_rgba(0,212,255,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current"/> INITIALIZE MATCH
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}