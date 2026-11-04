import Surface from "@/components/ui/Surface";
import { heroLookup } from "@/lib/dota/display";
import { getHeroes } from "@/lib/dota/getHeroes";
import type { DotaMatchDetail } from "@/lib/dota/match";

// K-AV-D6: ของร่วมของแท็บชุด C (Objectives · Runes · Vision · Log · Chat) — ไม่มีข้อมูลจำลอง
// ชื่อผู้เล่น/ฮีโร่มาจากข้อมูลแมตช์และ constants ของ OpenDota เท่านั้น · ไม่เพิ่มข้อมูลระบุตัวตนเกินที่หน้าแมตช์มีอยู่แล้ว

export type CLookups = {
  /** player_slot → "ชื่อ (ฮีโร่)" · ไม่พบช่อง = "–" */
  bySlot: (slot: number | null) => string;
  /** ชื่อ npc ฮีโร่ (npc_dota_hero_x) → localized_name · ไม่รู้จัก = ชื่อดิบตัดคำนำหน้า · null = "–" */
  heroNpc: (npc: string | null) => string;
};

export async function cLookups(m: DotaMatchDetail): Promise<CLookups> {
  const [hero, heroes] = await Promise.all([heroLookup(), getHeroes()]);
  const byNpc = new Map<string, string>();
  for (const h of Object.values(heroes)) if (h?.name && h.localized_name) byNpc.set(h.name, h.localized_name);
  const slotMap = new Map<number, string>();
  for (const p of m.players) if (p.slot !== null) slotMap.set(p.slot, `${p.name} (${hero(p.heroId).label})`);
  return {
    bySlot: (slot) => (slot === null ? "–" : slotMap.get(slot) ?? "–"),
    heroNpc: (npc) => (npc === null ? "–" : byNpc.get(npc) ?? npc.replace(/^npc_dota_hero_/, "").replace(/^npc_dota_/, "").replace(/_/g, " ")),
  };
}

/** แมตช์ไม่มีฟิลด์นี้ (ยังไม่วิเคราะห์ หรือ OpenDota ไม่ให้) — ปุ่มขอวิเคราะห์อยู่ใน layout */
export function NoDataNotice({ what, isParsed }: { what: string; isParsed: boolean }) {
  return (
    <Surface glow="cyan">
      <p className="text-sm text-ink">ไม่มีข้อมูล{what}ในแมตช์นี้</p>
      <p className="mt-1 text-xs text-ink-muted">
        {isParsed ? "OpenDota วิเคราะห์แล้วแต่ไม่ให้ฟิลด์นี้ในแมตช์นี้" : "แมตช์นี้ยังไม่วิเคราะห์ · กดขอวิเคราะห์ด้านบนแล้วกลับมาดูใหม่"}
      </p>
    </Surface>
  );
}

export const SIDE_CLASS: Record<string, string> = { Radiant: "text-cyan", Dire: "text-gold" };
