export async function getItems(): Promise<Record<string, { img: string; dname: string }>> {
    const res = await fetch(
        'https://api.opendota.com/api/constants/items',
        { next: { revalidate: 86400 } }
    );
    return res.json();
}

// map item ID number → item name string
export async function getItemIdToName(): Promise<Record<number, string>> {
    const items = await getItems();
    const map: Record<number, string> = {};
    for (const [name, data] of Object.entries(items)) {
        const d = data as { id?: number; img: string; dname: string };
        if (d.id !== undefined) {
            map[d.id] = name.replace('item_', '');
        }
    }
    return map;
}