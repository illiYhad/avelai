import "server-only";
import { getHeroes } from "@/lib/dota/getHeroes";
import { getHeroImageUrl } from "@/lib/dotaAssets";

// K-AV-D2: ตัวช่วยแสดงผลหน้าการ์ด/แมตช์ Dota 2 (ชื่อฮีโร่ · เวลา · โหมด) — ค่าขาด = "–"

export type HeroInfo = { label: string; img: string };

/** id ฮีโร่ → ชื่อ + รูป (ค่าคงที่ OpenDota cache 24 ชม. · ดึงไม่ได้ = "Hero #id" ไม่มีรูป) */
export async function heroLookup(): Promise<(id: number | null) => HeroInfo> {
  const heroes = await getHeroes();
  const map = new Map<number, HeroInfo>();
  for (const h of Object.values(heroes)) {
    if (h?.id) map.set(h.id, { label: h.localized_name ?? `Hero #${h.id}`, img: getHeroImageUrl(h.name, h.id) });
  }
  return (id) => (id === null ? { label: "–", img: "" } : map.get(id) ?? { label: `Hero #${id}`, img: getHeroImageUrl(undefined, id) });
}

export const dash = (v: number | string | null | undefined): string =>
  v === null || v === undefined || v === "" ? "–" : typeof v === "number" ? v.toLocaleString("en-US") : v;

export function duration(sec: number | null): string {
  if (sec === null) return "–";
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

export function thaiDateTime(unixSec: number | null): string {
  if (unixSec === null) return "–";
  return new Date(unixSec * 1000).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}

const GAME_MODES: Record<number, string> = {
  1: "All Pick", 2: "Captains Mode", 3: "Random Draft", 4: "Single Draft", 5: "All Random",
  16: "Captains Draft", 18: "Ability Draft", 22: "All Pick", 23: "Turbo",
};
const LOBBY_TYPES: Record<number, string> = { 0: "Normal", 1: "Practice", 2: "Tournament", 7: "Ranked", 9: "Battle Cup" };

export const gameModeLabel = (v: number | null) => (v === null ? "–" : GAME_MODES[v] ?? `Mode #${v}`);
export const lobbyLabel = (v: number | null) => (v === null ? "–" : LOBBY_TYPES[v] ?? `Lobby #${v}`);
