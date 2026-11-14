import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dropRatesFromWeights, dropRatesByRarity } from "@/lib/gacha/rates";
import { FEATURES } from "@/lib/featureFlags";

// K-AV-R3B.1: gacha · unit tests (DB tests run against the local sandbox — see ticket reply)
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const BOX = [
  { item_id: "a", weight: 30, rarity_level: 2 }, { item_id: "b", weight: 30, rarity_level: 2 },
  { item_id: "c", weight: 30, rarity_level: 3 }, { item_id: "d", weight: 9, rarity_level: 4 }, { item_id: "e", weight: 1, rarity_level: 5 },
];

describe("K-AV-R3B.1 · drop rates", () => {
  it("per item", () => expect(dropRatesFromWeights(BOX).map((r) => r.percent)).toEqual([30, 30, 30, 9, 1]));
  it("per rarity: Uncommon 60 · Rare 30 · Mythical 9 · Legendary 1", () => expect(dropRatesByRarity(BOX)).toEqual({ 2: 60, 3: 30, 4: 9, 5: 1 }));
  it("ignores weight ≤ 0 · empty → []", () => {
    expect(dropRatesFromWeights([{ item_id: "x", weight: 0 }, { item_id: "y", weight: 3 }])).toEqual([{ item_id: "y", weight: 3, percent: 100 }]);
    expect(dropRatesFromWeights([])).toEqual([]);
  });
  it("rounds to 2 decimals and sums ≈ 100", () => {
    const r = dropRatesFromWeights([{ item_id: "a", weight: 1 }, { item_id: "b", weight: 2 }]);
    expect(r.map((x) => x.percent)).toEqual([33.33, 66.67]);
  });
});

describe("K-AV-R3B.1 · flags + migration shape", () => {
  it("gacha and frames are off", () => { expect(FEATURES.gacha).toBe(false); expect(FEATURES.frames).toBe(false); });
  const sql = read("supabase/migrations/220_gacha.sql").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n"); // ตัดคอมเมนต์
  it("no money columns / payments / passes", () => expect(sql).not.toMatch(/\b(price|thb|amount_thb|payments|passes)\b/i));
  it("no SELECT … INTO variable anywhere", () => expect(sql).not.toMatch(/SELECT[^;]*\bINTO\s+v_/i));
  it("server-side random via gen_random_bytes · SECURITY DEFINER · search_path", () => {
    expect(sql).toMatch(/gen_random_bytes\(8\)/);
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
    expect(sql).toMatch(/FOR UPDATE/);
  });
  it("lib/gacha never randomises in JS", () => {
    for (const f of ["lib/gacha/index.ts", "lib/gacha/rates.ts"]) expect(read(f)).not.toMatch(/Math\.random|crypto\.getRandom/);
  });
  it("reset.ps1 lists 220 and the local-only gacha seed", () => {
    const r = read("scripts/dev-db/reset.ps1");
    expect(r).toMatch(/220_gacha\.sql/);
    expect(r).toMatch(/seed_gacha_dev\.sql/);
  });
});
