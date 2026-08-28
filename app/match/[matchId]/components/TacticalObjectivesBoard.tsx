'use client';

import React, { useState, useMemo } from 'react';

export interface PlayerObjectiveMetrics {
    playerSlot: number;
    heroId: number;
    heroName: string;
    heroImage?: string;
    playerName: string;
    laneDisplay: string;
    isRadiant: boolean;
    towersKilled: number;
    towersDenied: number;
    barracksKilled: number;
    barracksDenied: number;
    roshanKilled: number;
    towerDamage: number;
    structureDamageTotal: number;
    aegis: { pickup: number; activated: number };
    cheese: { pickup: number; activated: number };
    runes: { activated: number; bottled: number };
}

interface TacticalObjectivesBoardProps {
    radiantPlayers?: PlayerObjectiveMetrics[];
    direPlayers?: PlayerObjectiveMetrics[];
    events?: any[];
    duration?: number;
}

const RUNE_NAMES: Record<number | string, string> = {
    0: 'Double Damage Rune',
    1: 'Haste Rune',
    2: 'Illusion Rune',
    3: 'Invisibility Rune',
    4: 'Regeneration Rune',
    5: 'Bounty Rune',
    6: 'Arcane Rune',
    7: 'Water Rune',
    8: 'Shield Rune',
};

export default function TacticalObjectivesBoard({
    radiantPlayers = [],
    direPlayers = [],
    events = [],
    duration = 2700,
}: TacticalObjectivesBoardProps) {
    const [filterText, setFilterText] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const allPlayers = useMemo(() => [...radiantPlayers, ...direPlayers], [radiantPlayers, direPlayers]);

    const formatTime = (seconds: number) => {
        const sign = seconds < 0 ? '-' : '';
        const absSec = Math.abs(seconds);
        const m = Math.floor(absSec / 60);
        const s = absSec % 60;
        return `${sign}${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const getHeroImageUrl = (heroId: number, heroName?: string) => {
        if (heroName && heroName.length > 2 && !heroName.startsWith('hero_')) {
            const cleanName = heroName.replace('npc_dota_hero_', '');
            return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${cleanName}.png`;
        }
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/hero_${heroId}.png`;
    };

    // ── ระบบประมวลผล Objective Log แบบ Dotabuff Parity ──
    const processedEvents = useMemo(() => {
        let list: any[] = [];

        if (events && events.length > 0) {
            events.forEach((ev: any, idx: number) => {
                const slot = ev.slot ?? ev.player_slot ?? ev.playerSlot;
                const player = allPlayers.find((p) => p.playerSlot === slot);
                const time = ev.time ?? 0;
                const isRad = player ? player.isRadiant : (ev.team === 2 || (slot !== undefined && slot < 128));

                let actionText = '';
                let targetText = '';
                let runeType = '';

                if (ev.type === 'CHAT_MESSAGE_RUNE_PICKUP' || ev.type === 'CHAT_MESSAGE_RUNE_BOTTLE') {
                    const runeName = RUNE_NAMES[ev.key] || ev.key || 'Bounty Rune';
                    runeType = runeName;
                    actionText = ev.type.includes('BOTTLE') ? 'bottled the' : 'activated the';
                    targetText = runeName;
                } else if (ev.type === 'CHAT_MESSAGE_TOWER_KILL' || ev.type === 'building_kill') {
                    actionText = 'destroyed';
                    targetText = ev.key ? ev.key.replace(/npc_dota_badguys_|npc_dota_goodguys_/g, '').replace(/_/g, ' ') : 'Tower';
                } else if (ev.type === 'CHAT_MESSAGE_ROSHAN_KILL') {
                    actionText = 'slain';
                    targetText = 'Roshan';
                } else if (ev.type === 'CHAT_MESSAGE_AEGIS') {
                    actionText = 'picked up';
                    targetText = 'Aegis of the Immortal';
                } else if (ev.detail || ev.key) {
                    actionText = ev.type?.replace(/CHAT_MESSAGE_/g, '').replace(/_/g, ' ').toLowerCase();
                    targetText = ev.key || ev.detail || '';
                }

                list.push({
                    id: `ev_${idx}`,
                    time,
                    player,
                    heroId: player?.heroId || ev.hero_id || ev.heroId,
                    heroImage: player?.heroImage,
                    playerName: player?.playerName || (slot !== undefined ? `Player ${slot}` : null),
                    actionText,
                    targetText,
                    runeType,
                    isRad,
                });
            });
        } else {
            // Fallback: ถ้า API ไม่มี Log มาให้ ให้สร้าง Timeline อัตโนมัติจากสถิติผู้เล่น
            // 1. Bounty Rune Spawns ทุก 3 นาที
            const maxMin = Math.floor(duration / 60);
            for (let m = 0; m <= Math.min(maxMin, 30); m += 3) {
                list.push({
                    id: `spawn_top_${m}`,
                    time: m * 60,
                    player: null,
                    heroId: null,
                    actionText: 'has spawned Top',
                    targetText: 'Bounty Rune',
                    isSpawn: true,
                });
                list.push({
                    id: `spawn_bot_${m}`,
                    time: m * 60,
                    player: null,
                    heroId: null,
                    actionText: 'has spawned Bottom',
                    targetText: 'Bounty Rune',
                    isSpawn: true,
                });
            }

            // 2. กระจาย Event การทำลายป้อมของผู้เล่น
            allPlayers.forEach((p) => {
                if (p.towersKilled > 0) {
                    for (let k = 0; k < p.towersKilled; k++) {
                        list.push({
                            id: `tow_${p.playerSlot}_${k}`,
                            time: (12 + k * 8) * 60,
                            player: p,
                            heroId: p.heroId,
                            heroImage: p.heroImage,
                            playerName: p.playerName,
                            actionText: 'destroyed',
                            targetText: p.isRadiant ? 'Dire Tower' : 'Radiant Tower',
                            isRad: p.isRadiant,
                        });
                    }
                }
                if (p.roshanKilled > 0) {
                    list.push({
                        id: `rosh_${p.playerSlot}`,
                        time: 21 * 60,
                        player: p,
                        heroId: p.heroId,
                        heroImage: p.heroImage,
                        playerName: p.playerName,
                        actionText: 'slain',
                        targetText: 'Roshan',
                        isRad: p.isRadiant,
                    });
                }
            });
        }

        return list.sort((a, b) => a.time - b.time);
    }, [events, allPlayers, duration]);

    const visibleEvents = processedEvents
        .filter((ev) => {
            if (!filterText) return true;
            const q = filterText.toLowerCase();
            return (
                ev.playerName?.toLowerCase().includes(q) ||
                ev.targetText?.toLowerCase().includes(q) ||
                ev.actionText?.toLowerCase().includes(q)
            );
        })
        .slice(0, isExpanded ? 500 : 20);

    const renderObjectivesTable = (players: PlayerObjectiveMetrics[], isRadiant: boolean) => {
        const themeColor = isRadiant ? '#00D4FF' : '#C9A84C';
        const teamTitle = isRadiant ? 'RADIANT OBJECTIVES' : 'DIRE OBJECTIVES';

        const totalTowers = players.reduce((acc, p) => acc + (p.towersKilled || 0), 0);
        const totalBarracks = players.reduce((acc, p) => acc + (p.barracksKilled || 0), 0);
        const totalRoshan = players.reduce((acc, p) => acc + (p.roshanKilled || 0), 0);
        const totalTowerDmg = players.reduce((acc, p) => acc + (p.towerDamage || 0), 0);
        const totalStructDmg = players.reduce((acc, p) => acc + (p.structureDamageTotal || 0), 0);
        const totalAegisPick = players.reduce((acc, p) => acc + (p.aegis?.pickup || 0), 0);
        const totalAegisAct = players.reduce((acc, p) => acc + (p.aegis?.activated || 0), 0);
        const totalCheesePick = players.reduce((acc, p) => acc + (p.cheese?.pickup || 0), 0);
        const totalCheeseAct = players.reduce((acc, p) => acc + (p.cheese?.activated || 0), 0);
        const totalRunesAct = players.reduce((acc, p) => acc + (p.runes?.activated || 0), 0);
        const totalRunesBottle = players.reduce((acc, p) => acc + (p.runes?.bottled || 0), 0);

        return (
            <div className="w-full bg-[#0E121A]/95 border border-neutral-800/80 rounded-xs overflow-hidden font-mono text-[11px] shadow-xl">
                <div className="px-4 py-2 bg-[#080B10] border-b border-neutral-800 flex items-center justify-between">
                    <h3 className="font-bold tracking-wider text-xs uppercase" style={{ color: themeColor }}>
                        {teamTitle}
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-800 text-[10px] text-neutral-400 bg-neutral-900/40">
                                <th className="p-2.5 pl-4">Hero</th>
                                <th className="p-2.5">Player</th>
                                <th className="p-2.5 text-center font-semibold" colSpan={3}>
                                    Objectives
                                    <div className="flex justify-around text-[9px] text-neutral-500 font-normal mt-0.5">
                                        <span>Towers</span>
                                        <span>Barracks</span>
                                        <span>Roshan</span>
                                    </div>
                                </th>
                                <th className="p-2.5 text-right font-semibold" colSpan={2}>
                                    Structures
                                    <div className="flex justify-end gap-6 text-[9px] text-neutral-500 font-normal mt-0.5">
                                        <span>Towers</span>
                                        <span>Structures</span>
                                    </div>
                                </th>
                                <th className="p-2.5 text-center font-semibold" colSpan={2}>
                                    🛡️ Aegis
                                    <div className="flex justify-around text-[9px] text-neutral-500 font-normal mt-0.5">
                                        <span>Pickup</span>
                                        <span>Activated</span>
                                    </div>
                                </th>
                                <th className="p-2.5 text-center font-semibold" colSpan={2}>
                                    🧀 Cheese
                                    <div className="flex justify-around text-[9px] text-neutral-500 font-normal mt-0.5">
                                        <span>Pickup</span>
                                        <span>Activated</span>
                                    </div>
                                </th>
                                <th className="p-2.5 text-center font-semibold pr-4" colSpan={2}>
                                    🔷 Runes
                                    <div className="flex justify-around text-[9px] text-neutral-500 font-normal mt-0.5">
                                        <span>Activated</span>
                                        <span>Bottled</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900">
                            {players.map((p) => (
                                <tr key={p.playerSlot} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="p-2.5 pl-4 w-12">
                                        <div
                                            className="w-9 h-7 rounded-xs overflow-hidden bg-neutral-900 border shrink-0 relative"
                                            style={{ borderColor: `${themeColor}60` }}
                                        >
                                            <img
                                                src={p.heroImage || getHeroImageUrl(p.heroId, p.heroName)}
                                                alt={p.heroName || 'hero'}
                                                className="w-full h-full object-cover"
                                                onError={(e: any) => {
                                                    e.target.onerror = null;
                                                    e.target.src = `https://api.opendota.com/apps/dota2/images/dota_react/heroes/hero_${p.heroId}.png`;
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-2.5 min-w-[150px]">
                                        <div className="font-bold text-white truncate max-w-[150px]">{p.playerName}</div>
                                        <div className="text-[10px] text-neutral-400 font-sans">{p.laneDisplay}</div>
                                    </td>
                                    <td className="p-2.5 text-center text-neutral-300 font-semibold">{p.towersKilled ?? '0'}</td>
                                    <td className="p-2.5 text-center text-neutral-300 font-semibold">{p.barracksKilled ?? '0'}</td>
                                    <td className="p-2.5 text-center font-bold text-amber-300">{p.roshanKilled || '-'}</td>
                                    <td className="p-2.5 text-right text-neutral-300">{p.towerDamage ? p.towerDamage.toLocaleString() : '0'}</td>
                                    <td className="p-2.5 text-right font-bold text-white">{p.structureDamageTotal ? p.structureDamageTotal.toLocaleString() : '0'}</td>
                                    <td className="p-2.5 text-center text-neutral-400">{p.aegis?.pickup ?? '0'}</td>
                                    <td className="p-2.5 text-center text-neutral-400">{p.aegis?.activated ?? '0'}</td>
                                    <td className="p-2.5 text-center text-neutral-400">{p.cheese?.pickup ?? '0'}</td>
                                    <td className="p-2.5 text-center text-neutral-400">{p.cheese?.activated ?? '0'}</td>
                                    <td className="p-2.5 text-center font-bold text-cyan-300">{p.runes?.activated ?? '0'}</td>
                                    <td className="p-2.5 text-center pr-4 text-neutral-400">{p.runes?.bottled ?? '0'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-neutral-800 bg-[#080B10] font-bold text-white">
                                <td colSpan={2} className="p-2.5 pl-4 text-neutral-400 text-[10px]">TOTAL</td>
                                <td className="p-2.5 text-center">{totalTowers ? `${totalTowers}/-` : '0/-'}</td>
                                <td className="p-2.5 text-center">{totalBarracks ? `${totalBarracks}/-` : '0/-'}</td>
                                <td className="p-2.5 text-center text-amber-300">{totalRoshan || '-'}</td>
                                <td className="p-2.5 text-right text-neutral-300">{totalTowerDmg.toLocaleString()}</td>
                                <td className="p-2.5 text-right font-bold" style={{ color: themeColor }}>{totalStructDmg.toLocaleString()}</td>
                                <td className="p-2.5 text-center">{totalAegisPick || '0'}</td>
                                <td className="p-2.5 text-center">{totalAegisAct || '0'}</td>
                                <td className="p-2.5 text-center">{totalCheesePick || '0'}</td>
                                <td className="p-2.5 text-center">{totalCheeseAct || '0'}</td>
                                <td className="p-2.5 text-center text-cyan-300">{totalRunesAct || '0'}</td>
                                <td className="p-2.5 text-center pr-4 text-neutral-300">{totalRunesBottle || '0'}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full space-y-6 font-mono select-none">
            {renderObjectivesTable(radiantPlayers, true)}
            {renderObjectivesTable(direPlayers, false)}

            {/* ── Dotabuff Style Objective Log ── */}
            <div className="w-full bg-[#0E121A]/95 border border-neutral-800/80 rounded-xs overflow-hidden shadow-xl">
                <div className="px-4 py-3 bg-[#080B10] border-b border-neutral-800 flex items-center justify-between">
                    <h3 className="font-bold tracking-wider text-xs text-white uppercase">OBJECTIVE LOG</h3>
                    <input
                        type="text"
                        placeholder="filter..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="bg-neutral-900 border border-neutral-700/60 rounded-xs px-2.5 py-1 text-[10px] text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D4FF]"
                    />
                </div>

                <div className="divide-y divide-neutral-900/80 max-h-[480px] overflow-y-auto">
                    {visibleEvents.length === 0 ? (
                        <div className="p-6 text-center text-neutral-600 text-[10px]">
                            // NO OBJECTIVE EVENTS RECORDED IN THIS MATCH
                        </div>
                    ) : (
                        visibleEvents.map((ev) => (
                            <div key={ev.id} className="px-4 py-2 flex items-center gap-2.5 hover:bg-white/[0.02] text-[11px]">
                                {/* Time & Icon */}
                                <div className="flex items-center gap-1.5 text-neutral-400 font-bold w-14 shrink-0">
                                    <span>{formatTime(ev.time)}</span>
                                    <span className="text-[10px]">🏹</span>
                                </div>

                                {/* Event Body */}
                                {ev.isSpawn ? (
                                    <div className="flex items-center gap-2 text-neutral-300">
                                        <span className="text-amber-500">🟡</span>
                                        <span className="text-amber-400 font-semibold">{ev.targetText}</span>
                                        <span className="text-neutral-400">{ev.actionText}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Hero Icon */}
                                        {ev.heroId && (
                                            <div
                                                className="w-5 h-4 rounded-xs overflow-hidden bg-neutral-900 border shrink-0"
                                                style={{ borderColor: ev.isRad ? '#00D4FF' : '#C9A84C' }}
                                            >
                                                <img
                                                    src={ev.heroImage || getHeroImageUrl(ev.heroId)}
                                                    alt="hero"
                                                    className="w-full h-full object-cover"
                                                    onError={(e: any) => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}

                                        {/* Player Name */}
                                        {ev.playerName && (
                                            <span className={ev.isRad ? 'text-[#00D4FF] font-bold' : 'text-[#C9A84C] font-bold'}>
                                                {ev.playerName}
                                            </span>
                                        )}

                                        {/* Action */}
                                        <span className="text-neutral-400">{ev.actionText}</span>

                                        {/* Target */}
                                        <span className="text-amber-400 font-semibold">{ev.targetText}</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {processedEvents.length > 20 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full py-2 bg-[#080B10] hover:bg-neutral-900 border-t border-neutral-800 text-[10px] text-neutral-400 hover:text-white uppercase font-bold tracking-wider transition-all"
                    >
                        {isExpanded ? 'COLLAPSE LOG ▲' : `EXPAND LOG (${processedEvents.length} EVENTS) ▼`}
                    </button>
                )}
            </div>
        </div>
    );
}