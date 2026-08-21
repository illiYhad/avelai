import React from 'react';
import MatchHeader from './components/MatchHeader';
import MatchDetailView from './components/MatchDetailView';

// นำเข้าฟังก์ชันดึงข้อมูลที่เราเพิ่งสร้าง
import { getHeroIdToImg } from '@/lib/dota/getHeroes';
import { getItemIdToName } from '@/lib/dota/getItems';

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
    kpPlayers: [
        {
            playerSlot: 0,
            heroId: 1,
            heroName: 'Slark',
            role: 'Pos 1',
            playerName: 'AVELAi_God',
            isRegisteredUser: true,
            kills: 18,
            deaths: 3,
            assists: 21,
            towerKills: 4,
            baseKp: 24.8,
            resultMultiplier: 1.0,
            roleBonus: 2.5,
            totalKp: 27.3,
            matchOutcome: 25,
            finalScore: 52.3,
        },
        // ... (ข้อมูล FALLBACK อื่นๆ เหมือนเดิม)
        {
            playerSlot: 1,
            heroId: 2,
            heroName: 'Ogre Magi',
            role: 'Pos 5',
            playerName: 'Anonymous',
            isRegisteredUser: false,
            kills: 9,
            deaths: 9,
            assists: 31,
            towerKills: 1,
            baseKp: 15.8,
            resultMultiplier: 1.0,
            roleBonus: 1.2,
            totalKp: 17.0,
            matchOutcome: 25,
            finalScore: 42.0,
        },
        {
            playerSlot: 128,
            heroId: 3,
            heroName: 'Invoker',
            role: 'Pos 2',
            playerName: 'Dire_Carry',
            isRegisteredUser: false,
            kills: 16,
            deaths: 8,
            assists: 12,
            towerKills: 2,
            baseKp: 19.6,
            resultMultiplier: 0.5,
            roleBonus: 1.5,
            totalKp: 11.3,
            matchOutcome: -10,
            finalScore: 1.3,
        },
    ],
    overviewPlayers: [
        {
            playerSlot: 0,
            heroId: 1,
            heroName: 'Slark',
            playerName: 'AVELAi_God',
            isRegisteredUser: true,
            kills: 18,
            deaths: 3,
            assists: 21,
            netWorth: 26700,
            lastHits: 235,
            denies: 28,
            gpm: 682,
            xpm: 858,
            heroDamage: 44900,
            heroHealing: 0,
            towerDamage: 15200,
            items: [63, 174, 116, 160, 208, 139], // ส่งเป็น ID ตรงๆ
            neutralItem: 331,
            hasScepter: true,
            hasShard: true,
        },
        {
            playerSlot: 128,
            heroId: 3,
            heroName: 'Invoker',
            playerName: 'Dire_Carry',
            isRegisteredUser: false,
            kills: 16,
            deaths: 8,
            assists: 12,
            netWorth: 19100,
            lastHits: 228,
            denies: 5,
            gpm: 498,
            xpm: 690,
            heroDamage: 33900,
            heroHealing: 9200,
            towerDamage: 538,
            items: [48, 65, 108, 110, 116, 232], // ส่งเป็น ID ตรงๆ
            neutralItem: 289,
            hasScepter: true,
            hasShard: false,
        },
    ],
    performancePlayers: [
        {
            playerSlot: 0,
            playerName: 'AVELAi_God',
            heroName: 'Slark',
            role: 'Pos 1',
            kills: 18,
            deaths: 3,
            assists: 21,
            totalKp: 27.3,
            towerKills: 4,
            heroDamage: 44900,
            heroHealing: 0,
        },
        {
            playerSlot: 128,
            playerName: 'Dire_Carry',
            heroName: 'Invoker',
            role: 'Pos 2',
            kills: 16,
            deaths: 8,
            assists: 12,
            totalKp: 11.3,
            towerKills: 2,
            heroDamage: 33900,
            heroHealing: 9200,
        },
    ],
};

export default async function MatchDetailPage({
    params,
}: {
    params: Promise<{ matchId: string }>;
}) {
    const { matchId } = await params;

    // เตรียมตัวแปรรับค่า Dict
    let heroIdToImg: Record<number, string> = {};
    let itemIdToName: Record<number, string> = {};
    let matchData = FALLBACK_MATCH;

    try {
        // Fetch ข้อมูลแมตช์, ฮีโร่, ไอเทม ไปพร้อมๆ กันเลย
        const [res, heroesDict, itemsDict] = await Promise.all([
            fetch(`https://api.opendota.com/api/matches/${matchId}`, {
                next: { revalidate: 3600 },
            }),
            getHeroIdToImg(),
            getItemIdToName(),
        ]);

        heroIdToImg = heroesDict;
        itemIdToName = itemsDict;

        if (res.ok) {
            const raw = await res.json();
            if (raw && raw.players) {
                const radiantPlayers = raw.players.filter((p: any) => p.player_slot < 128);
                const direPlayers = raw.players.filter((p: any) => p.player_slot >= 128);

                const processed = raw.players.map((p: any, idx: number) => {
                    const isRadiant = p.player_slot < 128;
                    const isWin = isRadiant ? raw.radiant_win : !raw.radiant_win;
                    const baseKp = Math.max(-10, (p.kills * 1.0) - (p.deaths * 0.5) + (p.assists * 0.3) + ((p.tower_kills || 0) * 2.0));
                    const resultMultiplier = isWin ? 1.0 : 0.5;
                    const roleBonus = 1.5;
                    const totalKp = baseKp * resultMultiplier + roleBonus;
                    const matchOutcome = isWin ? 25 : -10;

                    return {
                        playerSlot: p.player_slot,
                        heroId: p.hero_id,
                        heroName: `Hero_${p.hero_id}`, // ใช้ heroName เผื่อเคสที่ดึงรูปไม่ขึ้น
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
                        // ปรับให้ดึงค่าเป็น ID ตัวเลขโดยตรง ไม่ต้องมีคำว่า 'item_'
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

                {/* ส่ง props ข้อมูลฮีโร่และไอเทมลงไปให้ MatchDetailView เพื่อนำไปใช้กับ OverviewTable ต่อ */}
                <MatchDetailView
                    matchData={matchData}
                    heroIdToImg={heroIdToImg}
                    itemIdToName={itemIdToName}
                />
            </div>
        </main>
    );
}