export async function getHeroes(): Promise<Record<string, { img: string; localized_name: string }>> {
    const res = await fetch(
        'https://api.opendota.com/api/constants/heroes',
        { next: { revalidate: 86400 } }
    );
    return res.json();
}

// map hero ID number → img URL
export async function getHeroIdToImg(): Promise<Record<number, string>> {
    const heroes = await getHeroes();
    const map: Record<number, string> = {};
    for (const [, data] of Object.entries(heroes)) {
        const d = data as { id: number; img: string };
        map[d.id] = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes${d.img}`;
    }
    return map;
}