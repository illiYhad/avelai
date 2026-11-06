// K-AV-D6: ข้อมูลเหตุการณ์ของแมตช์ Dota 2 ชุด C (Objectives · Runes · Vision · Log · Chat) — pure ทั้งไฟล์ เทสได้ไม่ยิงเครือข่าย
// ชื่อไฟล์ขึ้นต้น c- = ชุด D6 กันชนกับ a- (D4) และ b- (D5)
// กติกา: ฟิลด์ไม่มี/JSON เพี้ยน = null (ห้ามเป็น [] หรือ 0 แทน) · ไม่เดาฟิลด์ · ไม่มีข้อมูลจำลอง
// โครงฟิลด์ที่ยืนยันจาก GET /matches/8214277203 และ /matches/8946067499 (2026-11-04):
//   match.objectives[] {time,type,key?,unit?,slot?,player_slot?,team?,value?,killer?}
//   match.chat[]       {time,type:"chat"|"chatwheel",key,slot?,player_slot?}
//   player.runes_log[] {time,key}  · player.obs_log/sen_log[] {time,key:"[x,y]",x,y,player_slot}
//   player.obs_left_log/sen_left_log[] {time,key,attackername?,player_slot} · player.kills_log[] {time,key}

import { num } from "@/lib/dota/opendota";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
/** key ของ OpenDota บางทีเป็นเลข บางทีเป็น string ("5") → เก็บเป็น string เสมอ · ไม่มี = null */
const keyStr = (v: unknown): string | null => (typeof v === "number" && Number.isFinite(v) ? String(v) : str(v));
/** array จริงเท่านั้น · อย่างอื่น (รวม undefined) = null */
const arrOrNull = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);

export type MatchObjective = {
  time: number | null;
  type: string;
  key: string | null;
  unit: string | null;
  playerSlot: number | null;
  team: number | null;
  value: number | null;
};

export type ChatLine = {
  time: number | null;
  /** "chat" = พิมพ์เอง · "chatwheel" = ข้อความสำเร็จรูป (key = รหัส) · อื่น ๆ ตามที่ OpenDota ส่ง */
  type: string;
  /** ข้อความดิบจากผู้เล่น — ต้องเรนเดอร์เป็นข้อความธรรมดาเท่านั้น (React escape ให้ · ห้าม dangerouslySetInnerHTML) */
  key: string | null;
  playerSlot: number | null;
};

export type TimedKey = { time: number | null; key: string | null };
export type WardEvent = { time: number | null; key: string | null; x: number | null; y: number | null };
export type WardLeft = { time: number | null; key: string | null; attacker: string | null };

export type PlayerEventLogs = {
  runesLog: TimedKey[] | null;
  obsLog: WardEvent[] | null;
  senLog: WardEvent[] | null;
  obsLeftLog: WardLeft[] | null;
  senLeftLog: WardLeft[] | null;
  killsLog: TimedKey[] | null;
};

export type MatchEvents = {
  objectives: MatchObjective[] | null;
  chat: ChatLine[] | null;
};

function mapObjective(raw: unknown): MatchObjective | null {
  const o = obj(raw);
  const type = str(o.type);
  if (!type) return null; // รายการที่ไม่มี type ใช้ไม่ได้ (ไม่แต่งชนิดให้)
  return {
    time: num(o.time), type, key: keyStr(o.key), unit: str(o.unit),
    playerSlot: num(o.player_slot), team: num(o.team), value: num(o.value),
  };
}

function mapChat(raw: unknown): ChatLine | null {
  const o = obj(raw);
  const type = str(o.type);
  if (!type) return null;
  return { time: num(o.time), type, key: keyStr(o.key), playerSlot: num(o.player_slot) };
}

const mapTimed = (raw: unknown): TimedKey => ({ time: num(obj(raw).time), key: keyStr(obj(raw).key) });
const mapWard = (raw: unknown): WardEvent => {
  const o = obj(raw);
  return { time: num(o.time), key: keyStr(o.key), x: num(o.x), y: num(o.y) };
};
const mapWardLeft = (raw: unknown): WardLeft => {
  const o = obj(raw);
  return { time: num(o.time), key: keyStr(o.key), attacker: str(o.attackername) };
};
const mapList = <T>(v: unknown, fn: (x: unknown) => T | null): T[] | null => {
  const a = arrOrNull(v);
  return a === null ? null : a.map(fn).filter((x): x is T => x !== null);
};

/** เหตุการณ์ระดับแมตช์ (objectives · chat) · ฟิลด์ไม่มี = null */
export function mapMatchEvents(rawMatch: unknown): MatchEvents {
  const m = obj(rawMatch);
  return { objectives: mapList(m.objectives, mapObjective), chat: mapList(m.chat, mapChat) };
}

/** log รายผู้เล่น · ฟิลด์ไม่มี = null */
export function mapPlayerEventLogs(rawPlayer: unknown): PlayerEventLogs {
  const p = obj(rawPlayer);
  return {
    runesLog: mapList(p.runes_log, mapTimed),
    obsLog: mapList(p.obs_log, mapWard),
    senLog: mapList(p.sen_log, mapWard),
    obsLeftLog: mapList(p.obs_left_log, mapWardLeft),
    senLeftLog: mapList(p.sen_left_log, mapWardLeft),
    killsLog: mapList(p.kills_log, mapTimed),
  };
}

// ---------- ป้ายแสดงผล ----------

/** รหัสรูนตาม rune_n ใน https://raw.githubusercontent.com/odota/web/master/src/lang/en-US.json · รหัสที่ไม่รู้จัก = "รูน #n" ไม่เดา */
const RUNES: Record<string, string> = {
  "0": "Double Damage", "1": "Haste", "2": "Illusion", "3": "Invisibility", "4": "Regeneration",
  "5": "Bounty", "6": "Arcane", "7": "Water", "8": "Wisdom", "9": "Shield",
};
export const runeName = (key: string | null): string => (key === null ? "–" : RUNES[key] ?? `รูน #${key}`);

/** วินาทีในเกม → "m:ss" · ติดลบ (ก่อนฮอร์น) = "-m:ss" · null = "–" */
export function gameTime(sec: number | null): string {
  if (sec === null) return "–";
  const s = Math.abs(Math.trunc(sec));
  return `${sec < 0 ? "-" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** ฝั่งจากค่า team ของ objectives (2 = Radiant · 3 = Dire ตาม OpenDota) · อื่น ๆ = null */
export const teamSide = (team: number | null): "Radiant" | "Dire" | null => (team === 2 ? "Radiant" : team === 3 ? "Dire" : null);

/** ฝั่งจาก player_slot (<128 Radiant) */
export const slotSide = (slot: number | null): "Radiant" | "Dire" | null => (slot === null ? null : slot < 128 ? "Radiant" : "Dire");

/** ฝั่งที่ "ได้" objective: building_kill = ฝั่งตรงข้ามเจ้าของสิ่งก่อสร้าง (อ่านจาก key goodguys/badguys · ครีปทำลายก็รู้ฝั่ง)
 *  ชนิดอื่น = player_slot ก่อน แล้ว team (2/3) · ไม่มีเลย = null (ไม่เดา) */
export function objectiveSide(o: MatchObjective): "Radiant" | "Dire" | null {
  if (o.type === "building_kill" && o.key) {
    if (o.key.includes("goodguys")) return "Dire";
    if (o.key.includes("badguys")) return "Radiant";
  }
  return slotSide(o.playerSlot) ?? teamSide(o.team);
}

/** ชื่อสิ่งก่อสร้างจาก key เช่น npc_dota_goodguys_tower1_mid → "ป้อม Radiant T1 กลาง" · รูปแบบอื่นแสดงชื่อดิบ (ไม่เดา) */
export function buildingName(key: string | null): string {
  if (!key) return "–";
  const side = key.includes("goodguys") ? "Radiant" : key.includes("badguys") ? "Dire" : null;
  const lane = key.endsWith("_mid") ? "กลาง" : key.endsWith("_top") ? "บน" : key.endsWith("_bot") ? "ล่าง" : null;
  const tower = /tower(\d)/.exec(key);
  const rax = /(melee|range)_rax|rax_(melee|range)/.exec(key); // รูปแบบจริง: npc_dota_badguys_melee_rax_top
  if (tower && side) return `ป้อม ${side} T${tower[1]}${lane ? ` ${lane}` : ""}`;
  if (rax && side) return `บาร์แร็ค ${side} ${(rax[1] ?? rax[2]) === "melee" ? "ระยะประชิด" : "ระยะไกล"}${lane ? ` ${lane}` : ""}`;
  if (key.endsWith("_fort") && side) return `ป้อมหลัก ${side}`;
  if (key.includes("healers") && side) return `ศาลเจ้า ${side}`;
  return key.replace(/^npc_dota_/, "").replace(/_/g, " ");
}

/** คำอธิบายเหตุการณ์ objective เป็นไทย · ชนิดที่ไม่รู้จัก = แสดงชนิดดิบ (ไม่เดา) · ผู้กระทำ (ถ้ามี) ให้หน้าเว็บต่อเอง */
export function objectiveLabel(o: MatchObjective): string {
  switch (o.type) {
    case "building_kill": return `ทำลาย ${buildingName(o.key)}`;
    case "CHAT_MESSAGE_ROSHAN_KILL": return `${teamSide(o.team) ?? "ไม่ทราบฝั่ง"} ฆ่า Roshan`;
    case "CHAT_MESSAGE_AEGIS": return "รับ Aegis";
    case "CHAT_MESSAGE_AEGIS_STOLEN": return "ขโมย Aegis";
    case "CHAT_MESSAGE_DENIED_AEGIS": return "ดีไนด์ Aegis";
    case "CHAT_MESSAGE_FIRSTBLOOD": return "First Blood";
    case "CHAT_MESSAGE_COURIER_LOST": return `คูเรียร์ของ ${teamSide(o.team) ?? "ไม่ทราบฝั่ง"} ถูกฆ่า`;
    case "CHAT_MESSAGE_TOWER_DENY": return "ดีไนด์ป้อม";
    case "CHAT_MESSAGE_BARRACKS_KILL": return "ทำลายบาร์แร็ค";
    default: return o.type.replace(/^CHAT_MESSAGE_/, "").replace(/_/g, " ").toLowerCase();
  }
}

/** ประเภทหลักของ objective สำหรับการ์ดสรุป */
export type ObjectiveKind = "tower" | "barracks" | "roshan" | "tormentor" | "other";
export function objectiveKind(o: MatchObjective): ObjectiveKind {
  if (o.type === "building_kill") {
    if (o.key?.includes("tower")) return "tower";
    if (o.key?.includes("rax")) return "barracks";
    return "other";
  }
  if (o.type.includes("ROSHAN")) return "roshan";
  if (o.type.toUpperCase().includes("TORMENTOR") || (o.key ?? "").includes("tormentor")) return "tormentor";
  return "other";
}

// ---------- ไทม์ไลน์รวม (แท็บ Log) ----------

export type TimelineEvent = {
  time: number | null;
  /** kill · objective · rune · ward · ward_lost · chat */
  kind: "kill" | "objective" | "rune" | "ward" | "ward_lost";
  /** ช่องผู้เล่นที่เกี่ยว (คนทำ) ถ้ามี */
  playerSlot: number | null;
  /** ข้อความที่ประกอบจากข้อมูลจริงเท่านั้น (ชื่อผู้เล่น/ฮีโร่ ให้หน้าเว็บเติม) */
  detail: string;
};

/** รวม kills_log · objectives · runes_log · obs/sen log ของทุกผู้เล่นเรียงตามเวลา · ทุกแหล่งเป็น null = null */
export function buildTimeline(
  events: MatchEvents,
  players: { slot: number | null; logs: PlayerEventLogs }[],
  heroName: (npc: string | null) => string,
): TimelineEvent[] | null {
  const out: TimelineEvent[] = [];
  let any = false;
  if (events.objectives) {
    any = true;
    for (const o of events.objectives) out.push({ time: o.time, kind: "objective", playerSlot: o.playerSlot, detail: objectiveLabel(o) });
  }
  for (const p of players) {
    const l = p.logs;
    if (l.killsLog) { any = true; for (const k of l.killsLog) out.push({ time: k.time, kind: "kill", playerSlot: p.slot, detail: `ฆ่า ${heroName(k.key)}` }); }
    if (l.runesLog) { any = true; for (const r of l.runesLog) out.push({ time: r.time, kind: "rune", playerSlot: p.slot, detail: `เก็บรูน ${runeName(r.key)}` }); }
    if (l.obsLog) { any = true; for (const w of l.obsLog) out.push({ time: w.time, kind: "ward", playerSlot: p.slot, detail: `วาง Observer ${w.key ?? ""}`.trim() }); }
    if (l.senLog) { any = true; for (const w of l.senLog) out.push({ time: w.time, kind: "ward", playerSlot: p.slot, detail: `วาง Sentry ${w.key ?? ""}`.trim() }); }
    if (l.obsLeftLog) { any = true; for (const w of l.obsLeftLog) out.push({ time: w.time, kind: "ward_lost", playerSlot: p.slot, detail: `Observer ${w.key ?? ""} หายไป${w.attacker ? ` (โดย ${heroName(w.attacker)})` : ""}`.replace("  ", " ") }); }
    if (l.senLeftLog) { any = true; for (const w of l.senLeftLog) out.push({ time: w.time, kind: "ward_lost", playerSlot: p.slot, detail: `Sentry ${w.key ?? ""} หายไป${w.attacker ? ` (โดย ${heroName(w.attacker)})` : ""}`.replace("  ", " ") }); }
  }
  if (!any) return null;
  // เรียงตามเวลา · ไม่มีเวลาไปท้ายสุด · เสถียร (รักษาลำดับเดิมเมื่อเวลาเท่ากัน)
  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.time ?? Infinity) - (b.e.time ?? Infinity) || a.i - b.i)
    .map(({ e }) => e);
}
