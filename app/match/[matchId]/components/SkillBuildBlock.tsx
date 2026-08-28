'use client';

import React from 'react';
import { getHeroImageUrl, getItemImageUrl, HERO_ID_TO_NAME } from '@/lib/dotaAssets';

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

export default function SkillBuildBlock({ players = [], heroIdToImg = {}, itemIdToName = {} }: any) {
    const sortedPlayers = [...players].sort((a, b) => (a.playerSlot || 0) - (b.playerSlot || 0));
    const radiantPlayers = sortedPlayers.filter((p) => (p.playerSlot || 0) < 128);
    const direPlayers = sortedPlayers.filter((p) => (p.playerSlot || 0) >= 128);

    const getHeroImg = (heroId: number, heroName?: string) => {
        const path = heroIdToImg[heroId];
        if (path) {
            return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
        }
        return getHeroImageUrl(heroName, heroId);
    };

    const getHeroDisplayName = (heroId?: number, heroName?: string): string => {
        if (heroId && HERO_DATA_MAP[heroId]) return HERO_DATA_MAP[heroId].name;
        if (heroId && HERO_ID_TO_NAME[heroId]) {
            return HERO_ID_TO_NAME[heroId]
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }
        if (heroName && !heroName.startsWith('hero_')) {
            return heroName.replace(/npc_dota_hero_|_/g, ' ').trim();
        }
        return heroId ? `Hero ${heroId}` : 'Hero';
    };

    const getItemImg = (itemId?: number | string) => {
        if (!itemId || itemId === 0 || itemId === '0') return '';
        const id = Number(itemId);
        if (!isNaN(id) && id > 0 && itemIdToName[id]) {
            const cleanName = itemIdToName[id].replace(/^item_/, '');
            return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${cleanName}.png`;
        }
        return getItemImageUrl(itemId);
    };

    const renderHeroBuildMatrix = (p: any) => {
        const isRadiant = (p.playerSlot || 0) < 128;
        const teamColor = isRadiant ? '#00D4FF' : '#C9A84C';
        const levels = Array.from({ length: 25 }, (_, i) => i + 1);
        const posColor = POS_COLORS[p.role] ?? '#C8CDD4';
        const heroImg = getHeroImg(p.heroId, p.heroName);
        const heroDisplayName = getHeroDisplayName(p.heroId, p.heroName);
        const abilityDetails = HERO_ABILITY_DETAILS[p.heroId] || [];

        const abilitySlots = [
            { slot: 'Q', name: abilityDetails[0]?.name || 'Ability 1 (Q)', img: abilityDetails[0]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[0].key}.png` : null },
            { slot: 'W', name: abilityDetails[1]?.name || 'Ability 2 (W)', img: abilityDetails[1]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[1].key}.png` : null },
            { slot: 'E', name: abilityDetails[2]?.name || 'Ability 3 (E)', img: abilityDetails[2]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[2].key}.png` : null },
            { slot: 'R', name: abilityDetails[3]?.name || 'Ultimate (R)', img: abilityDetails[3]?.key ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${abilityDetails[3].key}.png` : null },
            { slot: 'T', name: 'Talent Tree', isTalent: true, img: null },
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
            <div key={p.playerSlot} className="border border-neutral-800 bg-[#0E0E14] p-4 rounded-xs space-y-3 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/80 pb-3">
                    <div className="flex items-center gap-3">
                        {/* Hero Avatar with CI Glow */}
                        <div
                            className="h-10 w-16 overflow-hidden rounded-xs bg-neutral-900 border shrink-0 transition-transform hover:scale-105"
                            style={{
                                borderColor: `${teamColor}80`,
                                boxShadow: `0 0 8px ${teamColor}30`,
                            }}
                        >
                            {heroImg ? (
                                <img
                                    src={heroImg}
                                    alt={heroDisplayName}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">???</span>
                            )}
                        </div>
                        <div>
                            <div className="font-orbitron text-xs font-bold text-white flex items-center gap-2">
                                <span style={{ color: teamColor }}>{p.playerName}</span>
                                <span className="text-neutral-300 font-semibold tracking-wide text-[11px]">— {heroDisplayName}</span>
                                <span className="rounded-xs px-1.5 py-0.5 text-[9px] font-bold" style={{ color: posColor, border: `1px solid ${posColor}40`, background: `${posColor}15` }}>
                                    {p.role || 'Pos —'}
                                </span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400">
                                {isRadiant ? 'RADIANT' : 'DIRE'} LEVEL {p.level || 25}
                            </div>
                        </div>
                    </div>

                    {/* Inventory Item Slots */}
                    <div className="flex items-center gap-1 bg-[#07070C] p-1 border border-neutral-800 rounded-xs">
                        {heroItems.map((itemId, i) => {
                            const itemUrl = getItemImg(itemId);
                            return (
                                <div key={i} className="h-7 w-10 border border-neutral-800 bg-neutral-900 overflow-hidden flex items-center justify-center rounded-2xs">
                                    {itemUrl ? (
                                        <img src={itemUrl} alt="item" className="h-full w-full object-cover" />
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
                                <div key={lvl} className={`font-semibold ${[6, 12, 18, 10, 15, 20, 25].includes(lvl) ? 'text-[#00D4FF]' : ''}`}>{lvl}</div>
                            ))}
                        </div>
                        <div className="space-y-1">
                            {abilitySlots.map((slot, sIdx) => (
                                <div key={sIdx} className="grid grid-cols-[130px_repeat(25,1fr)] items-center gap-1">
                                    <div title={slot.name} className="flex h-7 items-center gap-1.5 border border-neutral-800 bg-[#161622] px-1 overflow-hidden rounded-2xs">
                                        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden border border-neutral-700 bg-neutral-900">
                                            {slot.isTalent ? (<span className="text-[10px]">🌳</span>) : slot.img ? (
                                                <img src={slot.img} alt={slot.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                            ) : (<span className="text-[8px] font-bold text-neutral-400">{slot.slot}</span>)}
                                        </div>
                                        <span className="truncate text-[9px] font-bold text-neutral-300">{slot.name}</span>
                                    </div>
                                    {levels.map((lvl) => {
                                        const isLearned = buildMap[lvl] === sIdx;
                                        return (
                                            <div key={lvl} className={`flex h-7 items-center justify-center border text-[10px] font-bold transition-all ${isLearned
                                                    ? slot.isTalent ? 'border-yellow-500/60 bg-yellow-500/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.2)]'
                                                        : sIdx === 3 ? 'border-[#E8384F]/80 bg-[#E8384F]/20 text-[#E8384F] shadow-[0_0_8px_rgba(232,56,79,0.3)]'
                                                        : 'border-[#00D4FF]/60 bg-[#00D4FF]/20 text-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.2)]'
                                                    : 'border-neutral-900 bg-[#0A0A10]/60 text-transparent'
                                                }`}>
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

    return (
        <div className="border border-[#00D4FF]/30 bg-[#111118] p-5 shadow-[0_0_25px_rgba(0,212,255,0.05)] mt-8">
            <div className="border-b border-neutral-800 pb-3 mb-6 flex items-center justify-between">
                <h3 className="font-orbitron text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                    🧬 ABILITY & SKILL BUILDS (LEVEL 1–25)
                </h3>
                <span className="text-[10px] text-neutral-500 font-mono">// TIMELINE UPGRADE SEQUENCE</span>
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
    );
}