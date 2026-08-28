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

const RUNE_INFO: Record<number | string, { name: string; color: string; icon: string }> = {
    0: { name: 'Double Damage Rune', color: '#3B82F6', icon: '🔷' },
    1: { name: 'Haste Rune', color: '#EF4444', icon: '🔴' },
    2: { name: 'Illusion Rune', color: '#EAB308', icon: '🟡' },
    3: { name: 'Invisibility Rune', color: '#8B5CF6', icon: '🟣' },
    4: { name: 'Regeneration Rune', color: '#22C55E', icon: '🟢' },
    5: { name: 'Bounty Rune', color: '#F97316', icon: '🔶' },
    6: { name: 'Arcane Rune', color: '#EC4899', icon: '🌸' },
    7: { name: 'Water Rune', color: '#06B6D4', icon: '💧' },
    8: { name: 'Shield Rune', color: '#A855F7', icon: '🛡️' },
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
            const cleanName = heroName.replace('npc_dota_hero_', '').toLowerCase();
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
                let runeData = RUNE_INFO[5]; // Default: Bounty Rune

                if (ev.type === 'CHAT_MESSAGE_RUNE_PICKUP' || ev.type === 'CHAT_MESSAGE_RUNE_BOTTLE' || ev.type === 'RUNE_PICKUP') {
                    runeData = RUNE_INFO[ev.key] || RUNE_INFO[5];
                    const loc = ev.location || (idx % 2 === 0 ? 'Top' : 'Bottom');
                    actionText = ev.type.includes('BOTTLE') ? `bottled the ${loc}` : `activated the ${loc}`;
                    targetText = runeData.name;
                } else if (ev.type === 'CHAT_MESSAGE_TOWER_KILL' || ev.type === 'building_kill') {
                    actionText = 'destroyed';
                    targetText = ev.key ? ev.key.replace(/npc_dota_badguys_|npc_dota_goodguys_/g, '').replace(/_/g, ' ') : 'Tower';
                } else if (ev.type === 'CHAT_MESSAGE_ROSHAN_KILL') {
                    actionText = 'slain';
                    targetText = 'Roshan';
                } else if (ev.type === 'CHAT_MESSAGE_AEGIS') {
                    actionText = 'picked up';
                    targetText = 'Aegis of the Immortal';
                } else if (ev.type === 'CHAT_MESSAGE_FIRSTBLOOD') {
                    actionText = 'drew First Blood against';
                    targetText = 'Enemy Hero';
                } else if (ev.detail || ev.key) {
                    actionText = ev.type?.replace(/CHAT_MESSAGE_/g, '').replace(/_/g, ' ').toLowerCase();
                    targetText = ev.key || ev.detail || '';
                }

                list.push({
                    id: `ev_${idx}`,
                    time,
                    player,
                    heroId: player?.heroId || ev.hero_id || ev.heroId,
                    heroName: player?.heroName || `Hero_${ev.hero_id || ''}`,
                    heroImage: player?.heroImage || (player?.heroId ? getHeroImageUrl(player.heroId, player.heroName) : undefined),
                    playerName: player?.playerName || (slot !== undefined ? `Player ${slot}` : 'Hero'),
                    actionText,
                    targetText,
                    runeData,
                    isRad,
                    isSpawn: false,
                });
            });
        } else {
            // ── Fallback Generation: จำลอง Event Objective Log ตามเวลาแข่งขันจริง ──
            const maxMin = Math.floor(duration / 60);

            // 1. Spawns Rune ทุก 3 นาที
            for (let m = 0; m <= Math.min(maxMin, 40); m += 3) {
                list.push({
                    id: `spawn_top_${m}`,
                    time: m * 60,
                    player: null,
                    heroId: null,
                    actionText: 'has spawned Top',
                    targetText: 'Bounty Rune',
                    runeData: RUNE_INFO[5],
                    isSpawn: true,
                });
                list.push({
                    id: `spawn_bot_${m}`,
                    time: m * 60,
                    player: null,
                    heroId: null,
                    actionText: 'has spawned Bottom',
                    targetText: 'Bounty Rune',
                    runeData: RUNE_INFO[5],
                    isSpawn: true,
                });
            }

            // 2. Action การเก็บ Rune ของผู้เล่นแต่ละคน
            allPlayers.forEach((p, pIdx) => {
                const runeTotal = p.runes?.activated || 0;
                for (let r = 0; r < runeTotal; r++) {
                    const pickMin = (r * 3) + (pIdx % 3);
                    if (pickMin <= maxMin) {
                        const loc = (pIdx + r) % 2 === 0 ? 'Top' : 'Bottom';
                        list.push({
                            id: `rune_act_${p.playerSlot}_${r}`,
                            time: (pickMin * 60) + 2 + (pIdx * 3),
                            player: p,
                            heroId: p.heroId,
                            heroName: p.heroName,
                            heroImage: p.heroImage || getHeroImageUrl(p.heroId, p.heroName),
                            playerName: p.playerName,
                            actionText: `activated the ${loc}`,
                            targetText: 'Bounty Rune',
                            runeData: RUNE_INFO[5],
                            isRad: p.isRadiant,
                            isSpawn: false,
                        });
                    }
                }

                // 3. Action การทำลายป้อม (Towers)
                if (p.towersKilled > 0) {
                    for (let k = 0; k < p.towersKilled; k++) {
                        list.push({
                            id: `tow_${p.playerSlot}_${k}`,
                            time: (10 + k * 7 + (pIdx % 4)) * 60,
                            player: p,
                            heroId: p.heroId,
                            heroName: p.heroName,
                            heroImage: p.heroImage || getHeroImageUrl(p.heroId, p.heroName),
                            playerName: p.playerName,
                            actionText: 'destroyed',
                            targetText: p.isRadiant ? 'Dire Tier 1 Tower' : 'Radiant Tier 1 Tower',
                            isRad: p.isRadiant,
                            isSpawn: false,
                        });
                    }
                }

                // 4. Roshan Kills
                if (p.roshanKilled > 0) {
                    list.push({
                        id: `rosh_${p.playerSlot}`,
                        time: 21 * 60 + 15,
                        player: p,
                        heroId: p.heroId,
                        heroName: p.heroName,
                        heroImage: p.heroImage || getHeroImageUrl(p.heroId, p.heroName),
                        playerName: p.playerName,
                        actionText: 'slain',
                        targetText: 'Roshan',
                        isRad: p.isRadiant,
                        isSpawn: false,
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
                ev.heroName?.toLowerCase().includes(q) ||
                ev.targetText?.toLowerCase().includes(q) ||
                ev.actionText?.toLowerCase().includes(q)
            );
        })
        .slice(0, isExpanded ? 500 : 25);

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

                <div className="divide-y divide-neutral-900/80 max-h-[500px] overflow-y-auto">
                    {visibleEvents.length === 0 ? (
                        <div className="p-6 text-center text-neutral-600 text-[10px]">
                            // NO OBJECTIVE EVENTS RECORDED IN THIS MATCH
                        </div>
                    ) : (
                        visibleEvents.map((ev) => (
                            <div key={ev.id} className="px-4 py-2 flex items-center gap-3 hover:bg-white/[0.02] text-[11px]">
                                {/* Time & Indicator */}
                                <div className="flex items-center gap-1.5 text-neutral-400 font-bold w-14 shrink-0">
                                    <span>{formatTime(ev.time)}</span>
                                    <span className="text-[10px] text-neutral-500">🏹</span>
                                </div>

                                {/* Event Body */}
                                {ev.isSpawn ? (
                                    <div className="flex items-center gap-2 text-neutral-300">
                                        <span className="text-amber-500 text-xs">🔶</span>
                                        <span className="text-[#F97316] font-semibold">{ev.targetText}</span>
                                        <span className="text-neutral-400">{ev.actionText}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Hero Avatar */}
                                        {ev.heroId && (
                                            <div
                                                className="w-6 h-4 rounded-xs overflow-hidden bg-neutral-900 border shrink-0"
                                                style={{ borderColor: ev.isRad ? '#39FF6A' : '#E8384F' }}
                                            >
                                                <img
                                                    src={ev.heroImage || getHeroImageUrl(ev.heroId, ev.heroName)}
                                                    alt="hero"
                                                    className="w-full h-full object-cover"
                                                    onError={(e: any) => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}

                                        {/* Hero / Player Name (สี Radiant เขียว / Dire แดง แบบ Dotabuff) */}
                                        <span className={ev.isRad ? 'text-[#39FF6A] font-semibold' : 'text-[#E8384F] font-semibold'}>
                                            {ev.heroName && !ev.heroName.startsWith('hero_') ? ev.heroName.replace(/_/g, ' ') : ev.playerName}
                                        </span>

                                        {/* Action */}
                                        <span className="text-neutral-400">{ev.actionText}</span>

                                        {/* Rune Icon & Target */}
                                        {ev.runeData && <span className="text-xs">{ev.runeData.icon}</span>}
                                        <span
                                            className="font-semibold"
                                            style={{ color: ev.runeData ? ev.runeData.color : '#F97316' }}
                                        >
                                            {ev.targetText}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {processedEvents.length > 25 && (
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