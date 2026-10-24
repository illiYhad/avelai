'use client';

import React, { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Flame, Clock, CheckCircle, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';

interface PlayerTelemetry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  position: 1 | 2 | 3 | 4 | 5;
  team: 'TEAM_A' | 'TEAM_B';
  stats: {
    kills: number;
    deaths: number;
    assists: number;
    kp: number;
    towerDmgShare: number;
    visionScore: number;
    apm: number;
  };
}

interface PageProps {
  params: Promise<{
    matchid: string;
  }>;
}

const MOCK_PARTICIPANTS: PlayerTelemetry[] = [
  // TEAM A (Ally)
  { userId: 'u-1', displayName: '23savage_AFI', position: 1, team: 'TEAM_A', stats: { kills: 14, deaths: 2, assists: 10, kp: 78, towerDmgShare: 45, visionScore: 32, apm: 295 } },
  { userId: 'u-2', displayName: 'Mikoto_God', position: 2, team: 'TEAM_A', stats: { kills: 9, deaths: 3, assists: 12, kp: 68, towerDmgShare: 25, visionScore: 28, apm: 310 } },
  { userId: 'u-3', displayName: 'Jabz_322', position: 3, team: 'TEAM_A', stats: { kills: 4, deaths: 4, assists: 18, kp: 71, towerDmgShare: 18, visionScore: 45, apm: 240 } },
  { userId: 'u-4', displayName: 'Q_Supp', position: 4, team: 'TEAM_A', stats: { kills: 2, deaths: 5, assists: 22, kp: 77, towerDmgShare: 8, visionScore: 88, apm: 215 } },
  { userId: 'u-current', displayName: 'You (Whitemon)', position: 5, team: 'TEAM_A', stats: { kills: 1, deaths: 6, assists: 24, kp: 80, towerDmgShare: 4, visionScore: 110, apm: 190 } },
  
  // TEAM B (Opponents)
  { userId: 'u-6', displayName: 'Devil-llou', position: 1, team: 'TEAM_B', stats: { kills: 11, deaths: 5, assists: 4, kp: 62, towerDmgShare: 35, visionScore: 25, apm: 280 } },
  { userId: 'u-7', displayName: 'Cyber_Phantom', position: 2, team: 'TEAM_B', stats: { kills: 6, deaths: 7, assists: 6, kp: 50, towerDmgShare: 20, visionScore: 30, apm: 290 } },
  { userId: 'u-8', displayName: 'Neon_Viper', position: 3, team: 'TEAM_B', stats: { kills: 3, deaths: 8, assists: 8, kp: 45, towerDmgShare: 15, visionScore: 40, apm: 220 } },
  { userId: 'u-9', displayName: 'TIMS_Soft', position: 4, team: 'TEAM_B', stats: { kills: 2, deaths: 6, assists: 11, kp: 54, towerDmgShare: 10, visionScore: 75, apm: 230 } },
  { userId: 'u-10', displayName: 'Jaunuel_Ward', position: 5, team: 'TEAM_B', stats: { kills: 0, deaths: 9, assists: 9, kp: 37, towerDmgShare: 5, visionScore: 85, apm: 185 } },
];

export default function MatchResultPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const matchid = resolvedParams.matchid;

  const currentUserId = 'u-current';
  const [countdown, setCountdown] = useState<number>(30);

  // Voting State: Map<playerId, score>
  const [allyVotes, setAllyVotes] = useState<Record<string, number>>({});
  const [opponentVotes, setOpponentVotes] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [votingCompleted, setVotingCompleted] = useState<boolean>(false);

  const allies = MOCK_PARTICIPANTS.filter(p => p.team === 'TEAM_A' && p.userId !== currentUserId);
  const opponents = MOCK_PARTICIPANTS.filter(p => p.team === 'TEAM_B');

  // Countdown timer for Voting Gate
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle vote with Toggle & Bijective Selection
  const handleVoteChange = (type: 'ALLY' | 'OPPONENT', targetId: string, score: number) => {
    if (type === 'ALLY') {
      setAllyVotes(prev => {
        if (prev[targetId] === score) {
          const updated = { ...prev };
          delete updated[targetId];
          return updated;
        }
        return { ...prev, [targetId]: score };
      });
    } else {
      setOpponentVotes(prev => {
        if (prev[targetId] === score) {
          const updated = { ...prev };
          delete updated[targetId];
          return updated;
        }
        return { ...prev, [targetId]: score };
      });
    }
  };

  // Bijective Validation Check
  const allyScores = Object.values(allyVotes);
  const isAllyComplete = allies.length === 4 && allyScores.length === 4 && [5, 4, 3, 2].every(s => allyScores.includes(s));

  const opponentScores = Object.values(opponentVotes);
  const isOpponentComplete = opponents.length === 5 && opponentScores.length === 5 && [5, 4, 3, 2, 1].every(s => opponentScores.includes(s));

  const isFormValid = isAllyComplete && isOpponentComplete;

  const handleSubmitVotes = async () => {
    if (!isFormValid || submitting) return;
    try {
      setSubmitting(true);
      const payload = {
        match_id: matchid,
        session_id: `session_${matchid}`,
        voter_id: currentUserId,
        ally_votes: Object.entries(allyVotes).map(([player_id, score]) => ({ player_id, score })),
        opponent_votes: Object.entries(opponentVotes).map(([player_id, score]) => ({ player_id, score })),
      };

      const res = await fetch('/api/v1/match/settlement/submit-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setVotingCompleted(true);
      }
    } catch (err) {
      console.error('Failed to submit votes', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090E] text-[#E0E0E0] p-4 md:p-8 font-mono">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* HEADER: MATCH RESULT BANNER */}
        <header className="border border-[#00D4FF]/30 bg-[#0A0A12] p-6 rounded-2xl shadow-[0_0_30px_rgba(0,212,255,0.1)] flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">VICTORY SETTLED</span>
            </div>
            <h1 className="font-['Orbitron'] text-2xl md:text-3xl font-black text-white tracking-wider">
              MATCH RESULT #{matchid}
            </h1>
            <p className="text-zinc-400 text-xs mt-1">Behavior Forced-Ranking & Mandatory Voting Gate</p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl">
            <Clock className="w-5 h-5 text-[#C9A84C]" />
            <div>
              <div className="text-[9px] text-zinc-500 uppercase font-bold">VOTING GATE</div>
              <div className={`text-base font-black tracking-widest ${countdown > 0 ? 'text-[#C9A84C] animate-pulse' : 'text-emerald-400'}`}>
                {countdown > 0 ? `00:${countdown.toString().padStart(2, '0')}` : 'GATE OPEN'}
              </div>
            </div>
          </div>
        </header>

        {/* SECTION 1: ALLY TEAM VOTING */}
        <section className="bg-slate-950 border border-[#00D4FF]/30 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="text-sm font-black text-[#00D4FF] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#00D4FF]" /> RATE ALLY PERFORMANCE (REQUIRED: 5, 4, 3, 2)
            </h2>
            <span className="text-xs font-bold text-zinc-400">
              STATUS: {isAllyComplete ? <b className="text-emerald-400">COMPLETE</b> : <b className="text-rose-400">INCOMPLETE ({4 - Object.keys(allyVotes).length} LEFT)</b>}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allies.map(player => (
              <div key={player.userId} className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white truncate max-w-30">{player.displayName}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-[#00D4FF] font-bold">POS {player.position}</span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[9px] bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-zinc-500">KDA / KP:</span>
                  <span className="text-right text-zinc-300 font-bold">{player.stats.kills}/{player.stats.deaths}/{player.stats.assists} ({player.stats.kp}%)</span>
                  <span className="text-zinc-500">VISION SCORE:</span>
                  <span className="text-right text-[#00D4FF] font-bold">{player.stats.visionScore} PTS</span>
                  <span className="text-zinc-500">TOWER DMG SHARE:</span>
                  <span className="text-right text-emerald-400 font-bold">{player.stats.towerDmgShare}%</span>
                </div>

                {/* Rank Selector 5, 4, 3, 2 */}
                <div className="flex gap-1.5 justify-center">
                  {[5, 4, 3, 2].map(score => {
                    const isSelected = allyVotes[player.userId] === score;
                    const isTakenByOther = Object.entries(allyVotes).some(
                      ([pId, s]) => pId !== player.userId && s === score
                    );

                    return (
                      <button
                        key={score}
                        onClick={() => handleVoteChange('ALLY', player.userId, score)}
                        disabled={votingCompleted || (!isSelected && isTakenByOther)}
                        className={`flex-1 py-1.5 text-xs font-black rounded border transition-all ${
                          isSelected
                            ? 'bg-[#00D4FF] text-slate-950 border-[#00D4FF] shadow-[0_0_12px_rgba(0,212,255,0.5)] scale-105 z-10 cursor-pointer'
                            : isTakenByOther
                            ? 'bg-slate-950/40 border-slate-900 text-zinc-700 cursor-not-allowed opacity-30 line-through'
                            : 'bg-slate-950 border-slate-700 text-zinc-400 hover:border-[#00D4FF]/50 hover:text-white cursor-pointer'
                        }`}
                        title={isTakenByOther ? 'Score already assigned to another ally' : ''}
                      >
                        {score}★
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: OPPONENT TEAM VOTING */}
        <section className="bg-slate-950 border border-[#C9A84C]/30 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="text-sm font-black text-[#C9A84C] flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#C9A84C]" /> RATE OPPONENT RESPECT (REQUIRED: 5, 4, 3, 2, 1)
            </h2>
            <span className="text-xs font-bold text-zinc-400">
              STATUS: {isOpponentComplete ? <b className="text-emerald-400">COMPLETE</b> : <b className="text-rose-400">INCOMPLETE ({5 - Object.keys(opponentVotes).length} LEFT)</b>}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {opponents.map(player => (
              <div key={player.userId} className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white truncate max-w-25">{player.displayName}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-[#C9A84C] font-bold">POS {player.position}</span>
                </div>

                <div className="text-[8px] bg-slate-950 p-1.5 rounded border border-slate-800 space-y-0.5">
                  <div className="flex justify-between text-zinc-400">
                    <span>KDA:</span> <span className="text-white font-bold">{player.stats.kills}/{player.stats.deaths}/{player.stats.assists}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>APM:</span> <span className="text-[#C9A84C] font-bold">{player.stats.apm}</span>
                  </div>
                </div>

                {/* Rank Selector 5, 4, 3, 2, 1 */}
                <div className="flex gap-1 justify-center">
                  {[5, 4, 3, 2, 1].map(score => {
                    const isSelected = opponentVotes[player.userId] === score;
                    const isTakenByOther = Object.entries(opponentVotes).some(
                      ([pId, s]) => pId !== player.userId && s === score
                    );

                    return (
                      <button
                        key={score}
                        onClick={() => handleVoteChange('OPPONENT', player.userId, score)}
                        disabled={votingCompleted || (!isSelected && isTakenByOther)}
                        className={`flex-1 py-1 text-[10px] font-black rounded border transition-all ${
                          isSelected
                            ? 'bg-[#C9A84C] text-slate-950 border-[#C9A84C] shadow-[0_0_12px_rgba(201,168,76,0.5)] scale-105 z-10 cursor-pointer'
                            : isTakenByOther
                            ? 'bg-slate-950/40 border-slate-900 text-zinc-700 cursor-not-allowed opacity-30 line-through'
                            : 'bg-slate-950 border-slate-700 text-zinc-400 hover:border-[#C9A84C]/50 hover:text-white cursor-pointer'
                        }`}
                        title={isTakenByOther ? 'Score already assigned to another opponent' : ''}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SUBMIT & EXIT CONTROLS */}
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-zinc-400">
            {!isFormValid ? (
              <span className="text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Please assign all available unique scores to every player.
              </span>
            ) : votingCompleted ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Votes recorded. MVP Settlement finalized!
              </span>
            ) : (
              <span className="text-[#00D4FF] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Rating criteria satisfied. Ready to submit.
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!votingCompleted ? (
              <button
                onClick={handleSubmitVotes}
                disabled={!isFormValid || submitting}
                className={`px-8 py-3 rounded-xl font-['Orbitron'] text-xs font-black uppercase tracking-widest transition-all ${
                  isFormValid && !submitting
                    ? 'bg-linear-to-r from-[#00D4FF] to-[#C9A84C] text-slate-950 hover:brightness-110 shadow-[0_0_20px_rgba(0,212,255,0.4)] cursor-pointer'
                    : 'bg-slate-800 text-zinc-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                {submitting ? 'RECORDING VOTES...' : 'SUBMIT MANDATORY VOTES'}
              </button>
            ) : (
              <Link
                href={`/match/${matchid}`}
                className="inline-flex items-center gap-2 px-8 py-3 bg-[#00D4FF] text-slate-950 rounded-xl font-['Orbitron'] text-xs font-black uppercase tracking-widest hover:bg-[#00D4FF]/80 shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all"
              >
                <span>FULL INTEL — MATCH DETAIL</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}