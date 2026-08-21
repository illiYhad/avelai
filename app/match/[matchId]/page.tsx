import React from 'react';
import MatchHeader from './components/MatchHeader';
import MatchDetailView from './components/MatchDetailView';

// นำเข้าฟังก์ชันดึง Constants จาก OpenDota
import { getHeroIdToImgMap } from '@/lib/dota/getHeroes';
import { getItemIdToNameMap } from '@/lib/dota/getItems';

const ROLE_MAP: Record<number, string> = {
    0: 'Pos 1',
    1: 'Pos 2',
    2: 'Pos 3',
    3: 'Pos 4',
    4: 'Pos 5',
    128: 'Pos 1',
    129: 'Pos 2',
    130: 'Pos 3',
    131: 'Pos 4',
    132: 'Pos 5',
};

const FALLBACK_MATCH = {
    matchId: '8956631986',
    radiantWin: true,
    duration: 2533,
    radiantScore: 47,
    direScore: 43,
    radiantTowersKilled: 9,
    direTowersKilled: 4,
    towerStatusRadiant: 1844,
    towerStatusDire: 0,
    barracksStatusRadiant: 63,
    barracksStatusDire: 0,
    radiantGoldAdv: [0, 200, -500, -1200, 400, 1500, 3200, 4800, 5200, 7800],
    radiantXpAdv: [0, 100, -200, -800, 600, 2100, 4500, 6000, 6800, 9500],
    kpPlayers: [],
    overviewPlayers: [],
    performancePlayers: [],
};

export default async function MatchDetailPage({
    params,
}: {
    params: Promise<{ matchId: string }>;
}) {
    const { matchId } = await params;

    let heroIdToImg: Record<number, string> = {};
    let itemIdToName: Record<number, string> = {};
    let matchData: any = FALLBACK_MATCH;

    try {
        const [res, heroesDict, itemsDict] = await Promise.all([
            fetch(`https://api.opendota.com/api/matches/${matchId}`, {
                next: { revalidate: 3600 },
            }),
            getHeroIdToImgMap(),
            getItemIdToNameMap(),
        ]);

        heroIdToImg = heroesDict || {};
        itemIdToName = itemsDict || {};

        if (res.ok) {
            const raw = await res.json();
            if (raw && raw.players) {
                const radiantPlayers = raw.players.filter((p: any) => p.player_slot < 128);
                const direPlayers = raw.players.filter((p: any) => p.player_slot >= 128);

                const processed = raw.players.map((p: any, idx: number) => {
                    const isRadiant = p.player_slot < 128;
                    const isWin = isRadiant ? raw.radiant_win : !raw.radiant_win;
                    const baseKp = Math.max(
                        -10,
                        p.kills * 1.0 - p.deaths * 0.5 + p.assists * 0.3 + (p.tower_kills || 0) * 2.0
                    );
                    const resultMultiplier = isWin ? 1.0 : 0.5;
                    const roleBonus = 1.5;
                    const totalKp = baseKp * resultMultiplier + roleBonus;
                    const matchOutcome = isWin ? 25 : -10;

                    return {
                        playerSlot: p.player_slot,
                        heroId: p.hero_id,
                        heroName: `Hero_${p.hero_id}`,
                        role: ROLE_MAP[p.player_slot] || `Pos ${(idx % 5) + 1}`,
                        playerName: p.personaname || (p.account_id ? `Player_${p.account_id}` : 'CLASSIFIED'),
                        isRegisteredUser: idx === 0,
                        kills: p.kills || 0,
                        deaths: p.deaths || 0,
                        assists: p.assists || 0,
                        towerKills: p.tower_kills || 0,
                        baseKp,
                        resultMultiplier,
                        roleBonus,
                        totalKp,
                        matchOutcome,
                        finalScore: totalKp + matchOutcome,
                        netWorth: p.net_worth || 0,
                        lastHits: p.last_hits || 0,
                        denies: p.denies || 0,
                        gpm: p.gold_per_min || 0,
                        xpm: p.xp_per_min || 0,
                        heroDamage: p.hero_damage || 0,
                        heroHealing: p.hero_healing || 0,
                        towerDamage: p.tower_damage || 0,
                        items: [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5],
                        neutralItem: p.item_neutral,
                        hasScepter: p.aghanims_scepter === 1,
                        hasShard: p.aghanims_shard === 1,
                    };
                });

                matchData = {
                    matchId: raw.match_id?.toString() || matchId,
                    radiantWin: !!raw.radiant_win,
                    duration: raw.duration || 0,
                    radiantScore: raw.radiant_score ?? radiantPlayers.reduce((s: number, p: any) => s + (p.kills || 0), 0),
                    direScore: raw.dire_score ?? direPlayers.reduce((s: number, p: any) => s + (p.kills || 0), 0),
                    radiantTowersKilled: direPlayers.reduce((s: number, p: any) => s + (p.tower_kills || 0), 0),
                    direTowersKilled: radiantPlayers.reduce((s: number, p: any) => s + (p.tower_kills || 0), 0),
                    towerStatusRadiant: raw.tower_status_radiant || 0,
                    towerStatusDire: raw.tower_status_dire || 0,
                    barracksStatusRadiant: raw.barracks_status_radiant || 0,
                    barracksStatusDire: raw.barracks_status_dire || 0,
                    radiantGoldAdv: raw.radiant_gold_adv || [],
                    radiantXpAdv: raw.radiant_xp_adv || [],
                    kpPlayers: processed,
                    overviewPlayers: processed,
                    performancePlayers: processed,
                };
            }
        }
    } catch (e) {
        console.error('Fetch OpenDota error:', e);
    }

    return (
        <main className="relative min-h-screen bg-[#0A0A0F] text-[#E0E0E0] pb-24 font-inter">
            <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(rgba(0,212,255,0.03)_1px,transparent_0)] bg-[size:24px_24px] opacity-40"></div>

            <div className="mx-auto max-w-7xl px-4 pt-6">
                <MatchHeader
                    matchId={matchData.matchId}
                    radiantWin={matchData.radiantWin}
                    duration={matchData.duration}
                    radiantScore={matchData.radiantScore}
                    direScore={matchData.direScore}
                />

                <MatchDetailView
                    matchData={matchData}
                    heroIdToImg={heroIdToImg}
                    itemIdToName={itemIdToName}
                />
            </div>
        </main>
    );
}