// lib/dota/fetchMatch.ts

export interface OpenDotaPlayer {
    account_id: number;
    player_slot: number;
    hero_id: number;
    kills: number;
    deaths: number;
    assists: number;
    last_hits: number;
    denies: number;
    gold_per_min: number;
    xp_per_min: number;
    hero_damage: number;
    tower_damage: number;
    hero_healing: number;
    item_0?: number;
    item_1?: number;
    item_2?: number;
    item_3?: number;
    item_4?: number;
    item_5?: number;
    personaname?: string;
}

export interface OpenDotaMatchResponse {
    match_id: number;
    radiant_win: boolean;
    duration: number;
    game_mode: number;
    lobby_type: number;
    radiant_score: number;
    dire_score: number;
    players: OpenDotaPlayer[];
}

export async function fetchOpenDotaMatch(matchId: string | number): Promise<OpenDotaMatchResponse> {
    const apiKey = process.env.OPENDOTA_API_KEY;
    const url = apiKey
        ? `https://api.opendota.com/api/matches/${matchId}?api_key=${apiKey}`
        : `https://api.opendota.com/api/matches/${matchId}`;

    const res = await fetch(url, {
        next: { revalidate: 60 },
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch match ${matchId} from OpenDota (Status: ${res.status})`);
    }

    const data: OpenDotaMatchResponse = await res.json();

    if (!data || !data.players || data.players.length === 0) {
        throw new Error(`Match ${matchId} data is invalid or missing player stats`);
    }

    return data;
}