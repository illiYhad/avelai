'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PlayerVerticalProfile } from '@/components/profile/PlayerVerticalProfile';

interface HubDataState {
  seasonOverview: {
    seasonName: string;
    totalPrizePoolThb: number;
    allocation: {
      daily: { percent: number; poolThb: number };
      weekly: { percent: number; poolThb: number };
      monthly: { percent: number; poolThb: number };
      seasonFinale: { percent: number; poolThb: number };
    };
  };
  userProfile: {
    userId: string;
    username: string;
    avatarUrl?: string;
    rankTitle: string;
    subTier: 'PRO_380' | 'FREE';
    gachaFrameUrl: string | null; // เว้น Slot รอรับจาก Genesis_Gacha
    tokens: number;
    tokenRateThb: number;
    cashBalanceThb: number;
    dailyTickets: number;
    isDailyLocked: boolean; // ติด Hard Lockout เพราะ Qualified ชนะ Daily แล้ว
    refundedTokensCount: number;
    circuitPoints: number;
    weeklyRank: number;
    seasonRank: number;
    hasWeeklyPass: boolean;
  };
  mercenaryArena: {
    roomCode: string;
    entryFeeTokens: number;
    potThb: number;
    filledSeats: number;
    maxSeats: number;
  };
}

export default function TournamentHubPage() {
  const [hubData, setHubData] = useState<HubDataState>({
    seasonOverview: {
      seasonName: 'Season Finale 2026',
      totalPrizePoolThb: 300000.0,
      allocation: {
        daily: { percent: 15, poolThb: 45000.0 },
        weekly: { percent: 25, poolThb: 75000.0 },
        monthly: { percent: 40, poolThb: 120000.0 },
        seasonFinale: { percent: 20, poolThb: 60000.0 },
      },
    },
    userProfile: {
      userId: 'usr_99812',
      username: 'ShadowKaiser',
      rankTitle: 'Elite Form Striker',
      subTier: 'PRO_380',
      gachaFrameUrl: null, // กำหนดเป็น null ไว้ เมื่อ Gacha เสร็จสามารถใส่ URL กรอบรูปได้ทันที
      tokens: 6, // ได้รับคืน 6 Tokens จาก Auto Buy-back
      tokenRateThb: 9.0,
      cashBalanceThb: 240.0,
      dailyTickets: 0,
      isDailyLocked: true, // ผ่านการคัดเลือกแล้ว
      refundedTokensCount: 6,
      circuitPoints: 1420,
      weeklyRank: 142,
      seasonRank: 88,
      hasWeeklyPass: true,
    },
    mercenaryArena: {
      roomCode: 'MERC-8841',
      entryFeeTokens: 1,
      potThb: 90.0,
      filledSeats: 7,
      maxSeats: 10,
    },
  });

  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const scrollToMercenary = () => {
    const section = document.getElementById('mercenary-section');
    section?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoinMercenary = () => {
    if (hubData.userProfile.tokens < hubData.mercenaryArena.entryFeeTokens) {
      alert('ยอด Token ไม่เพียงพอ (ต้องการ 1 Token)');
      return;
    }

    setIsActionLoading(true);
    setTimeout(() => {
      setHubData((prev) => ({
        ...prev,
        userProfile: {
          ...prev.userProfile,
          tokens: prev.userProfile.tokens - 1,
        },
        mercenaryArena: {
          ...prev.mercenaryArena,
          filledSeats: Math.min(prev.mercenaryArena.filledSeats + 1, 10),
        },
      }));
      setIsActionLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ===================================================================
            1. SEASON OVERVIEW BAR (15/25/40/20%)
        =================================================================== */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                Championship Prize Allocation
              </span>
              <h1 className="text-2xl font-black text-white tracking-wide">{hubData.seasonOverview.seasonName}</h1>
            </div>
            <div className="text-left md:text-right">
              <span className="text-xs text-slate-400">Total Prize Pool</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ฿{hubData.seasonOverview.totalPrizePoolThb.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
              <div style={{ width: '15%' }} className="bg-emerald-500 h-full" title="Daily: 15%" />
              <div style={{ width: '25%' }} className="bg-amber-500 h-full" title="Weekly: 25%" />
              <div style={{ width: '40%' }} className="bg-rose-500 h-full" title="Monthly: 40%" />
              <div style={{ width: '20%' }} className="bg-purple-600 h-full" title="Season Finale: 20%" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-400 pt-1 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Daily 15% (฿{hubData.seasonOverview.allocation.daily.poolThb.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Weekly 25% (฿{hubData.seasonOverview.allocation.weekly.poolThb.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Monthly 40% (฿{hubData.seasonOverview.allocation.monthly.poolThb.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-600" />
                <span>Season 20% (฿{hubData.seasonOverview.allocation.seasonFinale.poolThb.toLocaleString()})</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            2. MAIN HUB INTERACTION ZONE (Vertical Profile + Mercenary Arena)
        =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* ฝั่งซ้าย: Vertical Profile Card Slot (4 Columns บน Desktop) */}
          <div className="lg:col-span-4 flex">
            <PlayerVerticalProfile
              userId={hubData.userProfile.userId}
              username={hubData.userProfile.username}
              rankTitle={hubData.userProfile.rankTitle}
              subTier={hubData.userProfile.subTier}
              gachaFrameUrl={hubData.userProfile.gachaFrameUrl}
              circuitPoints={hubData.userProfile.circuitPoints}
              tokens={hubData.userProfile.tokens}
              cashBalanceThb={hubData.userProfile.cashBalanceThb}
            />
          </div>

          {/* ฝั่งขวา: Status Summary & Mercenary Arena (8 Columns บน Desktop) */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-6">

            {/* Status Indicator Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs font-mono uppercase text-slate-400 font-bold">Cascade Progression</span>
                <h3 className="text-base font-bold text-white mt-0.5">สถานะการคัดเลือกลีกประจำสัปดาห์</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                  {hubData.userProfile.hasWeeklyPass ? '✓ QUALIFIED (WEEKLY PASS ACTIVE)' : 'UNQUALIFIED'}
                </span>
              </div>
            </div>

            {/* FEATURE-4160: Mercenary Arena */}
            <div
              id="mercenary-section"
              className="bg-linear-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between flex-1 scroll-mt-6"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                        FEATURE-4160
                      </span>
                      <span className="text-xs font-semibold text-amber-400">10-Man Winner-Takes-All</span>
                    </div>
                    <h2 className="text-xl font-bold mt-1 text-white">Mercenary Arena</h2>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      ลานประลอง Token ด่วนสำหรับผู้เล่นทั่วไปและผู้ชนะ Qualified • ชนะที่ 1 รับ Pot 90฿ Direct Credit โอนเข้า Cash Wallet ทันที
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono">Prize Pot</div>
                    <div className="text-xl font-black text-amber-400 font-mono">฿{hubData.mercenaryArena.potThb.toFixed(2)}</div>
                  </div>
                </div>

                {/* Progress Bar Queue */}
                <div className="mt-6 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold font-mono">
                    <span className="text-slate-400">ห้อง: {hubData.mercenaryArena.roomCode}</span>
                    <span className="text-indigo-400">
                      {hubData.mercenaryArena.filledSeats} / {hubData.mercenaryArena.maxSeats} ที่นั่ง
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-linear-to-r from-indigo-500 to-amber-500 transition-all duration-300"
                      style={{
                        width: `${(hubData.mercenaryArena.filledSeats / hubData.mercenaryArena.maxSeats) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                <button
                  disabled={isActionLoading || hubData.mercenaryArena.filledSeats >= 10}
                  onClick={handleJoinMercenary}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 font-mono"
                >
                  {isActionLoading ? 'กำลังเข้าห้อง...' : 'ลงทะเบียนด่วน (1 Token / 9฿)'}
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* ===================================================================
            3. CASCADE TOURNAMENT 4 TIERS
        =================================================================== */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* TIER 1: DAILY ARENA */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between ${hubData.userProfile.isDailyLocked
              ? 'bg-slate-900/90 border-amber-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                  TIER 1
                </span>
                <span className="text-xs text-amber-400 font-semibold font-mono">15% Pool</span>
              </div>

              <h3 className="font-bold text-base text-white">Daily Arena</h3>
              <div className="text-xs text-slate-400 mt-1">Form Score 1-20 & KP Scoring</div>

              <div className="mt-4 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Prize Pool:</span>
                  <span className="font-bold text-emerald-400">
                    ฿{hubData.seasonOverview.allocation.daily.poolThb.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">ผู้เข้าร่วม:</span>
                  <span className="font-semibold text-slate-300">1,240 คน</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">สถานะผู้เล่น:</span>
                  <span className={`font-semibold ${hubData.userProfile.isDailyLocked ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {hubData.userProfile.isDailyLocked ? 'Qualified (Locked)' : 'พร้อมลงแข่ง'}
                  </span>
                </div>
              </div>

              {hubData.userProfile.isDailyLocked && (
                <p className="text-[11px] text-amber-400/90 mt-3 leading-relaxed">
                  ✓ ได้รับ Weekly Pass แล้ว ระบบซื้อตั๋วคืนอัตโนมัติ <strong>+{hubData.userProfile.refundedTokensCount} Tokens ({hubData.userProfile.refundedTokensCount * 9}฿)</strong> เข้า Wallet เรียบร้อย
                </p>
              )}
            </div>

            <div className="mt-5">
              {hubData.userProfile.isDailyLocked ? (
                <button
                  onClick={scrollToMercenary}
                  className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] font-mono"
                >
                  <span>🔒 QUALIFIED (LOCKED)</span>
                  <span className="text-[10px] text-slate-400 font-normal">→ ไป Mercenary</span>
                </button>
              ) : (
                <Link
                  href="/tournament/daily"
                  className="w-full inline-flex items-center justify-center py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs transition-all shadow-md active:scale-[0.98] font-mono"
                >
                  ENTER DAILY ARENA
                </Link>
              )}
            </div>
          </div>

          {/* TIER 2: WEEKLY */}
          <div className="rounded-2xl border p-5 flex flex-col justify-between bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                  TIER 2
                </span>
                <span className="text-xs text-amber-400 font-semibold font-mono">25% Pool</span>
              </div>

              <h3 className="font-bold text-base text-white">Weekly Tournament</h3>
              <div className="text-xs text-slate-400 mt-1">Swiss System Pairings</div>

              <div className="mt-4 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Prize Pool:</span>
                  <span className="font-bold text-emerald-400">
                    ฿{hubData.seasonOverview.allocation.weekly.poolThb.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">ผู้เข้าร่วม:</span>
                  <span className="font-semibold text-slate-300">256 คน</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">เริ่มใน:</span>
                  <span className="font-semibold text-slate-300">5 วัน 12 ชม.</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <Link
                href="/tournament/weekly"
                className="w-full inline-flex items-center justify-center py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs transition-all shadow-md active:scale-[0.98] font-mono"
              >
                ENTER WEEKLY
              </Link>
            </div>
          </div>

          {/* TIER 3: MONTHLY */}
          <div className="rounded-2xl border p-5 flex flex-col justify-between bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                  TIER 3
                </span>
                <span className="text-xs text-amber-400 font-semibold font-mono">40% Pool</span>
              </div>

              <h3 className="font-bold text-base text-white">Monthly Championship</h3>
              <div className="text-xs text-slate-400 mt-1">Top Rankers Cutoff</div>

              <div className="mt-4 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Prize Pool:</span>
                  <span className="font-bold text-emerald-400">
                    ฿{hubData.seasonOverview.allocation.monthly.poolThb.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">ผู้เข้าร่วม:</span>
                  <span className="font-semibold text-slate-300">64 คน</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">เริ่มใน:</span>
                  <span className="font-semibold text-slate-300">18 วัน</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <Link
                href="/tournament/monthly"
                className="w-full inline-flex items-center justify-center py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs transition-all shadow-md active:scale-[0.98] font-mono"
              >
                ENTER MONTHLY
              </Link>
            </div>
          </div>

          {/* TIER 4: SEASON FINALE (PHASE 4.3) */}
          <div className="rounded-2xl border p-5 flex flex-col justify-between bg-slate-950/60 border-slate-800/60 opacity-60">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/40 text-purple-400 border border-purple-800/40 font-mono">
                  PHASE 4.3
                </span>
                <span className="text-xs text-amber-400 font-semibold font-mono">20% Grand Pool</span>
              </div>

              <h3 className="font-bold text-base text-white">TOURNAMENT OF THE YEAR</h3>
              <div className="text-xs text-slate-400 mt-1">Season Finale Leaderboard</div>

              <div className="mt-4 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Prize Pool:</span>
                  <span className="font-bold text-emerald-400">
                    ฿{hubData.seasonOverview.allocation.seasonFinale.poolThb.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">ผู้เข้าร่วม:</span>
                  <span className="font-semibold text-slate-300">-</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">สถานะ:</span>
                  <span className="font-semibold text-purple-400">Coming Phase 4.3</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button
                disabled
                className="w-full py-2.5 rounded-xl bg-slate-800/50 text-slate-500 font-bold text-xs cursor-not-allowed border border-slate-800 font-mono"
              >
                Coming Phase 4.3
              </button>
            </div>
          </div>

        </section>

      </div>
    </div>
  );
}