import React from 'react';
import Image from 'next/image';

export interface PlayerOverviewData {
    playerSlot: number;
    heroId: number;
    heroName: string;
    playerName: string;
    isRegisteredUser: boolean;
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
    items: string[]; // array ของ item names เช่น ['blink', 'bkb', ...]
    neutralItem?: string;
    hasScepter: boolean;
    hasShard: boolean;
}

interface OverviewTableProps {
    players: PlayerOverviewData[];
}

export default function OverviewTable({ players }: OverviewTableProps) {
    const formatNumber = (num: number) => {
        return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num.toString();
    };

    return (
        <div className="space-y-4 font-mono text-xs">
            <div className="overflow-x-auto border border-[#00D4FF]/30 bg-[#111118]">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="border-b border-[#00D4FF]/30 bg-[#0A0A0F] font-orbitron text-[11px] text-[#00D4FF]">
                            <th className="p-3">HERO</th>
                            <th className="p-3">PLAYER</th>
                            <th className="p-3 text-center">K / D / A</th>
                            <th className="p-3 text-right">NET</th>
                            <th className="p-3 text-center">LH / DN</th>
                            <th className="p-3 text-center">GPM / XPM</th>
                            <th className="p-3 text-right">DMG</th>
                            <th className="p-3 text-right">HEAL</th>
                            <th className="p-3 text-right">BLD</th>
                            <th className="p-3">ITEMS & BUFFS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {players.map((player) => {
                            const isRadiant = player.playerSlot < 128;

                            return (
                                <tr
                                    key={player.playerSlot}
                                    className={`transition-colors hover:bg-cyan-900/20 hover:border-l-2 hover:border-l-[#00D4FF] ${isRadiant ? 'bg-[#00D4FF]/[0.02]' : 'bg-[#C9A84C]/[0.02]'
                                        } ${player.isRegisteredUser
                                            ? 'shadow-[inset_0_0_12px_rgba(0,212,255,0.15)] border-l-2 border-l-[#00D4FF]'
                                            : ''
                                        }`}
                                >
                                    {/* Hero */}
                                    <td className="p-3 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-400 font-bold">
                                            {player.heroName.substring(0, 3).toUpperCase()}
                                        </div>
                                    </td>

                                    {/* Player Name */}
                                    <td className="p-3">
                                        <span
                                            className={`font-medium ${player.isRegisteredUser ? 'text-[#00D4FF] font-bold' : 'text-neutral-300'
                                                }`}
                                        >
                                            {player.playerName}
                                        </span>
                                    </td>

                                    {/* K / D / A */}
                                    <td className="p-3 text-center text-neutral-300">
                                        {player.kills} / <span className="text-red-400">{player.deaths}</span> / {player.assists}
                                    </td>

                                    {/* Net Worth */}
                                    <td className="p-3 text-right font-bold text-[#C9A84C]">
                                        {formatNumber(player.netWorth)}
                                    </td>

                                    {/* LH / DN */}
                                    <td className="p-3 text-center text-neutral-400">
                                        {player.lastHits} / {player.denies}
                                    </td>

                                    {/* GPM / XPM */}
                                    <td className="p-3 text-center text-neutral-400">
                                        {player.gpm} / {player.xpm}
                                    </td>

                                    {/* Hero Damage */}
                                    <td className="p-3 text-right text-neutral-300">
                                        {formatNumber(player.heroDamage)}
                                    </td>

                                    {/* Hero Healing */}
                                    <td className="p-3 text-right text-emerald-400">
                                        {player.heroHealing > 0 ? formatNumber(player.heroHealing) : '—'}
                                    </td>

                                    {/* Building Damage */}
                                    <td className="p-3 text-right text-neutral-300">
                                        {player.towerDamage > 0 ? formatNumber(player.towerDamage) : '—'}
                                    </td>

                                    {/* Items + Neutral + Scepter / Shard */}
                                    <td className="p-3">
                                        <div className="flex items-center gap-1.5">
                                            {/* Main 6 Items */}
                                            <div className="grid grid-cols-6 gap-1 bg-black/40 p-1 border border-neutral-800">
                                                {Array.from({ length: 6 }).map((_, i) => {
                                                    const itemName = player.items[i];
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="w-6 h-4 bg-neutral-900 border border-neutral-800 flex items-center justify-center"
                                                        >
                                                            {itemName ? (
                                                                <img
                                                                    src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemName}.png`}
                                                                    alt={itemName}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Neutral Item */}
                                            <div className="w-5 h-5 rounded-full border border-[#C9A84C]/50 bg-neutral-900 flex items-center justify-center overflow-hidden">
                                                {player.neutralItem ? (
                                                    <img
                                                        src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${player.neutralItem}.png`}
                                                        alt="neutral"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-[8px] text-neutral-600">N</span>
                                                )}
                                            </div>

                                            {/* Aghanim's Scepter & Shard Glow Icons */}
                                            <div className="flex flex-col gap-0.5">
                                                <span
                                                    title="Aghanim's Scepter"
                                                    className={`text-[9px] px-1 font-bold border transition-all ${player.hasScepter
                                                        ? 'border-[#00D4FF] bg-[#00D4FF]/20 text-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.6)]'
                                                        : 'border-neutral-800 bg-neutral-950 text-neutral-700'
                                                        }`}
                                                >
                                                    S
                                                </span>
                                                <span
                                                    title="Aghanim's Shard"
                                                    className={`text-[9px] px-1 font-bold border transition-all ${player.hasShard
                                                        ? 'border-[#C9A84C] bg-[#C9A84C]/20 text-[#C9A84C] shadow-[0_0_8px_rgba(201,168,76,0.6)]'
                                                        : 'border-neutral-800 bg-neutral-950 text-neutral-700'
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
        </div>
    );
}