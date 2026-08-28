// Path: lib/dota/getItems.ts

let cachedItems: Record<string, any> | null = null;
let lastFetchItemsTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // อัปเดตใหม่อัตโนมัติทุก 24 ชั่วโมง

export async function getItems(): Promise<Record<string, any>> {
    const now = Date.now();

    if (cachedItems && Object.keys(cachedItems).length > 0 && (now - lastFetchItemsTime < CACHE_TTL)) {
        return cachedItems;
    }

    try {
        const res = await fetch('https://api.opendota.com/api/constants/items');
        if (!res.ok) {
            console.warn(`[getItems] Fetch failed (${res.status}), using cached fallback.`);
            return cachedItems || {};
        }
        cachedItems = await res.json();
        lastFetchItemsTime = now;
        return cachedItems || {};
    } catch (error) {
        console.error('Error fetching Dota items constants:', error);
        return cachedItems || {};
    }
}

export async function getItemIdToNameMap(): Promise<Record<number, string>> {
    const items = await getItems();
    const map: Record<number, string> = {};

    if (items && typeof items === 'object') {
        Object.values(items).forEach((item: any) => {
            if (item && item.id && item.img) {
                map[item.id] = item.img;
            }
        });
    }

    return map;
}