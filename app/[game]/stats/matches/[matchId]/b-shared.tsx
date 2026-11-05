/* eslint-disable @next/next/no-img-element */
import Surface from "@/components/ui/Surface";
import { heroLookup } from "@/lib/dota/display";
import { getHeroes } from "@/lib/dota/getHeroes";
import { getItems } from "@/lib/dota/getItems";
import type { DotaMatchDetail, DotaMatchDetailPlayer } from "@/lib/dota/match";
import { getItemImageUrl } from "@/lib/dotaAssets";

// K-AV-D5: ของใช้ร่วมของแท็บชุด B (Builds · Lanes · Farm · Kills) — ชื่อไฟล์ขึ้นต้น b- กันชนกับ c-shared ของ D6
// ไม่มีข้อมูลจำลอง · ค่าที่ไม่มี = "–" หรือข้อความ "ไม่มีข้อมูลในแมตช์นี้"

export const SIDE_TEXT = { radiant: "text-cyan", dire: "text-gold", unknown: "text-ink" } as const;
export const sideText = (isRadiant: boolean | null) =>
  isRadiant === true ? SIDE_TEXT.radiant : isRadiant === false ? SIDE_TEXT.dire : SIDE_TEXT.unknown;

/** กรอบตารางเลื่อนแนวนอนในตัวเอง หน้าไม่ล้นที่ 390 */
export const SCROLL = "-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0";
export const TABLE = "w-max min-w-full border-collapse text-xs sm:text-sm";
export const HEAD_ROW = "border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted";
export const TH = "py-2 pr-3";
export const TD = "py-2 pr-3 font-mono";
export const H2 = "font-display text-base font-black tracking-wide text-ink";

/** ค่าที่ไม่มี = "–" · 0 ที่เป็นค่าจริงแสดงเป็น 0 */
export const val = (v: number | null | undefined): string => (v === null || v === undefined ? "–" : v.toLocaleString("en-US"));

export type BLookups = {
  hero: (id: number | null) => { label: string; img: string };
  /** "npc_dota_hero_lion" ของผู้เล่นคนนั้น · หา id ไม่เจอในค่าคงที่ = null */
  heroKeyOf: (p: DotaMatchDetailPlayer) => string | null;
  /** ผู้เล่นในแมตช์ที่ใช้ฮีโร่ตาม key · ไม่เจอ = null */
  playerByHeroKey: (key: string) => DotaMatchDetailPlayer | null;
  /** ชื่อแสดงของฮีโร่จาก key (รวมฮีโร่ที่ไม่ได้อยู่ในแมตช์) */
  heroLabelByKey: (key: string) => string;
  itemName: (key: string) => string;
  /** id ไอเทม → key ของค่าคงที่ OpenDota เช่น "blink" · ไม่รู้จัก = null (ไม่วาดรูปแตก) */
  itemKeyById: (id: number) => string | null;
};

export async function bLookups(m: DotaMatchDetail): Promise<BLookups> {
  const [hero, heroes, items] = await Promise.all([heroLookup(), getHeroes(), getItems()]);
  const keyById = new Map<number, string>();
  const labelByKey = new Map<string, string>();
  for (const h of Object.values(heroes)) {
    if (h?.id && h.name) {
      keyById.set(h.id, h.name);
      if (h.localized_name) labelByKey.set(h.name, h.localized_name);
    }
  }
  const heroKeyOf = (p: DotaMatchDetailPlayer) => (p.heroId === null ? null : keyById.get(p.heroId) ?? null);
  const itemKeys = new Map<number, string>();
  for (const [key, it] of Object.entries(items)) {
    if (it?.id) itemKeys.set(it.id, key);
  }
  const byKey = new Map<string, DotaMatchDetailPlayer>();
  for (const p of m.players) {
    const k = heroKeyOf(p);
    if (k) byKey.set(k, p);
  }
  return {
    hero,
    heroKeyOf,
    playerByHeroKey: (key) => byKey.get(key) ?? null,
    heroLabelByKey: (key) => labelByKey.get(key) ?? key.replace("npc_dota_hero_", ""),
    itemName: (key) => (items[key] as { dname?: string } | undefined)?.dname ?? key.replaceAll("_", " "),
    itemKeyById: (id) => itemKeys.get(id) ?? null,
  };
}

export function PlayerCell({ p, L }: { p: DotaMatchDetailPlayer; L: BLookups }) {
  const h = L.hero(p.heroId);
  return (
    <span className="flex items-center gap-2">
      {h.img ? <img src={h.img} alt="" width={32} height={18} className="rounded" /> : null}
      <span className="flex flex-col">
        <span className={`text-xs sm:text-sm ${sideText(p.isRadiant)}`}>{p.name}</span>
        <span className="font-mono text-xs text-ink-muted">{h.label}</span>
      </span>
    </span>
  );
}

export function ItemIcon({ name, L }: { name: string; L: BLookups }) {
  // สูตร (recipe_*) ใช้รูปม้วนสูตรรูปเดียวกันทั้งหมด — CDN ไม่มีรูปแยกรายสูตรครบทุกตัว
  const src = getItemImageUrl(name.startsWith("recipe_") ? "item_recipe" : `item_${name}`);
  const label = L.itemName(name);
  return src ? (
    <img src={src} alt={label} title={label} width={32} height={24} className="h-6 w-8 rounded" />
  ) : (
    <span className="font-mono text-xs text-ink">{label}</span>
  );
}

/** แบ่งผู้เล่นเป็นกลุ่มตามฝั่ง — ฝั่งที่ไม่มีผู้เล่นไม่ถูกคืน */
export function teams(m: DotaMatchDetail) {
  return [
    { title: "Radiant", won: m.radiantWin === true, players: m.players.filter((p) => p.isRadiant === true) },
    { title: "Dire", won: m.radiantWin === false, players: m.players.filter((p) => p.isRadiant === false) },
    { title: "ไม่ทราบฝั่ง", won: false, players: m.players.filter((p) => p.isRadiant === null) },
  ].filter((t) => t.players.length > 0);
}

export function TeamHeading({ title, won }: { title: string; won: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className={H2}>{title}</h2>
      {won ? <span className="rounded border border-gold/50 px-2 py-0.5 font-mono text-xs text-gold">ชนะ</span> : null}
    </div>
  );
}

/** ทั้งแท็บไม่มีข้อมูล — แมตช์ยังไม่วิเคราะห์ชี้ไปที่ปุ่มขอวิเคราะห์เดิมด้านบน (ParseRequestPanel ใน layout) */
export function NoDataB({ what, isParsed }: { what: string; isParsed: boolean }) {
  return (
    <Surface>
      <p className="text-sm text-ink">
        {isParsed ? `ไม่มีข้อมูล${what}ในแมตช์นี้` : `แมตช์นี้ยังไม่วิเคราะห์ จึงยังไม่มีข้อมูล${what}`}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        {isParsed ? "OpenDota ไม่ได้ส่งฟิลด์นี้มา · หน้านี้ไม่แสดงข้อมูลจำลอง" : "กดปุ่มขอวิเคราะห์ด้านบนได้ · หน้านี้ไม่แสดงข้อมูลจำลอง"}
      </p>
    </Surface>
  );
}

export const Missing = () => <span className="text-xs text-ink-muted">ไม่มีข้อมูลในแมตช์นี้</span>;
