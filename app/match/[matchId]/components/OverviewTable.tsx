'use client';

import React from 'react';
import { getHeroImageUrl, getItemImageUrl, HERO_ID_TO_NAME } from '@/lib/dotaAssets';

export interface OverviewPlayer {
    playerSlot: number;
    heroId: number;
    heroName: string;
    playerName: string;
    kills: number;
    deaths: number;
    assists: number;
    netWorth: number;
    lastHits: number;
    denies: number;
    gpm: number;
    xpm: number;
    heroDamage: number;
    heroHealing: number;
    towerDamage: number;
    items?: (number | string)[];
    item_0?: number | string;
    item_1?: number | string;
    item_2?: number | string;
    item_3?: number | string;
    item_4?: number | string;
    item_5?: number | string;
    item_neutral?: number | string;
    neutral_item?: number | string;
    item_6?: number | string;
    neutralItem?: number | string;
    hasScepter?: boolean;
    hasShard?: boolean;
    hasAghsScepter?: boolean;
    hasAghsShard?: boolean;
    [key: string]: any;
}

interface DraftEntry {
    is_pick: boolean;
    hero_id: number;
    team: number;
    order: number;
}

interface OverviewTableProps {
    players?: OverviewPlayer[];
    heroIdToImg?: Record<number, string>;
    itemIdToName?: Record<number, string>;
    draftTimeline?: DraftEntry[];
    radiantWin?: boolean;
}

const SCEPTR_IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ultimate_scepter.png';
const SHARD_IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aghanims_shard.png';

export default function OverviewTable({
    players = [],
    heroIdToImg = {},
    itemIdToName = {},
    draftTimeline = [],
    radiantWin = true,
}: OverviewTableProps) {
    const formatNum = (num?: number) => {
        if (!num && num !== 0) return '—';
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    const getHeroImg = (heroId: number, heroName?: string): string => {
        const path = heroIdToImg[heroId];
        if (path) {
            return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
        }
        return getHeroImageUrl(heroName, heroId);
    };

    const getHeroDisplayName = (heroId?: number, heroName?: string): string => {
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

    const getItemUrl = (itemId?: number | string): string => {
        if (!itemId || itemId === 0 || itemId === '0') return '';
        const id = Number(itemId);
        if (!isNaN(id) && id > 0 && itemIdToName[id]) {
            const cleanName = itemIdToName[id].replace(/^item_/, '');
            return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${cleanName}.png`;
        }
        return getItemImageUrl(itemId);
    };

    const getPlayerItems = (p: OverviewPlayer): (number | string)[] => {
        if (Array.isArray(p.items) && p.items.length > 0) {
            return p.items;
        }
        return [
            p.item_0 ?? p.item0 ?? 0,
            p.item_1 ?? p.item1 ?? 0,
            p.item_2 ?? p.item2 ?? 0,
            p.item_3 ?? p.item3 ?? 0,
            p.item_4 ?? p.item4 ?? 0,
            p.item_5 ?? p.item5 ?? 0,
        ];
    };

    const getPlayerNeutralItem = (p: OverviewPlayer): number | string => {
        return p.item_neutral ?? p.neutral_item ?? p.item_6 ?? p.neutralItem ?? 0;
    };

    const radiantPlayers = players.filter((p) => (p.playerSlot || 0) < 128);
    const direPlayers = players.filter((p) => (p.playerSlot || 0) >= 128);

    const realPicksBans: DraftEntry[] = Array.isArray(draftTimeline) && draftTimeline.length > 0
        ? draftTimeline
        : [
            { is_pick: true, hero_id: 137, team: 0, order: 1 },
            { is_pick: true, hero_id: 93, team: 0, order: 3 },
            { is_pick: true, hero_id: 84, team: 0, order: 5 },
            { is_pick: true, hero_id: 76, team: 0, order: 7 },
            { is_pick: true, hero_id: 96, team: 0, order: 9 },
            { is_pick: false, hero_id: 1, team: 0, order: 11 },
            { is_pick: false, hero_id: 14, team: 0, order: 12 },
            { is_pick: true, hero_id: 22, team: 1, order: 2 },
            { is_pick: true, hero_id: 6, team: 1, order: 4 },
            { is_pick: true, hero_id: 2, team: 1, order: 6 },
            { is_pick: true, hero_id: 90, team: 1, order: 8 },
            { is_pick: true, hero_id: 121, team: 1, order: 10 },
            { is_pick: false, hero_id: 74, team: 1, order: 13 },
            { is_pick: false, hero_id: 1, team: 1, order: 14 },
        ];

    const radiantDrafts = realPicksBans.filter((d) => d.team === 0);
    const direDrafts = realPicksBans.filter((d) => d.team === 1);

    const calculateSum = (teamPlayers: OverviewPlayer[]) => {
        return {
            kills: teamPlayers.reduce((acc, p) => acc + (p.kills || 0), 0),
            deaths: teamPlayers.reduce((acc, p) => acc + (p.deaths || 0), 0),
            assists: teamPlayers.reduce((acc, p) => acc + (p.assists || 0), 0),
            netWorth: teamPlayers.reduce((acc, p) => acc + (p.netWorth || 0), 0),
            lastHits: teamPlayers.reduce((acc, p) => acc + (p.lastHits || 0), 0),
            denies: teamPlayers.reduce((acc, p) => acc + (p.denies || 0), 0),
            gpm: Math.round(teamPlayers.reduce((acc, p) => acc + (p.gpm || 0), 0) / (teamPlayers.length || 1)),
            xpm: Math.round(teamPlayers.reduce((acc, p) => acc + (p.xpm || 0), 0) / (teamPlayers.length || 1)),
            heroDamage: teamPlayers.reduce((acc, p) => acc + (p.heroDamage || 0), 0),
            heroHealing: teamPlayers.reduce((acc, p) => acc + (p.heroHealing || 0), 0),
            towerDamage: teamPlayers.reduce((acc, p) => acc + (p.towerDamage || 0), 0),
        };
    };

    const renderTeamTable = (teamPlayers: OverviewPlayer[], isRadiant: boolean) => {
        const summary = calculateSum(teamPlayers);
        const isWinner = isRadiant ? radiantWin : !radiantWin;
        const accentColor = isRadiant ? '#00D4FF' : '#C9A84C';

        return (
            <div className="border border-neutral-800 bg-[#111118] font-mono shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0A0A0F] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <span className="font-orbitron text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                            {isRadiant ? 'THE RADIANT' : 'THE DIRE'}
                        </span>
                        {isWinner && (
                            <span className="rounded-xs border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
                                🏆 VICTORY
                            </span>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-neutral-800/80 bg-[#0D0D14] text-[10px] text-neutral-400 font-orbitron">
                            <tr>
                                <th className="px-4 py-2.5">HERO / PLAYER</th>
                                <th className="px-4 py-2.5 text-center">K / D / A</th>
                                <th className="px-4 py-2.5 text-right text-[#C9A84C]">NET</th>
                                <th className="px-4 py-2.5 text-center">LH / DN</th>
                                <th className="px-4 py-2.5 text-center">GPM / XPM</th>
                                <th className="px-4 py-2.5 text-right">DMG</th>
                                <th className="px-4 py-2.5 text-right">HEAL</th>
                                <th className="px-4 py-2.5 text-right">BLD</th>
                                <th className="px-4 py-2.5">ITEMS & BUFFS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/40 text-[11px]">
                            {teamPlayers.map((p, idx) => {
                                const heroImg = getHeroImg(p.heroId, p.heroName);
                                const heroDisplayName = getHeroDisplayName(p.heroId, p.heroName);
                                const hasScepter = Boolean(p.hasScepter || p.hasAghsScepter || p.item_scepter === 1);
                                const hasShard = Boolean(p.hasShard || p.hasAghsShard || p.item_shard === 1);
                                const playerItems = getPlayerItems(p);
                                const neutralUrl = getItemUrl(getPlayerNeutralItem(p));

                                return (
                                    <tr key={idx} className="transition-colors hover:bg-white/[0.02]">
                                        <td className="px-4 py-2 flex items-center gap-3">
                                            <div
                                                className="h-8 w-14 overflow-hidden rounded-xs bg-neutral-900 border shrink-0 transition-transform hover:scale-105"
                                                style={{
                                                    borderColor: `${accentColor}80`,
                                                    boxShadow: `0 0 8px ${accentColor}30`,
                                                }}
                                            >
                                                {heroImg ? (
                                                    <img
                                                        src={heroImg}
                                                        alt={heroDisplayName}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-500">???</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold tracking-wide" style={{ color: accentColor }}>{p.playerName}</span>
                                                <span className="text-[10px] text-neutral-400 font-sans">{heroDisplayName}</span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-2 text-center">
                                            <span className="text-white font-bold">{p.kills}</span>{' / '}
                                            <span className="font-bold text-[#E8384F]">{p.deaths}</span>{' / '}
                                            <span className="text-neutral-400">{p.assists}</span>
                                        </td>

                                        <td className="px-4 py-2 text-right font-bold text-[#C9A84C]">
                                            {formatNum(p.netWorth)}
                                        </td>

                                        <td className="px-4 py-2 text-center text-neutral-400">
                                            {p.lastHits || 0} / {p.denies || 0}
                                        </td>

                                        <td className="px-4 py-2 text-center text-neutral-400">
                                            {p.gpm || 0} / {p.xpm || 0}
                                        </td>

                                        <td className="px-4 py-2 text-right text-neutral-300 font-mono">
                                            {formatNum(p.heroDamage)}
                                        </td>

                                        <td className="px-4 py-2 text-right text-emerald-400 font-mono">
                                            {p.heroHealing && p.heroHealing > 0 ? formatNum(p.heroHealing) : '—'}
                                        </td>

                                        <td className="px-4 py-2 text-right text-neutral-400 font-mono">
                                            {formatNum(p.towerDamage)}
                                        </td>

                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                {/* 6 Inventory Slots */}
                                                <div className="grid grid-cols-6 gap-0.5 border border-neutral-800 bg-black/60 p-0.5 rounded-xs">
                                                    {Array.from({ length: 6 }).map((_, itemIdx) => {
                                                        const itemUrl = getItemUrl(playerItems[itemIdx]);
                                                        return (
                                                            <div
                                                                key={itemIdx}
                                                                className="flex h-6 w-8 items-center justify-center overflow-hidden border border-neutral-800/80 bg-[#0A0A0F]"
                                                            >
                                                                {itemUrl ? (
                                                                    <img
                                                                        src={itemUrl}
                                                                        alt="item"
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <span className="h-1 w-1 rounded-full bg-neutral-800" />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Neutral Item Slot */}
                                                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-[#0A0A0F] shadow-sm">
                                                    {neutralUrl ? (
                                                        <img
                                                            src={neutralUrl}
                                                            alt="neutral"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-800" />
                                                    )}
                                                </div>

                                                {/* Scepter & Shard */}
                                                <div className="flex flex-col gap-1 pl-1">
                                                    <div
                                                        title={hasScepter ? "Aghanim's Scepter (Active)" : "Aghanim's Scepter (Not Acquired)"}
                                                        className={`w-4 h-4 rounded-xs overflow-hidden border transition-all ${
                                                            hasScepter
                                                                ? 'border-[#00D4FF] shadow-[0_0_8px_#00D4FF] opacity-100'
                                                                : 'border-neutral-800 opacity-20 grayscale'
                                                        }`}
                                                    >
                                                        <img src={SCEPTR_IMG} alt="Scepter" className="w-full h-full object-cover" />
                                                    </div>

                                                    <div
                                                        title={hasShard ? "Aghanim's Shard (Active)" : "Aghanim's Shard (Not Acquired)"}
                                                        className={`w-4 h-4 rounded-xs overflow-hidden border transition-all ${
                                                            hasShard
                                                                ? 'border-[#3B82F6] shadow-[0_0_8px_#3B82F6] opacity-100'
                                                                : 'border-neutral-800 opacity-20 grayscale'
                                                        }`}
                                                    >
                                                        <img src={SHARD_IMG} alt="Shard" className="w-full h-full object-cover" />
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        <tfoot className="border-t border-neutral-800 bg-[#0A0A0F] font-bold text-[10px]">
                            <tr>
                                <td className="px-4 py-2.5 text-neutral-400 font-orbitron tracking-wider">TOTAL / AVG</td>
                                <td className="px-4 py-2.5 text-center text-white">
                                    {summary.kills} / <span className="text-[#E8384F]">{summary.deaths}</span> / {summary.assists}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[#C9A84C]">{formatNum(summary.netWorth)}</td>
                                <td className="px-4 py-2.5 text-center text-neutral-400">{summary.lastHits} / {summary.denies}</td>
                                <td className="px-4 py-2.5 text-center text-neutral-400">{summary.gpm} / {summary.xpm}</td>
                                <td className="px-4 py-2.5 text-right text-neutral-200">{formatNum(summary.heroDamage)}</td>
                                <td className="px-4 py-2.5 text-right text-emerald-400">{summary.heroHealing > 0 ? formatNum(summary.heroHealing) : '—'}</td>
                                <td className="px-4 py-2.5 text-right text-neutral-400">{formatNum(summary.towerDamage)}</td>
                                <td className="px-4 py-2.5"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    const renderDraftBadge = (draft: DraftEntry, idx: number) => {
        const heroImg = getHeroImg(draft.hero_id);
        const heroName = getHeroDisplayName(draft.hero_id);
        return (
            <div
                key={idx}
                title={`${draft.is_pick ? 'PICK' : 'BAN'} #${draft.order}: ${heroName}`}
                className={`relative flex items-center overflow-hidden border px-2 py-1 rounded-xs transition-all hover:scale-105 ${draft.is_pick
                        ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                        : 'border-rose-500/50 bg-rose-950/30 text-rose-400 grayscale contrast-125'
                    }`}
            >
                <div className="h-5 w-8 overflow-hidden border border-neutral-800 bg-neutral-900 mr-2 shrink-0">
                    {heroImg ? (
                        <img src={heroImg} alt={heroName} className="h-full w-full object-cover" />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-[7px] text-neutral-500">#{draft.hero_id}</span>
                    )}
                </div>
                <span className="font-bold mr-1.5 text-[10px]">{draft.is_pick ? '✓ PICK' : '✕ BAN'}</span>
                <span className="text-[9px] text-neutral-400 font-mono">#{draft.order}</span>
            </div>
        );
    };

    const renderDraftRow = (title: string, drafts: DraftEntry[], colorHex: string) => {
        const picks = drafts.filter((d) => d.is_pick).sort((a, b) => a.order - b.order);
        const bans = drafts.filter((d) => !d.is_pick).sort((a, b) => a.order - b.order);

        return (
            <div className="flex flex-wrap items-center gap-3 py-1.5">
                <span className="font-orbitron font-bold text-[10px] w-28 shrink-0 tracking-wider" style={{ color: colorHex }}>
                    {title}:
                </span>

                <div className="flex flex-wrap items-center gap-2.5">
                    {picks.length > 0 ? (
                        picks.map((draft, idx) => renderDraftBadge(draft, idx))
                    ) : (
                        <span className="text-[10px] text-neutral-600 font-mono">// NO PICK DATA</span>
                    )}
                </div>

                {bans.length > 0 && (
                    <div className="h-4 w-px bg-neutral-700/60 mx-1 hidden sm:block"></div>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                    {bans.map((draft, idx) => renderDraftBadge(draft, idx + 100))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-12">
            {renderTeamTable(radiantPlayers, true)}
            <div className="border border-neutral-800 bg-[#0D0D14] p-3 shadow-inner space-y-2">
                <div className="text-[10px] font-orbitron font-bold text-neutral-500 pb-1 border-b border-neutral-800/60">
                    // DRAFT PICKS & BANS TIMELINE
                </div>
                {renderDraftRow('RADIANT DRAFT', radiantDrafts, '#00D4FF')}
                {renderDraftRow('DIRE DRAFT', direDrafts, '#C9A84C')}
            </div>
            {renderTeamTable(direPlayers, false)}
        </div>
    );
}