// Path: lib/dota/getHeroes.ts

export interface DotaHeroConstant {
    id?: number;
    name?: string;
    localized_name?: string;
    primary_attr?: string;
    attack_type?: string;
    roles?: string[];
    img?: string;
    icon?: string;
}

let cachedHeroes: Record<string, DotaHeroConstant> | null = null;
let lastFetchHeroesTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // อัปเดตใหม่อัตโนมัติทุก 24 ชั่วโมง

export async function getHeroes(): Promise<Record<string, DotaHeroConstant>> {
    const now = Date.now();

    if (cachedHeroes && Object.keys(cachedHeroes).length > 0 && (now - lastFetchHeroesTime < CACHE_TTL)) {
        return cachedHeroes;
    }

    try {
        const res = await fetch('https://api.opendota.com/api/constants/heroes');
        if (!res.ok) {
            console.warn(`[getHeroes] Fetch failed (${res.status}), using cached fallback.`);
            return cachedHeroes || {};
        }
        cachedHeroes = await res.json();
        lastFetchHeroesTime = now;
        return cachedHeroes || {};
    } catch (error) {
        console.error('Error fetching Dota heroes constants:', error);
        return cachedHeroes || {};
    }
}

export async function getHeroIdToImgMap(): Promise<Record<number, string>> {
    const heroes = await getHeroes();
    const map: Record<number, string> = {};

    if (heroes && typeof heroes === 'object') {
        Object.values(heroes).forEach((hero) => {
            if (hero && hero.id && hero.img) {
                map[hero.id] = hero.img;
            }
        });
    }

    return map;
}