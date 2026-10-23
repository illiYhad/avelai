// lib/supabase/dota/calculateKP.ts

import { OpenDotaPlayer } from './fetchMatch';

export interface PlayerPerformanceMetrics {
    account_id: number;
    hero_id: number;
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
    kill_participation: number;
    gpm: number;
    xpm: number;
    hero_damage: number;
    tower_damage: number;
    hero_healing: number;
    performance_score: number;
}

export function calculateMatchPerformance(
    players: OpenDotaPlayer[],
    radiantScore: number,
    direScore: number
): PlayerPerformanceMetrics[] {
    return players.map((player) => {
        const isRadiant = player.player_slot < 128;
        const teamTotalKills = isRadiant ? radiantScore : direScore;

        const kills = Number(player.kills) || 0;
        const assists = Number(player.assists) || 0;
        const deaths = Number(player.deaths) || 0;
        const gpm = Number(player.gold_per_min) || 0;
        const xpm = Number(player.xp_per_min) || 0;
        const heroDamage = Number(player.hero_damage) || 0;
        const towerDamage = Number(player.tower_damage) || 0;
        const heroHealing = Number(player.hero_healing) || 0;

        // คำนวณ Kill Participation (%)
        let kp = 0;
        if (teamTotalKills > 0) {
            kp = Math.min(100, Math.round(((kills + assists) / teamTotalKills) * 100));
        }

        // คำนวณ KDA Ratio
        const safeDeaths = deaths === 0 ? 1 : deaths;
        const kda = Number(((kills + assists) / safeDeaths).toFixed(2));

        // คำนวณ Performance Score
        const rawScore =
            (kda * 10) +
            (kp * 0.5) +
            ((gpm + xpm) / 20) +
            (heroDamage / 1000);

        const performance_score = Number((Math.round(rawScore * 10) / 10).toFixed(1)) || 0;

        return {
            account_id: player.account_id,
            hero_id: player.hero_id,
            kills,
            deaths,
            assists,
            kda,
            kill_participation: kp,
            gpm,
            xpm,
            hero_damage: heroDamage,
            tower_damage: towerDamage,
            hero_healing: heroHealing,
            performance_score,
        };
    });
}