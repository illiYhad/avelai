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
    // รองรับทั้ง hasAghsScepter (เก่า) และ hasScepter (ใหม่)
    hasAghsScepter?: boolean;
    hasAghsShard?: boolean;
}

interface OverviewTableProps {
    players?: OverviewPlayer[];
    heroIdToImg?: Record<number, string>;
    itemIdToName?: Record<number, string>;
}

export default function OverviewTable({ players = [], heroIdToImg = {}, itemIdToName = {} }: OverviewTableProps) {
    const formatNum = (num?: number) => {
        if (!num && num !== 0) return '—';
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    // ── Hero image: ใช้ heroIdToImg จาก OpenDota Constants พร้อมเติม Domain ──
    const getHeroImg = (heroId: number): string => {
        const path = heroIdToImg[heroId];
        if (!path) return '';
        return path.startsWith('http') ? path : `https://cdn.cloudflare.steamstatic.com${path}`;
    };

    // ── Item image: แปลง ID → name → URL ผ่าน itemIdToName จาก OpenDota Constants ──
    const getItemUrl = (itemId?: number | string): string => {
        if (!itemId || itemId === 0 || itemId === '0') return '';
        const id = Number(itemId);
        if (isNaN(id) || id === 0) return '';
        const name = itemIdToName[id];
        if (!name) return '';
        // ตัด prefix 'item_' ออกถ้ามี
        const cleanName = name.replace(/^item_/, '');
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${cleanName}.png`;
    };

    return (
        <div className="overflow-x-auto border border-[rgba(0,212,255,0.2)] bg-[#111118] font-mono shadow-[0_0_25px_rgba(0,212,255,0.05)]">
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
                <tbody className="divide-y divide-neutral-800/60 text-[11px]">
                    {players.map((p, idx) => {
                        const isRadiant = (p.playerSlot || 0) < 128;
                        const heroImg = getHeroImg(p.heroId);
                        const hasScepter = p.hasScepter ?? p.hasAghsScepter ?? false;
                        const hasShard = p.hasShard ?? p.hasAghsShard ?? false;

                        return (
                            <tr
                                key={idx}
                                className={`transition-colors hover:bg-[rgba(0,212,255,0.04)] ${isRadiant ? 'bg-[rgba(0,212,255,0.01)]' : 'bg-[rgba(201,168,76,0.01)]'
                                    }`}
                            >
                                {/* HERO */}
                                <td className="px-4 py-2.5">
                                    <div className="h-8 w-14 overflow-hidden border border-neutral-700 bg-neutral-900">
                                        {heroImg ? (
                                            <img
                                                src={heroImg}
                                                alt={p.heroName || 'hero'}
                                                className="h-full w-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-500">
                                                {p.heroName?.substring(0, 3).toUpperCase() || '???'}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* PLAYER */}
                                <td className="px-4 py-2.5 font-semibold">
                                    <span className={isRadiant ? 'text-[#00D4FF]' : 'text-[#C9A84C]'}>
                                        {p.playerName}
                                    </span>
                                </td>

                                {/* K/D/A */}
                                <td className="px-4 py-2.5 text-center">
                                    <span className="text-white">{p.kills}</span>{' / '}
                                    <span className="font-bold text-rose-500">{p.deaths}</span>{' / '}
                                    <span className="text-neutral-400">{p.assists}</span>
                                </td>

                                {/* NET */}
                                <td className="px-4 py-2.5 text-right font-bold text-[#C9A84C]">
                                    {formatNum(p.netWorth)}
                                </td>

                                {/* LH/DN */}
                                <td className="px-4 py-2.5 text-center text-neutral-400">
                                    {p.lastHits || 0} / {p.denies || 0}
                                </td>

                                {/* GPM/XPM */}
                                <td className="px-4 py-2.5 text-center text-neutral-400">
                                    {p.gpm || 0} / {p.xpm || 0}
                                </td>

                                {/* DMG */}
                                <td className="px-4 py-2.5 text-right text-neutral-300">
                                    {formatNum(p.heroDamage)}
                                </td>

                                {/* HEAL */}
                                <td className="px-4 py-2.5 text-right text-emerald-400">
                                    {p.heroHealing && p.heroHealing > 0 ? formatNum(p.heroHealing) : '—'}
                                </td>

                                {/* BLD */}
                                <td className="px-4 py-2.5 text-right text-neutral-400">
                                    {formatNum(p.towerDamage)}
                                </td>

                                {/* ITEMS & BUFFS */}
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        {/* 6 Main Items */}
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

                                        {/* Neutral Item */}
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

                                        {/* Aghanim's Scepter (S) + Shard (D) */}
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
            </table>
        </div>
    );
}