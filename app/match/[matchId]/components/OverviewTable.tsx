/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';

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
    items: (number | string)[];
    neutralItem?: number | string;
    hasScepter?: boolean;
    hasShard?: boolean;
    hasAghsScepter?: boolean;
    hasAghsShard?: boolean;
}

interface DraftEntry {
    is_pick: boolean;
    hero_id: number;
    team: number; // 0 = radiant, 1 = dire
    order: number;
}

interface OverviewTableProps {
    players?: OverviewPlayer[];
    heroIdToImg?: Record<number, string>;
    itemIdToName?: Record<number, string>;
    draftTimeline?: DraftEntry[];
    radiantWin?: boolean;
}

const HERO_NAME_MAP: Record<number, string> = {
    1: 'Anti-Mage',
    2: 'Axe',
    6: 'Drow Ranger',
    14: 'Pudge',
    22: 'Zeus',
    74: 'Invoker',
    76: 'Outworld Destroyer',
    84: 'Ogre Magi',
    90: 'Keeper of the Light',
    93: 'Slark',
    96: 'Centaur Warrunner',
    121: 'Grimstroke',
    137: 'Primal Beast',
};

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

    const getHeroImg = (heroId: number): string => {
        const path = heroIdToImg[heroId];
        if (!path) return '';
        return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
    };

    const getItemUrl = (itemId?: number | string): string => {
        if (!itemId || itemId === 0 || itemId === '0') return '';
        const id = Number(itemId);
        if (isNaN(id) || id === 0) return '';
        const name = itemIdToName[id];
        if (!name) return '';
        const cleanName = name.replace(/^item_/, '');
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${cleanName}.png`;
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
                                const heroImg = getHeroImg(p.heroId);
                                const heroName = HERO_NAME_MAP[p.heroId] || p.heroName || `Hero ${p.heroId}`;
                                const hasScepter = p.hasScepter ?? p.hasAghsScepter ?? false;
                                const hasShard = p.hasShard ?? p.hasAghsShard ?? false;

                                return (
                                    <tr key={idx} className="transition-colors hover:bg-white/2">
                                        <td className="px-4 py-2 flex items-center gap-3">
                                            <div className="h-8 w-14 overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0">
                                                {heroImg ? (
                                                    <img
                                                        src={heroImg}
                                                        alt={heroName}
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-500">???</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white tracking-wide">{p.playerName}</span>
                                                <span className="text-[10px] text-neutral-400 font-sans">{heroName}</span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-2 text-center">
                                            <span className="text-white">{p.kills}</span>{' / '}
                                            <span className="font-bold text-rose-500">{p.deaths}</span>{' / '}
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
                                            <div className="flex items-center gap-1.5">
                                                <div className="grid grid-cols-6 gap-0.5 border border-neutral-800 bg-black/60 p-0.5">
                                                    {Array.from({ length: 6 }).map((_, itemIdx) => {
                                                        const itemUrl = getItemUrl(p.items?.[itemIdx]);
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
                                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                    />
                                                                ) : (
                                                                    <span className="h-1 w-1 rounded-full bg-neutral-800" />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-[#0A0A0F]">
                                                    {getItemUrl(p.neutralItem) ? (
                                                        <img
                                                            src={getItemUrl(p.neutralItem)}
                                                            alt="neutral"
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-800" />
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-0.5">
                                                    <span
                                                        title="Aghanim's Scepter"
                                                        className={`px-1 text-[8px] font-bold rounded-sm border ${hasScepter
                                                                ? 'border-[#00D4FF] bg-[#00D4FF]/20 text-[#00D4FF] shadow-[0_0_6px_#00D4FF]'
                                                                : 'border-neutral-800 bg-neutral-900/40 text-neutral-700'
                                                            }`}
                                                    >
                                                        S
                                                    </span>
                                                    <span
                                                        title="Aghanim's Shard"
                                                        className={`px-1 text-[8px] font-bold rounded-sm border ${hasShard
                                                                ? 'border-[#C9A84C] bg-[#C9A84C]/20 text-[#C9A84C] shadow-[0_0_6px_#C9A84C]'
                                                                : 'border-neutral-800 bg-neutral-900/40 text-neutral-700'
                                                            }`}
                                                    >
                                                        D
                                                    </span>
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
                                    {summary.kills} / <span className="text-rose-500">{summary.deaths}</span> / {summary.assists}
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

    const renderDraftRow = (title: string, drafts: DraftEntry[], colorHex: string) => {
        const picks = drafts.filter((d) => d.is_pick).sort((a, b) => a.order - b.order);
        const bans = drafts.filter((d) => !d.is_pick).sort((a, b) => a.order - b.order);

        const renderDraftBadge = (draft: DraftEntry, idx: number) => {
            const heroImg = getHeroImg(draft.hero_id);
            const heroName = HERO_NAME_MAP[draft.hero_id] || `Hero ${draft.hero_id}`;
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

        return (
            <div className="flex flex-wrap items-center gap-3 py-1.5">
                <span className="font-orbitron font-bold text-[10px] w-28 shrink-0 tracking-wider" style={{ color: colorHex }}>
                    {title}:
                </span>

                <div className="flex flex-wrap items-center gap-2.5">
                    {picks.length > 0 ? (
                        picks.map((draft, idx) => renderDraftBadge(draft, idx))
                    ) : (
                        <span className="text-[10px] text-neutral-600 font-mono">NO PICK DATA</span>
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
                    DRAFT PICKS & BANS TIMELINE
                </div>
                {renderDraftRow('RADIANT DRAFT', radiantDrafts, '#00D4FF')}
                {renderDraftRow('DIRE DRAFT', direDrafts, '#C9A84C')}
            </div>

            {renderTeamTable(direPlayers, false)}
        </div>
    );
}