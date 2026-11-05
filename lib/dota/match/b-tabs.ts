// K-AV-D5: ข้อมูลแท็บชุด B ของหน้าแมตช์ Dota 2 (Builds · Lanes · Farm · Kills) — pure ทั้งไฟล์ เทสได้ไม่ยิงเครือข่าย
// ชื่อไฟล์ขึ้นต้น b- = ชุด D5 กันชนกับ a- (D4) และ c- (D6) · ข้อมูลทั้งชุดอยู่ใต้ฟิลด์ `b` ช่องเดียว จึงไม่ชนชื่อฟิลด์ของกิ่งอื่น
// กติกา: ฟิลด์ไม่มี/JSON เพี้ยน = null (ห้ามเป็น [] หรือ 0 แทน) · ไม่เดาฟิลด์ · ไม่มีข้อมูลจำลอง
// โครงฟิลด์ที่ยืนยันจาก GET /matches/8214277203 และ /matches/8946067499 (2026-11-05):
//   player.purchase_log[] {time,key,charges?} · player.item_uses {item:count}
//   player.lane 1–5 · player.lane_role 1–4 · player.is_roaming · player.lane_efficiency_pct
//   player.times[] / gold_t[] / xp_t[] / lh_t[] / dn_t[] (รายนาที ยาวเท่ากัน)
//   player.total_gold · total_xp · gold_spent · actions_per_min
//   player.kills_log[] {time,key:"npc_dota_hero_*"} · player.killed / killed_by {unit:count}
//   player.buyback_log[] {time} · multi_kills / kill_streaks {ขนาด:count} · life_state_dead (วินาที)
//   match.radiant_gold_adv[] / radiant_xp_adv[] (รายนาที · บวก = Radiant นำ)

import { num } from "@/lib/dota/opendota";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** array ของตัวเลขจริงเท่านั้น · ไม่ใช่ array = null · ช่องที่ไม่ใช่ตัวเลข = null ในช่องนั้น (ไม่แต่งเป็น 0) */
function numSeries(v: unknown): (number | null)[] | null {
  return Array.isArray(v) ? v.map(num) : null;
}

/** object ของตัวเลข · ไม่ใช่ object = null · ค่าที่ไม่ใช่ตัวเลขถูกข้าม */
function numRecord(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v as Obj)) {
    const n = num(x);
    if (n !== null) out[k] = n;
  }
  return out;
}

export type PurchaseEvent = { time: number | null; key: string; charges: number | null };
export type KillEvent = { time: number | null; key: string };

export type PlayerB = {
  // Builds
  purchaseLog: PurchaseEvent[] | null;
  itemUses: Record<string, number> | null;
  // Lanes
  lane: number | null;
  laneRole: number | null;
  isRoaming: boolean | null;
  laneEfficiencyPct: number | null;
  // Farm (รายนาที)
  times: (number | null)[] | null;
  goldT: (number | null)[] | null;
  xpT: (number | null)[] | null;
  lhT: (number | null)[] | null;
  dnT: (number | null)[] | null;
  totalGold: number | null;
  totalXp: number | null;
  goldSpent: number | null;
  apm: number | null;
  // Kills
  killsLog: KillEvent[] | null;
  killed: Record<string, number> | null;
  killedBy: Record<string, number> | null;
  buybackTimes: (number | null)[] | null;
  multiKills: Record<string, number> | null;
  killStreaks: Record<string, number> | null;
  deadSeconds: number | null;
};

export type MatchB = {
  radiantGoldAdv: (number | null)[] | null;
  radiantXpAdv: (number | null)[] | null;
};

/** รายการที่ไม่มี key ใช้ไม่ได้ (ไม่แต่งชื่อให้) → ทิ้งรายการนั้น · ไม่ใช่ array = null */
function keyedLog<T>(v: unknown, make: (o: Obj, key: string) => T): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const raw of v) {
    const o = obj(raw);
    const key = str(o.key);
    if (key) out.push(make(o, key));
  }
  return out;
}

export function mapPlayerB(raw: unknown): PlayerB {
  const p = obj(raw);
  return {
    purchaseLog: keyedLog(p.purchase_log, (o, key) => ({ time: num(o.time), key, charges: num(o.charges) })),
    itemUses: numRecord(p.item_uses),
    lane: num(p.lane),
    laneRole: num(p.lane_role),
    isRoaming: typeof p.is_roaming === "boolean" ? p.is_roaming : null,
    laneEfficiencyPct: num(p.lane_efficiency_pct),
    times: numSeries(p.times),
    goldT: numSeries(p.gold_t),
    xpT: numSeries(p.xp_t),
    lhT: numSeries(p.lh_t),
    dnT: numSeries(p.dn_t),
    totalGold: num(p.total_gold),
    totalXp: num(p.total_xp),
    goldSpent: num(p.gold_spent),
    apm: num(p.actions_per_min),
    killsLog: keyedLog(p.kills_log, (o, key) => ({ time: num(o.time), key })),
    killed: numRecord(p.killed),
    killedBy: numRecord(p.killed_by),
    buybackTimes: Array.isArray(p.buyback_log) ? p.buyback_log.map((x) => num(obj(x).time)) : null,
    multiKills: numRecord(p.multi_kills),
    killStreaks: numRecord(p.kill_streaks),
    deadSeconds: num(p.life_state_dead),
  };
}

export function mapMatchB(raw: unknown): MatchB {
  const m = obj(raw);
  return { radiantGoldAdv: numSeries(m.radiant_gold_adv), radiantXpAdv: numSeries(m.radiant_xp_adv) };
}

// ---------- ตัวช่วยของหน้าแท็บ (pure) ----------

const HERO_PREFIX = "npc_dota_hero_";
export const isHeroUnit = (key: string) => key.startsWith(HERO_PREFIX);

/** ค่าของนาทีที่กำหนดจากอนุกรมรายนาที · เกมจบก่อนถึงนาทีนั้นหรือไม่มีอนุกรม = null (ห้ามใช้ค่าสุดท้ายแทน) */
export function atMinute(series: (number | null)[] | null, minute: number): number | null {
  if (!series || minute < 0 || minute >= series.length) return null;
  return series[minute];
}

/** เวลาในเกมแบบ m:ss · ก่อนเริ่มเกม (ติดลบ) ขึ้นเครื่องหมายลบ · null = "–" */
export function gameClock(sec: number | null): string {
  if (sec === null) return "–";
  const a = Math.abs(Math.trunc(sec));
  return `${sec < 0 ? "-" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

/** เลนตามค่า lane ของ OpenDota · ค่าที่ไม่รู้จัก = null (หน้าแสดง "–" ไม่เดา) */
const LANES: Record<number, string> = { 1: "ล่าง", 2: "กลาง", 3: "บน", 4: "ป่า Radiant", 5: "ป่า Dire" };
const LANE_ROLES: Record<number, string> = { 1: "Safe Lane", 2: "Mid", 3: "Off Lane", 4: "Jungle" };
export const laneLabel = (v: number | null): string | null => (v === null ? null : LANES[v] ?? null);
export const laneRoleLabel = (v: number | null): string | null => (v === null ? null : LANE_ROLES[v] ?? null);

/** ไอเทมสิ้นเปลืองและของตั้งต้นที่ไม่ใช่ "บิลด์" — ใช้แยกให้อ่านลำดับของหลักง่ายขึ้นเท่านั้น รายการเต็มยังแสดงครบ */
const CONSUMABLES = new Set([
  "tango", "clarity", "flask", "enchanted_mango", "famango", "faerie_fire", "blood_grenade", "branches", "tpscroll",
  "ward_observer", "ward_sentry", "ward_dispenser", "smoke_of_deceit", "dust",
]);
export const isConsumable = (key: string) => CONSUMABLES.has(key);

export type PlayerSideB = { isRadiant: boolean | null; b: PlayerB };

export type LaneSummary = {
  lane: number;
  radiant: number;
  dire: number;
  /** ผลรวมทอง/XP ของผู้เล่นในเลนนั้นที่นาทีที่กำหนด · มีผู้เล่นคนใดไม่มีค่า = null (ไม่รวมแบบขาด) */
  radiantGold: number | null;
  direGold: number | null;
  radiantXp: number | null;
  direXp: number | null;
};

function sumOrNull(vals: (number | null)[]): number | null {
  if (vals.length === 0) return null;
  let s = 0;
  for (const v of vals) {
    if (v === null) return null;
    s += v;
  }
  return s;
}

/** สรุปรายเลนที่นาทีที่กำหนด — เป็นข้อเท็จจริง (ผลรวมทอง/XP) เท่านั้น ไม่ตัดสินว่าใครชนะเลน เพราะ OpenDota ไม่มีฟิลด์ผลเลน */
export function laneSummaries(players: PlayerSideB[], minute: number): LaneSummary[] {
  const lanes = [...new Set(players.map((p) => p.b.lane).filter((l): l is number => l !== null))].sort((a, b) => a - b);
  return lanes.map((lane) => {
    const inLane = players.filter((p) => p.b.lane === lane);
    const r = inLane.filter((p) => p.isRadiant === true);
    const d = inLane.filter((p) => p.isRadiant === false);
    return {
      lane,
      radiant: r.length,
      dire: d.length,
      radiantGold: sumOrNull(r.map((p) => atMinute(p.b.goldT, minute))),
      direGold: sumOrNull(d.map((p) => atMinute(p.b.goldT, minute))),
      radiantXp: sumOrNull(r.map((p) => atMinute(p.b.xpT, minute))),
      direXp: sumOrNull(d.map((p) => atMinute(p.b.xpT, minute))),
    };
  });
}

export type KillRow = { time: number | null; killerIndex: number; victimKey: string };

/** ลำดับการฆ่าฮีโร่ทั้งแมตช์ เรียงตามเวลา · ผู้เล่นทุกคนไม่มี kills_log = null */
export function killTimeline(players: { b: PlayerB }[]): KillRow[] | null {
  if (!players.some((p) => p.b.killsLog !== null)) return null;
  const rows: KillRow[] = [];
  players.forEach((p, killerIndex) => {
    for (const k of p.b.killsLog ?? []) rows.push({ time: k.time, killerIndex, victimKey: k.key });
  });
  return rows.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
}

/** จำนวนครั้งที่ผู้เล่นฆ่าฮีโร่ตัวนั้น จาก killed · ไม่มี killed = null · มีแต่ไม่เคยฆ่าตัวนั้น = 0 (เป็นค่าจริง) */
export function killsOn(killer: PlayerB, victimHeroKey: string | null): number | null {
  if (killer.killed === null || victimHeroKey === null) return null;
  return killer.killed[victimHeroKey] ?? 0;
}

/** ผลรวมของ record แบบ {ขนาด: จำนวนครั้ง} เช่น multi_kills · null = null */
export function recordTotal(r: Record<string, number> | null): number | null {
  return r === null ? null : Object.values(r).reduce((a, b) => a + b, 0);
}

/** นาทีที่จะแสดงในตารางส่วนต่างทีม: ทุก 5 นาที และนาทีสุดท้าย */
export function advMinutes(len: number): number[] {
  if (len <= 0) return [];
  const out: number[] = [];
  for (let m = 0; m < len; m += 5) out.push(m);
  if (out[out.length - 1] !== len - 1) out.push(len - 1);
  return out;
}
