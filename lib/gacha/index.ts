"use server";
// K-AV-R3B.1: เรียกตู้กาชาฝั่ง server · สุ่มในฐาน (gacha_pull · migration 220) ไม่สุ่มใน browser · ปิดด้วย FEATURES.gacha
import { getServerDb } from "@/lib/db/server";
import { FEATURES } from "@/lib/featureFlags";
import { dropRatesFromWeights, type DropRate } from "./rates";

export type PullResult = { ok: true; itemId: string; rarityLevel: number | null; seed: string } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function pullGacha(boxId: string): Promise<PullResult> {
  if (!FEATURES.gacha) return { ok: false, error: "FEATURE_DISABLED" };
  if (!UUID.test(boxId)) return { ok: false, error: "INVALID_BOX" };
  const db = await getServerDb();
  if (!db) return { ok: false, error: "DB_UNAVAILABLE" };
  const { data, error } = await db.rpc("gacha_pull", { p_box_id: boxId });
  if (error) {
    const known = ["GACHA_AUTH_REQUIRED", "GACHA_BOX_NOT_AVAILABLE", "GACHA_BOX_EMPTY", "GACHA_NOT_ENOUGH_POINTS"].find((k) => error.message.includes(k));
    return { ok: false, error: known ?? "GACHA_FAILED" };
  }
  const d = data as { item_id: string; rarity_level: number | null; seed: string };
  return { ok: true, itemId: d.item_id, rarityLevel: d.rarity_level, seed: d.seed };
}

export async function dropRates(boxId: string): Promise<DropRate[]> {
  if (!UUID.test(boxId)) return [];
  const db = await getServerDb();
  if (!db) return [];
  const { data } = await db.from("gacha_box_items").select("item_id, weight, item_definitions(rarity_level)").eq("box_id", boxId);
  return dropRatesFromWeights(
    ((data ?? []) as { item_id: string; weight: number; item_definitions: { rarity_level: number } | { rarity_level: number }[] | null }[]).map((r) => ({
      item_id: r.item_id,
      weight: r.weight,
      rarity_level: Array.isArray(r.item_definitions) ? r.item_definitions[0]?.rarity_level : r.item_definitions?.rarity_level,
    })),
  );
}
