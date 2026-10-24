export interface DotaItemConstant {
    id?: number;
    name?: string;
    cost?: number;
    secret_shop?: number;
    side_shop?: number;
    recipe?: number;
    localized_name?: string;
    img?: string;
}

export async function getItems(): Promise<Record<string, DotaItemConstant>> {
    try {
        const res = await fetch('https://api.opendota.com/api/constants/items', {
            next: { revalidate: 86400 },
        });
        if (!res.ok) throw new Error(`Failed to fetch items: ${res.statusText}`);
        return await res.json();
    } catch (error) {
        console.error('Error fetching Dota items constants:', error);
        return {};
    }
}

export async function getItemIdToNameMap(): Promise<Record<number, string>> {
    const items = await getItems();
    const map: Record<number, string> = {};
    Object.entries(items).forEach(([itemName, data]) => {
        if (data && data.id) {
            map[data.id] = itemName;
        }
    });
    return map;
}