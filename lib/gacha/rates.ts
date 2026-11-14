// K-AV-R3B.1: drop rate สำหรับโชว์ (คำนวณจาก weight · pure · ใช้ได้ทั้ง server/client)
export type BoxItemWeight = { item_id: string; weight: number; rarity_level?: number };
export type DropRate = BoxItemWeight & { percent: number };

/** % ต่อชิ้น (ปัดทศนิยม 2 ตำแหน่ง) · น้ำหนัก ≤ 0 ถูกตัดทิ้ง · ไม่มีของ = [] */
export function dropRatesFromWeights(items: BoxItemWeight[]): DropRate[] {
  const valid = items.filter((i) => Number.isFinite(i.weight) && i.weight > 0);
  const total = valid.reduce((s, i) => s + i.weight, 0);
  if (total === 0) return [];
  return valid.map((i) => ({ ...i, percent: Math.round((i.weight / total) * 10000) / 100 }));
}

/** % ต่อระดับความหายาก (รวมน้ำหนักทุกชิ้นในระดับเดียวกัน) */
export function dropRatesByRarity(items: BoxItemWeight[]): Record<number, number> {
  const valid = items.filter((i) => Number.isFinite(i.weight) && i.weight > 0 && typeof i.rarity_level === "number");
  const total = valid.reduce((s, i) => s + i.weight, 0);
  const out: Record<number, number> = {};
  if (total === 0) return out;
  for (const i of valid) out[i.rarity_level as number] = (out[i.rarity_level as number] ?? 0) + i.weight;
  for (const k of Object.keys(out)) out[Number(k)] = Math.round((out[Number(k)] / total) * 10000) / 100;
  return out;
}
