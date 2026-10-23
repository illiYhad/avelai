/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
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

export interface AnalyticsPlayer {
    playerSlot: number;
    heroId: number;
    heroName?: string;
    playerName: string;
    role?: string;
    level?: number;
    gpm?: number;
    xpm?: number;
    items?: (number | string)[];
    item_0?: number;
    item_1?: number;
    item_2?: number;
    item_3?: number;
    item_4?: number;
    item_5?: number;
    item0?: number;
    item1?: number;
    item2?: number;
    item3?: number;
    item4?: number;
    item5?: number;
    ability_upgrades_arr?: number[];
}

export interface AnalyticsMatchData {
    duration?: number;
    radiantGoldAdv?: number[];
    radiantXpAdv?: number[];
    towerStatusRadiant?: number;
    towerStatusDire?: number;
    barracksStatusRadiant?: number;
    barracksStatusDire?: number;
}

interface DeepAnalyticsProps {
    matchData: AnalyticsMatchData;
    players?: AnalyticsPlayer[];
    heroIdToImg?: Record<number, string>;
    itemIdToName?: Record<number, string>;
}

interface AdvantageDataPoint {
    minute: number;
    gold: number;
    xp: number;
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

    const sortedPlayers = [...players].sort((a, b) => (a.playerSlot || 0) - (b.playerSlot || 0));
    const radiantPlayers = sortedPlayers.filter((p) => (p.playerSlot || 0) < 128);
    const direPlayers = sortedPlayers.filter((p) => (p.playerSlot || 0) >= 128);

    const durationMin = Math.max(10, Math.floor((matchData.duration || 2700) / 60));

    const advantageData: AdvantageDataPoint[] = (matchData.radiantGoldAdv && matchData.radiantGoldAdv.length > 0)
        ? matchData.radiantGoldAdv.map((gold: number, idx: number) => ({
            minute: idx,
            gold: gold,
            xp: matchData.radiantXpAdv?.[idx] || 0,
        }))
        : Array.from({ length: durationMin }, (_, i) => {
            const factor = -Math.sin(i / 5.5) * 6000 - (i * 180) + (i > 25 ? (i - 25) * 450 : 0);
            return { minute: i, gold: Math.round(factor), xp: Math.round(factor * 1.05) };
        });

    const advMaxVal = Math.max(...advantageData.map((d) => Math.abs(d.gold)), 3000);
    const dataMax = Math.max(...advantageData.map((i) => i.gold));
    const dataMin = Math.min(...advantageData.map((i) => i.gold));
    const off = dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin);

    const heroProgressionData = Array.from({ length: durationMin }, (_, m) => {
        const row: Record<string, number> = { minute: m };
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

    const renderHeroBuildMatrix = (p: AnalyticsPlayer) => {
        const isRadiant = (p.playerSlot || 0) < 128;
        const levels = Array.from({ length: 25 }, (_, i) => i + 1);
        const posColor = POS_COLORS[p.role ?? ''] ?? '#C8CDD4';
        const heroImg = getHeroImg(p.heroId);
        const heroDisplayName = HERO_DATA_MAP[p.heroId]?.name || p.heroName || `Hero ${p.heroId}`;
        const abilityDetails = HERO_ABILITY_DETAILS[p.heroId] || [];

        const abilitySlots = [
            {
                slot: 'Q',
                name: abilityDetails[0]?.name || 'Ability 1 (Q)',
                img: abilityDetails[0]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[0].key}.png` : null,
            },
            {
                slot: 'W',
                name: abilityDetails[1]?.name || 'Ability 2 (W)',
                img: abilityDetails[1]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[1].key}.png` : null,
            },
            {
                slot: 'E',
                name: abilityDetails[2]?.name || 'Ability 3 (E)',
                img: abilityDetails[2]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[2].key}.png` : null,
            },
            {
                slot: 'R',
                name: abilityDetails[3]?.name || 'Ultimate (R)',
                img: abilityDetails[3]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[3].key}.png` : null,
            },
            {
                slot: 'T',
                name: 'Talent Tree',
                isTalent: true,
                img: null,
            },
        ];

        const buildMap: Record<number, number> = {};
        const defaultBuild = [0, 1, 0, 1, 0, 3, 0, 1, 1, 4, 2, 3, 2, 2, 4, 2, 4, 3, 4, 4];
        levels.forEach((lvl) => {
            if (p.ability_upgrades_arr && p.ability_upgrades_arr[lvl - 1]) {
                buildMap[lvl] = p.ability_upgrades_arr[lvl - 1] % 5;
            } else if (lvl <= defaultBuild.length) {
                buildMap[lvl] = defaultBuild[lvl - 1];
            }
        });

        const heroItems = [
            p.items?.[0] ?? p.item_0 ?? p.item0 ?? 0,
            p.items?.[1] ?? p.item_1 ?? p.item1 ?? 0,
            p.items?.[2] ?? p.item_2 ?? p.item2 ?? 0,
            p.items?.[3] ?? p.item_3 ?? p.item3 ?? 0,
            p.items?.[4] ?? p.item_4 ?? p.item4 ?? 0,
            p.items?.[5] ?? p.item_5 ?? p.item5 ?? 0,
        ];

        return (
            <div key={p.playerSlot} className="border border-neutral-800 bg-[#0E0E14] p-4 rounded-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/80 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-16 overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0">
                            {heroImg ? (
                                <img
                                    src={heroImg}
                                    alt={heroDisplayName}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const shortName = HERO_DATA_MAP[p.heroId]?.shortName;
                                        if (shortName && !target.src.includes(shortName)) {
                                            target.src = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${shortName}.png`;
                                        }
                                    }}
                                />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">???</span>
                            )}
                        </div>
                        <div>
                            <div className="font-orbitron text-xs font-bold text-white flex items-center gap-2">
                                <span className={isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}>{p.playerName}</span>
                                <span className="text-neutral-300 font-semibold tracking-wide text-[11px]">— {heroDisplayName}</span>
                                <span
                                    className="rounded-xs px-1.5 py-0.5 text-[9px] font-bold"
                                    style={{ color: posColor, border: `1px solid ${posColor}40`, background: `${posColor}15` }}
                                >
                                    {p.role || 'Pos —'}
                                </span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400">
                                {isRadiant ? 'RADIANT' : 'DIRE'} LEVEL {p.level || 25}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-[#07070C] p-1 border border-neutral-800">
                        {heroItems.map((itemId, i) => {
                            const itemUrl = getItemImg(itemId);
                            const rawItemName = itemIdToName[Number(itemId)] || '';
                            const cleanItemName = rawItemName.replace(/^item_/, '');

                            return (
                                <div
                                    key={i}
                                    title={cleanItemName || (itemId ? `Item #${itemId}` : 'Empty Slot')}
                                    className="h-7 w-10 border border-neutral-800 bg-neutral-900 overflow-hidden flex items-center justify-center"
                                >
                                    {itemUrl ? (
                                        <img
                                            src={itemUrl}
                                            alt="item"
                                            className="h-full w-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                if (cleanItemName && !target.src.includes('api.opendota.com')) {
                                                    target.src = `https://api.opendota.com/apps/dota2/images/dota_react/items/${cleanItemName}.png`;
                                                } else {
                                                    target.style.display = 'none';
                                                }
                                            }}
                                        />
                                    ) : (
                                        <span className="h-1 w-1 rounded-full bg-neutral-800" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="min-w-[700px] select-none">
                        <div className="grid grid-cols-[130px_repeat(25,1fr)] gap-1 pb-1 text-center font-mono text-[9px] text-neutral-500">
                            <div className="text-left font-bold text-neutral-600">SKILL / LVL</div>
                            {levels.map((lvl) => (
                                <div key={lvl} className={`font-semibold ${[6, 12, 18, 10, 15, 20, 25].includes(lvl) ? 'text-[#00D4FF]' : ''}`}>
                                    {lvl}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-1">
                            {abilitySlots.map((slot, sIdx) => (
                                <div key={sIdx} className="grid grid-cols-[130px_repeat(25,1fr)] items-center gap-1">
                                    <div
                                        title={slot.name}
                                        className="flex h-7 items-center gap-1.5 border border-neutral-800 bg-[#161622] px-1 overflow-hidden"
                                    >
                                        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden border border-neutral-700 bg-neutral-900">
                                            {slot.isTalent ? (
                                                <span className="text-[10px]">🌳</span>
                                            ) : slot.img ? (
                                                <img
                                                    src={slot.img}
                                                    alt={slot.name}
                                                    className="h-full w-full object-cover"
                                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <span className="text-[8px] font-bold text-neutral-400">{slot.slot}</span>
                                            )}
                                        </div>
                                        <span className="truncate text-[9px] font-bold text-neutral-300">
                                            {slot.name}
                                        </span>
                                    </div>

                                    {levels.map((lvl) => {
                                        const isLearned = buildMap[lvl] === sIdx;
                                        return (
                                            <div
                                                key={lvl}
                                                className={`flex h-7 items-center justify-center border text-[10px] font-bold transition-all ${isLearned
                                                    ? slot.isTalent
                                                        ? 'border-yellow-500/60 bg-yellow-500/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.2)]'
                                                        : sIdx === 3
                                                            ? 'border-[#E8384F]/80 bg-[#E8384F]/20 text-[#E8384F] shadow-[0_0_8px_rgba(232,56,79,0.3)]'
                                                            : 'border-[#00D4FF]/60 bg-[#00D4FF]/20 text-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.2)]'
                                                    : 'border-neutral-900 bg-[#0A0A10]/60 text-transparent'
                                                    }`}
                                            >
                                                {isLearned ? lvl : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const displayedPlayers = sortedPlayers.filter((p) => {
        if (teamFilter === 'radiant') return (p.playerSlot || 0) < 128;
        if (teamFilter === 'dire') return (p.playerSlot || 0) >= 128;
        return true;
    });

    return (
        <div className="space-y-8 pb-12 font-mono">
            {/* SECTION 1: ADVANTAGE & TRAJECTORY */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="border border-[#00D4FF]/30 bg-[#111118] p-5 shadow-[0_0_25px_rgba(0,212,255,0.05)] flex flex-col justify-between">
                    <div>
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
                                    className={`px-2.5 py-1 rounded-xs transition-all cursor-pointer ${graphMode === 'advantage'
                                        ? 'bg-[#00D4FF] text-black font-bold shadow-[0_0_10px_rgba(0,212,255,0.5)]'
                                        : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    Advantage
                                </button>
                                <button
                                    onClick={() => setGraphMode('gpm')}
                                    className={`px-2.5 py-1 rounded-xs transition-all cursor-pointer ${graphMode === 'gpm'
                                        ? 'bg-[#E8384F] text-white font-bold shadow-[0_0_10px_rgba(232,56,79,0.5)]'
                                        : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    GPM
                                </button>
                                <button
                                    onClick={() => setGraphMode('xpm')}
                                    className={`px-2.5 py-1 rounded-xs transition-all cursor-pointer ${graphMode === 'xpm'
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
                                <span className="text-neutral-500">ROLE COLOR-CODED TRAJECTORY</span>
                                <div className="flex gap-2">
                                    {(['all', 'radiant', 'dire'] as const).map((team) => (
                                        <button
                                            key={team}
                                            onClick={() => setTeamFilter(team)}
                                            className={`px-2 py-0.5 uppercase rounded-xs border transition-all cursor-pointer ${teamFilter === team
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
                            <div className="h-72 w-full text-[10px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={advantageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                            formatter={(value: unknown) => [
                                                Math.abs(Number(value || 0)).toLocaleString(),
                                                Number(value || 0) >= 0 ? 'Radiant advantage' : 'Dire advantage',
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
                            <div className="h-72 w-full text-[10px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={heroProgressionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#22222E" vertical={false} />
                                        <XAxis dataKey="minute" stroke="#555" tick={{ fill: '#888' }} />
                                        <YAxis stroke="#555" tick={{ fill: '#888' }} domain={[0, 'auto']} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0D0D12', borderColor: '#333' }}
                                            itemStyle={{ fontSize: '11px' }}
                                            labelFormatter={(label) => `Minute ${label}`}
                                        />
                                        {displayedPlayers.map((p) => {
                                            const color = POS_COLORS[p.role ?? ''] ?? '#C8CDD4';
                                            const dataKey = graphMode === 'gpm' ? `gpm_${p.playerSlot}` : `xpm_${p.playerSlot}`;
                                            return (
                                                <Line
                                                    key={p.playerSlot}
                                                    type="monotone"
                                                    dataKey={dataKey}
                                                    name={`${p.playerName} (${p.role || 'Pos'})`}
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

                <TowerMapGrid
                    towerRadiant={matchData.towerStatusRadiant}
                    towerDire={matchData.towerStatusDire}
                    barracksRadiant={matchData.barracksStatusRadiant}
                    barracksDire={matchData.barracksStatusDire}
                    duration={matchData.duration}
                />
            </div>

            {/* SECTION 2: SKILL BUILDS */}
            <div className="border border-[#00D4FF]/30 bg-[#111118] p-5 shadow-[0_0_25px_rgba(0,212,255,0.05)]">
                <div className="border-b border-neutral-800 pb-3 mb-6 flex items-center justify-between">
                    <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                        🧬 ABILITY & SKILL BUILDS (LEVEL 1–25)
                    </h3>
                    <span className="text-[10px] text-neutral-500 font-mono">TIMELINE UPGRADE SEQUENCE</span>
                </div>

                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="text-xs font-orbitron font-bold text-[#00D4FF] border-l-2 border-[#00D4FF] pl-2">
                            RADIANT BUILDS
                        </div>
                        <div className="space-y-3">
                            {radiantPlayers.map((p) => renderHeroBuildMatrix(p))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-neutral-800">
                        <div className="text-xs font-orbitron font-bold text-[#C9A84C] border-l-2 border-[#C9A84C] pl-2">
                            DIRE BUILDS
                        </div>
                        <div className="space-y-3">
                            {direPlayers.map((p) => renderHeroBuildMatrix(p))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}