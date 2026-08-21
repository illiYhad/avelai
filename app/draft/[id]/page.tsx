'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { generateSnakeDraftOrder } from '@/lib/draft/snakeDraftEngine';

interface Player {
    id: string;
    name: string;
    role: string;
    performanceScore: number;
}

export default function DraftBoardPage() {
    // ดึง sessionId ผ่าน useParams hook (รองรับ Next.js เวอร์ชันใหม่)
    const params = useParams();
    const sessionId = Array.isArray(params.id) ? params.id[0] : params.id || 'SESSION-DEFAULT';

    // กัปตัน 4 คน (Captain 1 -> 4)
    const [captains] = useState<Player[]>([
        { id: 'c1', name: 'Captain 1 (Top Seed)', role: 'Core', performanceScore: 5.0 },
        { id: 'c2', name: 'Captain 2', role: 'Mid', performanceScore: 4.2 },
        { id: 'c3', name: 'Captain 3', role: 'Offlane', performanceScore: 3.8 },
        { id: 'c4', name: 'Captain 4 (Last Seed)', role: 'Support', performanceScore: 3.2 },
    ]);

    // พูลผู้เล่นที่รอการดราฟต์
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([
        { id: 'p1', name: 'Player Alpha', role: 'Pos 1', performanceScore: 4.0 },
        { id: 'p2', name: 'Player Beta', role: 'Pos 2', performanceScore: 3.9 },
        { id: 'p3', name: 'Player Gamma', role: 'Pos 3', performanceScore: 3.5 },
        { id: 'p4', name: 'Player Delta', role: 'Pos 4', performanceScore: 3.1 },
    ]);

    const [draftOrder] = useState<string[]>(() =>
        generateSnakeDraftOrder(captains.map((c) => c.id), 1)
    );
    const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
    const [teamAssignments, setTeamAssignments] = useState<{ [captainId: string]: Player[] }>({
        c1: [],
        c2: [],
        c3: [],
        c4: [],
    });

    const currentCaptainId = draftOrder[currentTurnIdx];
    const isDraftFinished = currentTurnIdx >= draftOrder.length || availablePlayers.length === 0;

    // ฟังก์ชันเลือกผู้เล่นเข้าทีม
    const handleSelectPlayer = (player: Player) => {
        if (isDraftFinished) return;

        setTeamAssignments((prev) => ({
            ...prev,
            [currentCaptainId]: [...prev[currentCaptainId], player],
        }));

        setAvailablePlayers((prev) => prev.filter((p) => p.id !== player.id));
        setCurrentTurnIdx((prev) => prev + 1);
    };

    // Trigger ส่งต่อ Webhook ไปหา Steam Bot ทันทีเมื่อดราฟต์เสร็จ
    useEffect(() => {
        if (isDraftFinished && draftOrder.length > 0) {
            console.log('Draft Finalized! Triggering Webhook to Steam Bot...');

            const payload = {
                draftRoomId: sessionId,
                radiantCaptainId: captains[0].id,
                direCaptainId: captains[1].id,
                radiantPlayers: [
                    { id: captains[0].id, steamId64: '76561198000000001', name: captains[0].name },
                    ...teamAssignments[captains[0].id].map((p) => ({
                        id: p.id,
                        steamId64: '76561198000000002',
                        name: p.name,
                    })),
                ],
                direPlayers: [
                    { id: captains[1].id, steamId64: '76561198000000003', name: captains[1].name },
                    ...teamAssignments[captains[1].id].map((p) => ({
                        id: p.id,
                        steamId64: '76561198000000004',
                        name: p.name,
                    })),
                ],
            };

            fetch('/api/draft/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
                .then((res) => res.json())
                .then((data) => {
                    console.log('[Steam Bot API Response]:', data);
                })
                .catch((err) => console.error('Failed to trigger Steam Bot:', err));
        }
    }, [isDraftFinished, sessionId]);

    return (
        <div className="min-h-screen bg-[#090D14] text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header Bar */}
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-wider text-amber-400">
                            MODULE 02.1: SNAKE DRAFT BOARD
                        </h1>
                        <p className="text-xs text-gray-400 font-mono mt-1">SESSION ID: {sessionId}</p>
                    </div>
                    <div className="px-4 py-2 bg-[#161B22] border border-gray-700 rounded-lg text-sm font-mono">
                        {isDraftFinished ? (
                            <span className="text-emerald-400 font-bold">READY FOR STEAM BOT</span>
                        ) : (
                            <span>
                                CURRENT TURN:{' '}
                                <strong className="text-cyan-400 font-bold">
                                    {captains.find((c) => c.id === currentCaptainId)?.name}
                                </strong>
                            </span>
                        )}
                    </div>
                </div>

                {/* กัปตันและทีมที่เลือก */}
                <div className="grid grid-cols-4 gap-4">
                    {captains.map((cap) => {
                        const isTurn = cap.id === currentCaptainId && !isDraftFinished;
                        return (
                            <div
                                key={cap.id}
                                className={`p-4 rounded-xl border transition-all ${isTurn
                                        ? 'border-amber-400 bg-amber-950/20 shadow-[0_0_15px_rgba(255,184,0,0.2)]'
                                        : 'border-gray-800 bg-[#0D1117]'
                                    }`}
                            >
                                <div className="text-xs font-mono text-gray-400">{cap.role}</div>
                                <div className="font-bold text-gray-200 mt-1">{cap.name}</div>
                                <div className="text-xs text-cyan-400 font-mono mt-0.5">
                                    Form: {cap.performanceScore.toFixed(2)}
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-800/80">
                                    <div className="text-[11px] font-mono text-gray-500 uppercase">Drafted Players:</div>
                                    <div className="mt-2 space-y-1">
                                        {teamAssignments[cap.id].map((p) => (
                                            <div
                                                key={p.id}
                                                className="text-xs bg-[#161B22] px-2 py-1 rounded border border-gray-700 font-mono text-gray-300"
                                            >
                                                {p.name} ({p.role})
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* พูลผู้เล่นที่รอเลือก */}
                <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-6">
                    <h2 className="text-sm font-mono uppercase tracking-wider text-gray-400 mb-4">
                        Available Players Pool ({availablePlayers.length})
                    </h2>
                    <div className="grid grid-cols-4 gap-4">
                        {availablePlayers.map((player) => (
                            <button
                                key={player.id}
                                disabled={isDraftFinished}
                                onClick={() => handleSelectPlayer(player)}
                                className="text-left p-4 bg-[#161B22] hover:border-cyan-500 border border-gray-800 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                            >
                                <div className="font-bold text-sm text-gray-200">{player.name}</div>
                                <div className="text-xs text-gray-400 font-mono mt-1">Role: {player.role}</div>
                                <div className="text-xs text-amber-400 font-mono mt-0.5">
                                    Score: {player.performanceScore.toFixed(2)}
                                </div>
                                <div className="mt-3 text-[11px] font-mono text-cyan-400 underline">
                                    Pick Player →
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}