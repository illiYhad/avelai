// Dota 2 Asset Resolver Layer

export const getHeroImageUrl = (heroName?: string, heroId?: number): string => {
    if (heroName && heroName.startsWith('http')) return heroName;

    if (heroName && heroName.length > 0 && isNaN(Number(heroName))) {
        const clean = heroName.replace('npc_dota_hero_', '').toLowerCase().replace(/[^a-z0-9_]/g, '');
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${clean}.png`;
    }

    return '';
};

export const getItemImageUrl = (itemNameOrId?: number | string): string => {
    if (!itemNameOrId || itemNameOrId === 0 || itemNameOrId === '0') return '';

    if (typeof itemNameOrId === 'string' && isNaN(Number(itemNameOrId))) {
        const clean = itemNameOrId.replace('item_', '');
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${clean}.png`;
    }

    return '';
};