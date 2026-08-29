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

export async function getHeroes(): Promise<Record<string, DotaHeroConstant>> {
    try {
        const res = await fetch('https://api.opendota.com/api/constants/heroes', {
            next: { revalidate: 86400 },
        });
        if (!res.ok) throw new Error(`Failed to fetch heroes: ${res.statusText}`);
        return await res.json();
    } catch (error) {
        console.error('Error fetching Dota heroes constants:', error);
        return {};
    }
}

export async function getHeroIdToImgMap(): Promise<Record<number, string>> {
    const heroes = await getHeroes();
    const map: Record<number, string> = {};
    Object.values(heroes).forEach((hero) => {
        if (hero && hero.id && hero.img) {
            map[hero.id] = hero.img;
        }
    });
    return map;
}