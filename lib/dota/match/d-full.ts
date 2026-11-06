// ใบ 28 รายการ (2026-11-06): ข้อมูลที่หน้าแมตช์ Dota 2 ยังขาดตามรายการเทียบของแอนดี้ 2026-11-05 (28 รายการ) — pure ทั้งไฟล์ เทสได้ไม่ยิงเครือข่าย
// ชื่อไฟล์ขึ้นต้น d- = ชุดนี้ · ข้อมูลทั้งชุดอยู่ใต้ฟิลด์ `d` ช่องเดียว (แบบเดียวกับ `b` ของ D5)
// กติกา: ฟิลด์ไม่มี/JSON เพี้ยน = null (ห้ามเป็น 0 หรือ [] แทน) · ไม่เดาความหมายฟิลด์ · ไม่มีข้อมูลจำลอง
// โครงฟิลด์ที่ยืนยันจาก GET /matches/8214277203 (2026-11-06 17:42):
//   match.tower_status_radiant/dire · barracks_status_radiant/dire (bitmask · บิตตั้ง = ยังอยู่)
//   match.teamfights[] {start,end,deaths,players[10]{damage,deaths,deaths_pos{x:{y:count}}}}
//   player.permanent_buffs[] {permanent_buff,stack_count,grant_time} · player.ability_upgrades_arr[] (ability id)
//   player.gold_reasons {reason:gold} · player.purchase {item_key:count} · player.item_uses {item_key:count}

import { num } from "@/lib/dota/opendota";
import { atMinute, type LaneSummary, type PurchaseEvent } from "@/lib/dota/match/b-tabs";
import type { MatchObjective } from "@/lib/dota/match/c-events";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

function numRecord(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v as Obj)) {
    const n = num(x);
    if (n !== null) out[k] = n;
  }
  return out;
}

export type PermanentBuff = { buffId: number; stacks: number | null };
export type PlayerD = {
  permanentBuffs: PermanentBuff[] | null;
  /** ability id ตามลำดับที่อัป (index 0 = เลเวล 1) */
  abilityUpgrades: number[] | null;
  goldReasons: Record<string, number> | null;
  purchase: Record<string, number> | null;
};

export type TeamfightPlayer = { damage: number | null; deaths: number | null; deathsPos: { x: number; y: number; count: number }[] };
export type Teamfight = { start: number | null; end: number | null; deaths: number | null; players: TeamfightPlayer[] };
export type MatchD = {
  towerStatusRadiant: number | null;
  towerStatusDire: number | null;
  barracksStatusRadiant: number | null;
  barracksStatusDire: number | null;
  teamfights: Teamfight[] | null;
};

export function mapPlayerD(raw: unknown): PlayerD {
  const p = obj(raw);
  const buffs = Array.isArray(p.permanent_buffs)
    ? p.permanent_buffs.flatMap((x) => {
        const o = obj(x);
        const id = num(o.permanent_buff);
        return id === null ? [] : [{ buffId: id, stacks: num(o.stack_count) }];
      })
    : null;
  const ups = Array.isArray(p.ability_upgrades_arr) ? p.ability_upgrades_arr.map(num).filter((n): n is number => n !== null) : null;
  return { permanentBuffs: buffs, abilityUpgrades: ups, goldReasons: numRecord(p.gold_reasons), purchase: numRecord(p.purchase) };
}

function mapDeathsPos(v: unknown): { x: number; y: number; count: number }[] {
  const out: { x: number; y: number; count: number }[] = [];
  for (const [xs, inner] of Object.entries(obj(v))) {
    for (const [ys, c] of Object.entries(obj(inner))) {
      const x = Number(xs), y = Number(ys), count = num(c);
      if (Number.isFinite(x) && Number.isFinite(y) && count !== null) out.push({ x, y, count });
    }
  }
  return out;
}

export function mapMatchD(raw: unknown): MatchD {
  const m = obj(raw);
  const tfs = Array.isArray(m.teamfights)
    ? m.teamfights.map((t): Teamfight => {
        const o = obj(t);
        return {
          start: num(o.start),
          end: num(o.end),
          deaths: num(o.deaths),
          players: (Array.isArray(o.players) ? o.players : []).map((x) => {
            const q = obj(x);
            return { damage: num(q.damage), deaths: num(q.deaths), deathsPos: mapDeathsPos(q.deaths_pos) };
          }),
        };
      })
    : null;
  return {
    towerStatusRadiant: num(m.tower_status_radiant),
    towerStatusDire: num(m.tower_status_dire),
    barracksStatusRadiant: num(m.barracks_status_radiant),
    barracksStatusDire: num(m.barracks_status_dire),
    teamfights: tfs,
  };
}

// ---------- 6 · บิตป้อม/ค่าย ----------

export type BuildingLane = "top" | "mid" | "bot" | "base";
export type TowerState = { lane: BuildingLane; tier: number; alive: boolean };
export type BarracksState = { lane: Exclude<BuildingLane, "base">; kind: "melee" | "ranged"; alive: boolean };

/** bit 0-2 บน T1-T3 · 3-5 กลาง · 6-8 ล่าง · 9-10 T4 · null = null */
export function decodeTowers(status: number | null): TowerState[] | null {
  if (status === null) return null;
  const lanes: BuildingLane[] = ["top", "mid", "bot"];
  const out: TowerState[] = [];
  lanes.forEach((lane, li) => {
    for (let t = 0; t < 3; t++) out.push({ lane, tier: t + 1, alive: ((status >> (li * 3 + t)) & 1) === 1 });
  });
  out.push({ lane: "base", tier: 4, alive: ((status >> 9) & 1) === 1 }, { lane: "base", tier: 4, alive: ((status >> 10) & 1) === 1 });
  return out;
}

/** bit 0-1 บน melee/ranged · 2-3 กลาง · 4-5 ล่าง */
export function decodeBarracks(status: number | null): BarracksState[] | null {
  if (status === null) return null;
  const lanes = ["top", "mid", "bot"] as const;
  return lanes.flatMap((lane, li) => [
    { lane, kind: "melee" as const, alive: ((status >> (li * 2)) & 1) === 1 },
    { lane, kind: "ranged" as const, alive: ((status >> (li * 2 + 1)) & 1) === 1 },
  ]);
}

// ---------- 10 · ผลเลน (เกณฑ์ของ AVELAi · แสดงผลเท่านั้น ห้ามส่งต่อไปคะแนน) ----------

export const LANE_OUTCOME_MINUTE = 10;
export const LANE_OUTCOME_MIN_RATIO = 0.1;
export type LaneOutcome = "radiant" | "dire" | "draw" | "uneven" | "nodata";

export function laneOutcome(s: LaneSummary): LaneOutcome {
  if (s.radiant !== s.dire) return "uneven";
  const a = s.radiantGold, b = s.direGold;
  if (a === null || b === null) return "nodata";
  const max = Math.max(a, b);
  if (max <= 0) return "nodata";
  if (Math.abs(a - b) / max < LANE_OUTCOME_MIN_RATIO) return "draw";
  return a > b ? "radiant" : "dire";
}

// ---------- 14-16 · การฆ่า ----------

/** (K+A) / คะแนนรวมฝั่งตัวเอง · ข้อมูลขาดหรือคะแนนทีม 0 = null */
export function killParticipation(kills: number | null, assists: number | null, teamScore: number | null): number | null {
  if (kills === null || assists === null || teamScore === null || teamScore <= 0) return null;
  return (kills + assists) / teamScore;
}
/** gold_reasons["12"] · ไม่มี gold_reasons = null · มีแต่ไม่มีคีย์ = null (ไม่เดาว่าเป็น 0) */
export const killGold = (gr: Record<string, number> | null): number | null => gr?.["12"] ?? null;
/** ค่าสัมบูรณ์ของ gold_reasons["1"] */
export const goldLost = (gr: Record<string, number> | null): number | null => (gr && gr["1"] !== undefined ? Math.abs(gr["1"]) : null);

// ---------- 12 · LH นาที 4/8/12 ----------
export const LH_MINUTES = [4, 8, 12] as const;
export const lhAtMinutes = (lhT: (number | null)[] | null): (number | null)[] => LH_MINUTES.map((m) => atMinute(lhT, m));

// ---------- 1 · เวลาไอเทม ----------
/** เวลาซื้อล่าสุดของ key เดียวกันจาก purchase_log · ไม่มี log หรือไม่พบ = null */
export function lastPurchaseTime(log: PurchaseEvent[] | null, key: string | null): number | null {
  if (!log || !key) return null;
  let t: number | null = null;
  for (const e of log) if (e.key === key && e.time !== null && (t === null || e.time > t)) t = e.time;
  return t;
}

// ---------- 7 · ตารางใครฆ่าใคร ----------
/** matrix[i][j] = ผู้เล่น i ฆ่าผู้เล่น j กี่ครั้ง (จาก killed ของ i) · killed ของ i ไม่มี = null ทั้งแถว */
export function killMatrix(
  killers: { killed: Record<string, number> | null }[],
  victimKeys: (string | null)[],
): (number | null)[][] {
  return killers.map((k) => victimKeys.map((v) => (k.killed === null || v === null ? null : k.killed[v] ?? 0)));
}

// ---------- 23-25 · ดัสต์ สโมก เจม ----------
export type VisionItem = "dust" | "smoke_of_deceit" | "gem";
/** ไม่มี record = null · ไม่มีคีย์ = null (หน้าแสดง "–") */
export const itemCount = (r: Record<string, number> | null, key: VisionItem): number | null => r?.[key] ?? null;

// ---------- 5 · จุดเหตุการณ์บนกราฟ ----------
export type ChartMarker = { minute: number; label: string; kind: "tower" | "roshan" | "firstblood" };
export function chartMarkers(objs: MatchObjective[] | null): ChartMarker[] | null {
  if (!objs) return null;
  const out: ChartMarker[] = [];
  for (const o of objs) {
    if (o.time === null) continue;
    const minute = Math.max(0, Math.floor(o.time / 60));
    if (o.type === "CHAT_MESSAGE_FIRSTBLOOD") out.push({ minute, label: "First blood", kind: "firstblood" });
    else if (o.type === "CHAT_MESSAGE_ROSHAN_KILL") out.push({ minute, label: "Roshan", kind: "roshan" });
    else if (o.type === "building_kill" && o.key?.includes("tower")) out.push({ minute, label: "ป้อม", kind: "tower" });
  }
  return out;
}

// ---------- 13 · ดาเมจต่อการปะทะ ----------
/** แถวละการปะทะ · ค่าเป็นดาเมจของผู้เล่น index เดียวกับ players ของแมตช์ */
export function teamfightDamage(tfs: Teamfight[] | null): { start: number | null; end: number | null; damage: (number | null)[] }[] | null {
  if (!tfs) return null;
  return tfs.map((t) => ({ start: t.start, end: t.end, damage: t.players.map((p) => p.damage) }));
}

// ---------- 17 · จุดตายในการปะทะ ----------
export function teamfightDeaths(tfs: Teamfight[] | null): { playerIndex: number; x: number; y: number; count: number; time: number | null }[] | null {
  if (!tfs) return null;
  return tfs.flatMap((t) => t.players.flatMap((p, playerIndex) => p.deathsPos.map((d) => ({ playerIndex, ...d, time: t.start }))));
}

// ---------- 21 · รูนที่เก็บแยกชนิด ----------
export function runeCounts(logs: ({ key: string | null }[] | null)[]): Record<string, number> | null {
  if (logs.every((l) => l === null)) return null;
  const out: Record<string, number> = {};
  for (const l of logs) for (const r of l ?? []) if (r.key !== null) out[r.key] = (out[r.key] ?? 0) + 1;
  return out;
}

// ---------- 26 · ช่วงพิกัดแผนที่ ----------
/** พิกัด log ของ OpenDota ที่เห็นจริงในแมตช์ 8214277203 อยู่ในช่วง 72-191 · ผังใช้กรอบ 64-192 */
export const MAP_MIN = 64;
export const MAP_MAX = 192;
/** แปลงพิกัดเกมเป็นสัดส่วน 0-1 ของผัง (y กลับด้าน: บนจอ = Dire) */
export const mapPos = (x: number, y: number) => ({
  fx: (x - MAP_MIN) / (MAP_MAX - MAP_MIN),
  fy: 1 - (y - MAP_MIN) / (MAP_MAX - MAP_MIN),
});

