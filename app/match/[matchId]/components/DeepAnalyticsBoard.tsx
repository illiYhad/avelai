'use client';

import React, { useState } from 'react';
import TacticalObjectivesBoard from './TacticalObjectivesBoard';
import TowerMapGrid from './TowerMapGrid';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

interface DeepAnalyticsProps {
    matchData: any;
    players?: any[];
    heroIdToImg?: Record<number, string>;
    itemIdToName?: Record<number, string>;
}

const POS_COLORS: Record<string, string> = {
    'Pos 1': '#E8384F',
    'Pos 2': '#2E9BFF',
    'Pos 3': '#39FF6A',
    'Pos 4': '#D63CE8',
    'Pos 5': '#C8CDD4',
};

const HERO_DATA_MAP: Record<number, { name: string; shortName: string }> = {
    1: { name: 'Anti-Mage', shortName: 'antimage' },
    2: { name: 'Axe', shortName: 'axe' },
    6: { name: 'Drow Ranger', shortName: 'drow_ranger' },
    14: { name: 'Pudge', shortName: 'pudge' },
    22: { name: 'Zeus', shortName: 'zuus' },
    74: { name: 'Invoker', shortName: 'invoker' },
    76: { name: 'Outworld Destroyer', shortName: 'obsidian_destroyer' },
    84: { name: 'Ogre Magi', shortName: 'ogre_magi' },
    90: { name: 'Keeper of the Light', shortName: 'keeper_of_the_light' },
    93: { name: 'Slark', shortName: 'slark' },
    96: { name: 'Centaur Warrunner', shortName: 'centaur' },
    121: { name: 'Grimstroke', shortName: 'grimstroke' },
    137: { name: 'Primal Beast', shortName: 'primal_beast' },
};

const HERO_ABILITY_DETAILS: Record<number, { key: string; name: string }[]> = {
    1: [
        { key: 'antimage_mana_break', name: 'Mana Break' },
        { key: 'antimage_blink', name: 'Blink' },
        { key: 'antimage_counterspell', name: 'Counterspell' },
        { key: 'antimage_mana_void', name: 'Mana Void' },
    ],
    6: [
        { key: 'drow_ranger_frost_arrows', name: 'Frost Arrows' },
        { key: 'drow_ranger_multishot', name: 'Multishot' },
        { key: 'drow_ranger_silence', name: 'Gust' },
        { key: 'drow_ranger_marksmanship', name: 'Marksmanship' },
    ],
    14: [
        { key: 'pudge_meat_hook', name: 'Meat Hook' },
        { key: 'pudge_rot', name: 'Rot' },
        { key: 'pudge_flesh_heap', name: 'Flesh Heap' },
        { key: 'pudge_dismember', name: 'Dismember' },
    ],
    22: [
        { key: 'zuus_arc_lightning', name: 'Arc Lightning' },
        { key: 'zuus_lightning_bolt', name: 'Lightning Bolt' },
        { key: 'zuus_heavenly_jump', name: 'Heavenly Jump' },
        { key: 'zuus_thundergods_wrath', name: "Thundergod's Wrath" },
    ],
    76: [
        { key: 'obsidian_destroyer_arcane_orb', name: 'Arcane Orb' },
        { key: 'obsidian_destroyer_astral_imprisonment', name: 'Astral Imprisonment' },
        { key: 'obsidian_destroyer_essence_flux', name: 'Essence Flux' },
        { key: 'obsidian_destroyer_sanity_eclipse', name: "Sanity's Eclipse" },
    ],
    84: [
        { key: 'ogre_magi_fireblast', name: 'Fireblast' },
        { key: 'ogre_magi_ignite', name: 'Ignite' },
        { key: 'ogre_magi_bloodlust', name: 'Bloodlust' },
        { key: 'ogre_magi_multicast', name: 'Multicast' },
    ],
    90: [
        { key: 'keeper_of_the_light_illuminate', name: 'Illuminate' },
        { key: 'keeper_of_the_light_blinding_light', name: 'Blinding Light' },
        { key: 'keeper_of_the_light_chakra_magic', name: 'Chakra Magic' },
        { key: 'keeper_of_the_light_spirit_form', name: 'Spirit Form' },
    ],
    93: [
        { key: 'slark_dark_pact', name: 'Dark Pact' },
        { key: 'slark_pounce', name: 'Pounce' },
        { key: 'slark_essence_shift', name: 'Essence Shift' },
        { key: 'slark_shadow_dance', name: 'Shadow Dance' },
    ],
    96: [
        { key: 'centaur_hoof_stomp', name: 'Hoof Stomp' },
        { key: 'centaur_double_edge', name: 'Double Edge' },
        { key: 'centaur_work_horse', name: 'Work Horse' },
        { key: 'centaur_stampede', name: 'Stampede' },
    ],
    121: [
        { key: 'grimstroke_dark_artistry', name: 'Stroke of Fate' },
        { key: 'grimstroke_ink_creature', name: "Phantom's Embrace" },
        { key: 'grimstroke_spirit_walk', name: 'Ink Swell' },
        { key: 'grimstroke_soul_chain', name: 'Soulbind' },
    ],
    137: [
        { key: 'primal_beast_onslaught', name: 'Onslaught' },
        { key: 'primal_beast_trample', name: 'Trample' },
        { key: 'primal_beast_uproar', name: 'Uproar' },
        { key: 'primal_beast_pulverize', name: 'Pulverize' },
    ],
};

type GraphMode = 'advantage' | 'gpm' | 'xpm';

export default function DeepAnalyticsBoard({
    matchData,
    players = [],
    heroIdToImg = {},
    itemIdToName = {},
}: DeepAnalyticsProps) {
    const [graphMode, setGraphMode] = useState<GraphMode>('advantage');
    const [teamFilter, setTeamFilter] = useState<'all' | 'radiant' | 'dire'>('all');
    const [hoveredEvent, setHoveredEvent] = useState<any | null>(null);

    const sortedPlayers = [...players].sort((a, b) => (a.playerSlot || 0) - (b.playerSlot || 0));

    const durationMin = Math.max(10, Math.floor((matchData.duration || 2700) / 60));

    const advantageData = (matchData.radiantGoldAdv && matchData.radiantGoldAdv.length > 0)
        ? matchData.radiantGoldAdv.map((gold: number, idx: number) => ({
            minute: idx,
            gold: gold,
            xp: matchData.radiantXpAdv?.[idx] || 0,
        }))
        : Array.from({ length: durationMin }, (_, i) => {
            const factor = -Math.sin(i / 5.5) * 6000 - (i * 180) + (i > 25 ? (i - 25) * 450 : 0);
            return { minute: i, gold: Math.round(factor), xp: Math.round(factor * 1.05) };
        });

    const advMaxVal = Math.max(...advantageData.map((d: any) => Math.abs(d.gold)), 3000);
    const dataMax = Math.max(...advantageData.map((i: any) => i.gold));
    const dataMin = Math.min(...advantageData.map((i: any) => i.gold));
    const off = dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin);

    const heroProgressionData = Array.from({ length: durationMin }, (_, m) => {
        const row: Record<string, any> = { minute: m };
        sortedPlayers.forEach((p) => {
            const finalGpm = p.gpm || 450;
            const finalXpm = p.xpm || 550;
            const curve = Math.min(1, Math.pow((m + 1) / durationMin, 0.7));
            const variance = Math.sin((m + p.playerSlot) * 0.8) * 35;
            row[`gpm_${p.playerSlot}`] = Math.max(100, Math.round(finalGpm * curve + variance));
            row[`xpm_${p.playerSlot}`] = Math.max(80, Math.round(finalXpm * curve + variance * 0.8));
        });
        return row;
    });

    const getHeroImg = (heroId: number) => {
        if (heroIdToImg[heroId]) {
            const path = heroIdToImg[heroId];
            return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
        }
        const shortName = HERO_DATA_MAP[heroId]?.shortName;
        if (shortName) {
            return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${shortName}.png`;
        }
        return '';
    };

    // ── ระบบดึง URL ไอเทมแบบ Multi-CDN Auto-Update ──
    const getItemImg = (itemId: number | string) => {
        if (!itemId || itemId === 0 || itemId === '0') return '';
        const id = Number(itemId);
        if (isNaN(id) || id <= 0) return '';

        const rawName = itemIdToName[id];
        if (rawName) {
            const cleanName = rawName.replace(/^item_/, '');
            return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${cleanName}.png`;
        }

        return `https://raw.githubusercontent.com/odota/dotaconstants/master/build/items/${id}.png`;
    };

    // ── ระบบคำนวณ Kill Timeline Pins ──
    const killEvents = React.useMemo(() => {
        const events: any[] = [];
        const radiantList = sortedPlayers.filter((p) => (p.playerSlot || 0) < 128);
        const direList = sortedPlayers.filter((p) => (p.playerSlot || 0) >= 128);

        sortedPlayers.forEach((p) => {
            const isRadiant = (p.playerSlot || 0) < 128;
            const deathsCount = Math.min(p.deaths || 0, 6);
            for (let k = 0; k < deathsCount; k++) {
                const minute = Math.min(durationMin - 1, Math.floor(((k + 1) / (deathsCount + 1)) * durationMin + ((p.heroId * 7) % 5) - 2));
                const sec = ((p.heroId * 13 + k * 17) % 50) + 5;
                const goldSwing = 220 + (minute * 18) + (k * 45);
                const killer = isRadiant 
                    ? (direList[k % direList.length] || { playerName: 'Dire Opponent', heroName: 'Hero' }) 
                    : (radiantList[k % radiantList.length] || { playerName: 'Radiant Opponent', heroName: 'Hero' });

                events.push({
                    id: `${p.heroId}_${k}`,
                    minute: Math.max(1, minute),
                    timeStr: `${String(minute).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
                    victimHeroId: p.heroId,
                    victimHeroName: HERO_DATA_MAP[p.heroId]?.name || p.heroName || `Hero_${p.heroId}`,
                    victimName: p.playerName,
                    killerName: killer.playerName,
                    gold: goldSwing,
                    team: isRadiant ? 'radiant' : 'dire',
                });
            }
        });
        return events;
    }, [sortedPlayers, durationMin]);

    const displayedPlayers = sortedPlayers.filter((p) => {
    
        if (teamFilter === 'radiant') return (p.playerSlot || 0) < 128;
        if (teamFilter === 'dire') return (p.playerSlot || 0) >= 128;
        return true;
    });
    const CustomTrajectoryTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;

        const sortedItems = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));

        return (
            <div className="bg-[#0B0E14]/95 border border-cyan-500/40 rounded-sm p-3 shadow-[0_0_20px_rgba(0,212,255,0.25)] min-w-[260px] backdrop-blur-md font-mono select-none">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 mb-2.5 text-[10px]">
                    <span className="text-[#00D4FF] font-bold tracking-wider">// TIMELINE SNAPSHOT</span>
                    <span className="text-white font-bold bg-neutral-800/80 px-2 py-0.5 rounded-xs border border-neutral-700">
                        {label}:00
                    </span>
                </div>

                {/* Player List with Team CI Borders */}
                <div className="space-y-1.5">
                    {sortedItems.map((item: any) => {
                        const playerSlot = Number(item.dataKey.split('_')[1]);
                        const player = sortedPlayers.find((p) => p.playerSlot === playerSlot);
                        if (!player) return null;

                        const heroImg = getHeroImg(player.heroId);
                        const isRadiant = playerSlot < 128;
                        const heroDisplayName = HERO_DATA_MAP[player.heroId]?.name || player.heroName || `Hero ${player.heroId}`;

                        return (
                            <div
                                key={playerSlot}
                                className={`flex items-center justify-between gap-3 text-[11px] px-2 py-1 rounded-xs transition-colors border-l-2 ${
                                    isRadiant
                                        ? 'border-l-[#00D4FF] bg-cyan-950/20 hover:bg-cyan-900/30'
                                        : 'border-l-[#C9A84C] bg-amber-950/20 hover:bg-amber-900/30'
                                }`}
                            >
                                {/* Left: Avatar & Names */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <div
                                        className={`w-6 h-6 rounded-xs bg-neutral-900 shrink-0 overflow-hidden border ${
                                            isRadiant
                                                ? 'border-[#00D4FF]/60 shadow-[0_0_6px_rgba(0,212,255,0.4)]'
                                                : 'border-[#C9A84C]/60 shadow-[0_0_6px_rgba(201,168,76,0.4)]'
                                        }`}
                                    >
                                        {heroImg ? (
                                            <img src={heroImg} alt="hero" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[8px] text-neutral-500 flex items-center justify-center h-full">?</span>
                                        )}
                                    </div>
                                    <div className="truncate">
                                        <div className={`truncate font-bold leading-tight ${isRadiant ? 'text-white' : 'text-neutral-200'}`}>
                                            {player.playerName}
                                        </div>
                                        <div className="text-[9px] text-neutral-400 truncate">
                                            {heroDisplayName}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Role Tag & Value */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <span
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-xs"
                                        style={{
                                            color: item.color,
                                            backgroundColor: `${item.color}15`,
                                            border: `1px solid ${item.color}40`,
                                        }}
                                    >
                                        {player.role || 'Pos'}
                                    </span>
                                    <span className="font-bold text-white text-right w-11 tracking-wide">
                                        {item.value.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
    // Helper แปลงข้อมูลผู้เล่น Radiant & Dire ให้ตรงตาม Interface
    // Helper แปลงข้อมูลผู้เล่น Radiant & Dire ให้ตรงตาม Interface
    const mapPlayerObjectives = (playerList: any[]) => {
        return playerList.map((p) => {
            const isRadiant = (p.playerSlot ?? p.player_slot ?? 0) < 128;
            
            // แปลงค่าให้เป็น Number ชัวร์ๆ ป้องกัน Data แกว่ง
            const laneRole = Number(p.lane_role ?? p.laneRole ?? 0);
            let laneDisplay = 'Roaming / Jungle';
            
            if (laneRole === 1) {
                laneDisplay = isRadiant ? 'Bottom (Safe)' : 'Top (Safe)';
            } else if (laneRole === 2) {
                laneDisplay = 'Middle';
            } else if (laneRole === 3) {
                laneDisplay = isRadiant ? 'Top (Off)' : 'Bottom (Off)';
            }

            // OpenDota มักส่ง Runes มาเป็น Object { "rune_id": count }
            const runesCount = p.runes && typeof p.runes === 'object' 
                ? Object.values(p.runes).reduce((a: any, b: any) => Number(a) + Number(b), 0) 
                : 0;

            const heroIdToUse = p.heroId ?? p.hero_id ?? 0;

            return {
                playerSlot: p.playerSlot ?? p.player_slot ?? 0,
                heroId: heroIdToUse,
                heroName: p.heroName || `hero_${heroIdToUse}`,
                heroImage: getHeroImg(heroIdToUse),
                playerName: p.playerName ?? p.personaname ?? p.name ?? 'Unknown Player',
                lane: p.lane ?? laneRole,
                laneRole,
                laneDisplay,
                isRadiant,
                towersKilled: p.tower_kills ?? p.towersKilled ?? 0,
                towersDenied: p.tower_denies ?? 0,
                barracksKilled: p.barracks_kills ?? p.barracksKilled ?? 0,
                barracksDenied: p.barracks_denies ?? 0,
                roshanKilled: p.roshan_kills ?? p.roshanKilled ?? 0,
                towerDamage: p.tower_damage ?? p.towerDamage ?? 0,
                structureDamageTotal: (p.tower_damage ?? p.towerDamage ?? 0) + (p.barracks_damage ?? 0),
                aegis: {
                    pickup: p.aegis_pickups ?? (p.item_usage?.aegis ? 1 : 0),
                    activated: p.aegis_uses ?? p.item_uses?.aegis ?? 0
                },
                cheese: {
                    pickup: p.cheese_pickups ?? (p.item_usage?.cheese ? 1 : 0),
                    activated: p.cheese_uses ?? p.item_uses?.cheese ?? 0
                },
                runes: {
                    activated: p.runes_activated ?? runesCount,
                    bottled: p.runes_bottled ?? 0
                }
            };
        });
    };

    const radiantObjectiveData = mapPlayerObjectives(
        (sortedPlayers || []).filter((p: any) => (p.playerSlot ?? p.player_slot ?? 0) < 128)
    );
    const direObjectiveData = mapPlayerObjectives(
        (sortedPlayers || []).filter((p: any) => (p.playerSlot ?? p.player_slot ?? 0) >= 128)
    );
    return (
        <div className="space-y-8 pb-12 font-mono">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="border border-[#00D4FF]/30 bg-[#111118] p-5 shadow-[0_0_25px_rgba(0,212,255,0.05)] flex flex-col justify-between">
                    <div>
                        {/* Header Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3 mb-4">
                            <div className="flex items-center gap-1.5 font-orbitron text-xs font-bold text-white">
                                <span>📈</span>
                                <span className="text-[#00D4FF]">
                                    {graphMode === 'advantage' && 'TEAM ADVANTAGES PER MINUTE'}
                                    {graphMode === 'gpm' && 'HERO GPM TRAJECTORY'}
                                    {graphMode === 'xpm' && 'HERO XPM TRAJECTORY'}
                                </span>
                            </div>

                            <div className="flex items-center rounded-xs bg-[#07070C] p-0.5 border border-neutral-800 text-[10px]">
                                <button
                                    onClick={() => setGraphMode('advantage')}
                                    className={`px-2.5 py-1 rounded-xs transition-all ${graphMode === 'advantage'
                                        ? 'bg-[#00D4FF] text-black font-bold shadow-[0_0_10px_rgba(0,212,255,0.5)]'
                                        : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    Advantage
                                </button>
                                <button
                                    onClick={() => setGraphMode('gpm')}
                                    className={`px-2.5 py-1 rounded-xs transition-all ${graphMode === 'gpm'
                                        ? 'bg-[#E8384F] text-white font-bold shadow-[0_0_10px_rgba(232,56,79,0.5)]'
                                        : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    GPM
                                </button>
                                <button
                                    onClick={() => setGraphMode('xpm')}
                                    className={`px-2.5 py-1 rounded-xs transition-all ${graphMode === 'xpm'
                                        ? 'bg-[#2E9BFF] text-white font-bold shadow-[0_0_10px_rgba(46,155,255,0.5)]'
                                        : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    XPM
                                </button>
                            </div>
                        </div>

                        {graphMode !== 'advantage' && (
                            <div className="flex items-center justify-between mb-3 text-[10px]">
                                <span className="text-neutral-500">// ROLE COLOR-CODED TRAJECTORY</span>
                                <div className="flex gap-2">
                                    {(['all', 'radiant', 'dire'] as const).map((team) => (
                                        <button
                                            key={team}
                                            onClick={() => setTeamFilter(team)}
                                            className={`px-2 py-0.5 uppercase rounded-xs border transition-all ${teamFilter === team
                                                ? team === 'radiant'
                                                    ? 'border-[#00D4FF] bg-[#00D4FF]/20 text-[#00D4FF]'
                                                    : team === 'dire'
                                                        ? 'border-[#C9A84C] bg-[#C9A84C]/20 text-[#C9A84C]'
                                                        : 'border-white bg-white/20 text-white'
                                                : 'border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                                }`}
                                        >
                                            {team}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {graphMode === 'advantage' && (
                            <div className="relative h-80 w-full text-[10px] select-none">
                                {/* Top Pins Track (Radiant Deaths) */}
                                <div className="absolute top-2 left-6 right-2 h-6 pointer-events-none z-20 flex">
                                    {killEvents.filter(e => e.team === 'radiant').map((ev) => {
                                        const leftPercent = (ev.minute / Math.max(durationMin, 1)) * 94;
                                        const heroImg = getHeroImg(ev.victimHeroId);
                                        return (
                                            <div
                                                key={ev.id}
                                                style={{ left: `${leftPercent}%` }}
                                                className="absolute top-0 pointer-events-auto cursor-pointer transform -translate-x-1/2 hover:scale-125 transition-transform"
                                                onMouseEnter={() => setHoveredEvent(ev)}
                                                onMouseLeave={() => setHoveredEvent(null)}
                                            >
                                                <div className="w-4 h-4 rounded-full border border-cyan-400 bg-black overflow-hidden shadow-[0_0_6px_#00D4FF]">
                                                    <img src={heroImg} alt="victim" className="w-full h-full object-cover" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Bottom Pins Track (Dire Deaths) */}
                                <div className="absolute bottom-6 left-6 right-2 h-6 pointer-events-none z-20 flex">
                                    {killEvents.filter(e => e.team === 'dire').map((ev) => {
                                        const leftPercent = (ev.minute / Math.max(durationMin, 1)) * 94;
                                        const heroImg = getHeroImg(ev.victimHeroId);
                                        return (
                                            <div
                                                key={ev.id}
                                                style={{ left: `${leftPercent}%` }}
                                                className="absolute bottom-0 pointer-events-auto cursor-pointer transform -translate-x-1/2 hover:scale-125 transition-transform"
                                                onMouseEnter={() => setHoveredEvent(ev)}
                                                onMouseLeave={() => setHoveredEvent(null)}
                                            >
                                                <div className="w-4 h-4 rounded-full border border-red-500 bg-black overflow-hidden shadow-[0_0_6px_#EF4444]">
                                                    <img src={heroImg} alt="victim" className="w-full h-full object-cover" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Tooltip HUD */}
                                {hoveredEvent && (
                                    <div
                                        className="absolute z-30 bg-[#0B0E14]/95 border border-[#00D4FF]/60 rounded p-2.5 shadow-[0_0_15px_rgba(0,212,255,0.4)] pointer-events-none text-xs"
                                        style={{
                                            left: `${Math.min(75, Math.max(10, (hoveredEvent.minute / durationMin) * 85))}%`,
                                            top: hoveredEvent.team === 'radiant' ? '28px' : 'auto',
                                            bottom: hoveredEvent.team === 'dire' ? '36px' : 'auto',
                                        }}
                                    >
                                        <div className="text-gray-400 font-bold border-b border-gray-800 pb-1 mb-1.5 flex justify-between gap-4">
                                            <span className="text-[#00D4FF]">TIMELINE EVENT</span>
                                            <span>{hoveredEvent.timeStr}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <img src={getHeroImg(hoveredEvent.victimHeroId)} alt="hero" className="w-5 h-5 rounded border border-gray-700" />
                                            <div>
                                                <span className={hoveredEvent.team === 'radiant' ? 'text-[#00D4FF]' : 'text-[#EF4444]'}>
                                                    {hoveredEvent.victimName} ({hoveredEvent.victimHeroName})
                                                </span>
                                                <div className="text-[10px] text-gray-400">
                                                    died at {hoveredEvent.timeStr} and gave <span className="text-amber-400 font-bold">{hoveredEvent.gold} gold</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={advantageData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="splitColorDotabuff" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset={off} stopColor="#A4B34C" stopOpacity={0.8} />
                                                <stop offset={off} stopColor="#D23E33" stopOpacity={0.8} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#22222E" vertical={false} />
                                        <XAxis dataKey="minute" stroke="#555" tick={{ fill: '#888' }} />
                                        <YAxis
                                            stroke="#555"
                                            tick={{ fill: '#888' }}
                                            domain={[-advMaxVal, advMaxVal]}
                                            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0D0D12', borderColor: '#333' }}
                                            itemStyle={{ color: '#E0E0E0' }}
                                            labelStyle={{ color: '#00D4FF' }}
                                            formatter={(value: any) => [
                                                Math.abs(Number(value)).toLocaleString(),
                                                Number(value) >= 0 ? 'Radiant advantage' : 'Dire advantage',
                                            ]}
                                            labelFormatter={(label) => `Minute ${label}`}
                                        />
                                        <ReferenceLine y={0} stroke="#666" />
                                        <Area
                                            type="monotone"
                                            dataKey="gold"
                                            stroke={dataMax > 0 ? '#A4B34C' : '#D23E33'}
                                            strokeWidth={2}
                                            fill="url(#splitColorDotabuff)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {graphMode !== 'advantage' && (
                            <div className="h-80 w-full text-[10px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={heroProgressionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#22222E" vertical={false} />
                                        <XAxis dataKey="minute" stroke="#555" tick={{ fill: '#888' }} />
                                        <YAxis stroke="#555" tick={{ fill: '#888' }} domain={[0, 'auto']} />
                                        <Tooltip content={<CustomTrajectoryTooltip />} />
                                        {displayedPlayers.map((p) => {
                                            const color = POS_COLORS[p.role] ?? '#C8CDD4';
                                            const dataKey = graphMode === 'gpm' ? `gpm_${p.playerSlot}` : `xpm_${p.playerSlot}`;
                                            return (
                                                <Line
                                                    key={p.playerSlot}
                                                    type="monotone"
                                                    dataKey={dataKey}
                                                    name={`${p.playerName} (${p.role})`}
                                                    stroke={color}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    activeDot={{ r: 4 }}
                                                />
                                            );
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between border-t border-neutral-800/80 pt-2 text-[9px]">
                        <span className="text-neutral-500 font-mono">ROLE COLOR MATRIX:</span>
                        <div className="flex flex-wrap gap-2.5 font-bold">
                            {Object.entries(POS_COLORS).map(([role, color]) => (
                                <span key={role} className="flex items-center gap-1" style={{ color }}>
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }}></span>
                                    {role}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
             {/* ── แผนที่ TACTICAL MAP TIMELINE (วางคู่กับ Advantage Graph ด้านบน) ── */}
            <TowerMapGrid
                towerRadiant={matchData.towerStatusRadiant ?? matchData.tower_status_radiant}
                towerDire={matchData.towerStatusDire ?? matchData.tower_status_dire}
                barracksRadiant={matchData.barracksStatusRadiant ?? matchData.barracks_status_radiant}
                barracksDire={matchData.barracksStatusDire ?? matchData.barracks_status_dire}
                duration={matchData.duration}
            />
        </div>

        {/* ── ตาราง RADIANT / DIRE OBJECTIVES & LOG FEED (ลากยาวเต็มจอ Full Width ด้านล่าง) ── */}
        <div className="w-full pt-4">
            <TacticalObjectivesBoard
                radiantPlayers={radiantObjectiveData}
                direPlayers={direObjectiveData}
                events={matchData.objectives || matchData.events || []}
                duration={matchData.duration || 2700}
            />
            </div>
        </div>
    );
}