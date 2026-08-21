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
    hasAghsScepter?: boolean;
    hasAghsShard?: boolean;
}

interface OverviewTableProps {
    players?: OverviewPlayer[];
    heroIdToImg?: Record<number, string>;
    itemIdToName?: Record<number, string>;
}

export default function OverviewTable({ players = [], heroIdToImg, itemIdToName }: OverviewTableProps) {
    const formatNum = (num?: number) => {
        if (!num && num !== 0) return '—';
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    const getItemUrl = (itemId?: number | string) => {
        if (!itemId || itemId === 0 || itemId === '0') return '';
        const name = itemIdToName?.[Number(itemId)] ?? '';
        if (!name) return '';
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${name}.png`;
    };

    return (
        <div className="overflow-x-auto border border-neutral-800 bg-[#111118] font-mono shadow-[0_0_25px_rgba(0,212,255,0.05)]">
            <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-800 bg-[#0A0A0F] font-orbitron text-[11px] text-[#00D4FF]">
                    <tr>
                        <th className="px-4 py-3">HERO</th>
                        <th className="px-4 py-3">PLAYER</th>
                        <th className="px-4 py-3 text-center">K / D / A</th>
                        <th className="px-4 py-3 text-right">NET</th>
                        <th className="px-4 py-3 text-center">LH / DN</th>
                        <th className="px-4 py-3 text-center">GPM / XPM</th>
                        <th className="px-4 py-3 text-right">DMG</th>
                        <th className="px-4 py-3 text-right">HEAL</th>
                        <th className="px-4 py-3 text-right">BLD</th>
                        <th className="px-4 py-3">ITEMS & BUFFS</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                    {players.map((p, idx) => {
                        const isRadiant = (p.playerSlot || 0) < 128;
                        const heroImg = heroIdToImg?.[p.heroId] ?? '';

                        return (
                            <tr key={idx} className="transition-colors hover:bg-neutral-800/30">
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="relative h-7 w-12 overflow-hidden border border-neutral-700 bg-neutral-900">
                                            {heroImg ? (
                                                <img
                                                    src={heroImg}
                                                    alt={p.heroName || 'hero'}
                                                    className="h-full w-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-400">
                                                    {p.heroName?.substring(0, 3).toUpperCase() || 'HER'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 font-semibold">
                                    <span className={isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}>
                                        {p.playerName}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                    <span className="text-white">{p.kills}</span> /{' '}
                                    <span className="text-rose-500 font-bold">{p.deaths}</span> /{' '}
                                    <span className="text-neutral-400">{p.assists}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold text-[#C9A84C]">
                                    {formatNum(p.netWorth)}
                                </td>
                                <td className="px-4 py-2.5 text-center text-neutral-400">
                                    {p.lastHits || 0} / {p.denies || 0}
                                </td>
                                <td className="px-4 py-2.5 text-center text-neutral-400">
                                    {p.gpm || 0} / {p.xpm || 0}
                                </td>
                                <td className="px-4 py-2.5 text-right text-neutral-300">
                                    {formatNum(p.heroDamage)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-emerald-400">
                                    {p.heroHealing && p.heroHealing > 0 ? formatNum(p.heroHealing) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right text-neutral-400">
                                    {formatNum(p.towerDamage)}
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        {/* Main 6 Items Grid */}
                                        <div className="grid grid-cols-6 gap-1 bg-black/60 p-1 border border-neutral-800 rounded-sm">
                                            {Array.from({ length: 6 }).map((_, itemIdx) => {
                                                const itemUrl = getItemUrl(p.items?.[itemIdx]);
                                                return (
                                                    <div
                                                        key={itemIdx}
                                                        className="h-5 w-7 border border-neutral-800/80 bg-[#0A0A0F] overflow-hidden flex items-center justify-center relative"
                                                    >
                                                        {itemUrl ? (
                                                            <img
                                                                src={itemUrl}
                                                                alt="item"
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLElement).style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className="h-1 w-1 rounded-full bg-neutral-800"></span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Neutral Item */}
                                        <div className="h-5 w-5 rounded-full border border-neutral-700 bg-[#0A0A0F] overflow-hidden flex items-center justify-center">
                                            {p.neutralItem && getItemUrl(p.neutralItem) ? (
                                                <img
                                                    src={getItemUrl(p.neutralItem)}
                                                    alt="neutral"
                                                    className="h-full w-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <span className="h-1.5 w-1.5 rounded-full bg-neutral-800"></span>
                                            )}
                                        </div>

                                        {/* Buffs Indicators */}
                                        <div className="flex flex-col gap-0.5 ml-1">
                                            <span
                                                title="Aghanim's Scepter"
                                                className={`text-[8px] font-bold px-1 rounded-xs border ${p.hasAghsScepter
                                                        ? 'border-[#00D4FF] bg-[#00D4FF]/20 text-[#00D4FF] shadow-[0_0_6px_#00D4FF]'
                                                        : 'border-neutral-800 text-neutral-600 bg-neutral-900/40'
                                                    }`}
                                            >
                                                S
                                            </span>
                                            <span
                                                title="Aghanim's Shard"
                                                className={`text-[8px] font-bold px-1 rounded-xs border ${p.hasAghsShard
                                                        ? 'border-[#C9A84C] bg-[#C9A84C]/20 text-[#C9A84C] shadow-[0_0_6px_#C9A84C]'
                                                        : 'border-neutral-800 text-neutral-600 bg-neutral-900/40'
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
            </table>
        </div>
    );
}