// K-AV-D3: map ข้อมูลแมตช์ Dota 2 จาก OpenDota — pure ทั้งไฟล์ (เทสได้โดยไม่ยิงเครือข่าย)
// map เฉพาะฟิลด์ที่หน้า D3 ใช้จริง · ฟิลด์วิเคราะห์ของแท็บ D4–D7 เพิ่มตอนใบที่ใช้
// ห้ามมี fallback หรือข้อมูลตัวอย่างในไฟล์นี้เด็ดขาด — ค่าที่อ่านไม่ได้ = null

import { kda, num, type DotaMatchPlayer, type DotaPickBan } from "@/lib/dota/opendota";
import { mapMatchB, mapPlayerB, type MatchB, type PlayerB } from "@/lib/dota/match/b-tabs"; // K-AV-D5

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** ผู้เล่นหนึ่งคนในหน้าแมตช์ — ต่อยอดจาก DotaMatchPlayer ของ D2 ด้วยฟิลด์ที่หน้า D3 แสดง */
export type DotaMatchDetailPlayer = DotaMatchPlayer & {
  accountId: string | null;
  slot: number | null;
  level: number | null;
  netWorth: number | null;
  neutralItem: number | null;
  hasScepter: boolean;
  hasShard: boolean;
  // K-AV-D4: ฟิลด์วิเคราะห์ (มีเฉพาะแมตช์ที่ parse แล้ว) — ขาด = null ห้ามเป็น 0
  lane: number | null;
  laneRole: number | null;
  /** เวลาควบคุม (วินาที) จาก stuns */
  stuns: number | null;
  obsPlaced: number | null;
  senPlaced: number | null;
  /** damage_taken ดิบ: ผู้ทำดาเมจ (npc_dota_hero_* / *_tower* / อื่น ๆ) → ดาเมจ · ยังไม่วิเคราะห์ = null */
  damageTaken: Record<string, number> | null;
  /** damage_targets ดิบ: สกิล/ไอเทม → เป้าหมาย → ดาเมจ · ไม่มี = null */
  damageTargets: Record<string, Record<string, number>> | null;
} & { b: PlayerB }; // K-AV-D5: ข้อมูลแท็บ Builds · Lanes · Farm · Kills (ฟิลด์ย่อยไม่มี = null)

export type DotaMatchDetail = {
  matchId: string;
  /** มาจาก od_data.has_parsed เท่านั้น — ไม่เดาจากฟิลด์อื่น */
  isParsed: boolean;
  radiantWin: boolean | null;
  duration: number | null;
  startTime: number | null;
  gameMode: number | null;
  lobbyType: number | null;
  /** region จาก OpenDota · ไม่มีข้อมูล = null (ห้ามเดา) */
  region: number | null;
  radiantScore: number | null;
  direScore: number | null;
  radiantTeamName: string | null;
  direTeamName: string | null;
  players: DotaMatchDetailPlayer[];
  picksBans: DotaPickBan[];
} & { b: MatchB }; // K-AV-D5: ส่วนต่างทอง/XP รายนาที (ไม่มี = null)

const flag = (v: unknown): boolean => v === 1 || v === true;
const posInt = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
};

function mapPlayer(raw: unknown): DotaMatchDetailPlayer {
  const p = obj(raw);
  const kills = num(p.kills);
  const deaths = num(p.deaths);
  const assists = num(p.assists);
  const slot = num(p.player_slot);
  const accountId = num(p.account_id);
  return {
    name: str(p.personaname) ?? "Anonymous",
    isRadiant: typeof p.isRadiant === "boolean" ? p.isRadiant : slot === null ? null : slot < 128,
    heroId: num(p.hero_id),
    kills,
    deaths,
    assists,
    kda: kda(kills, deaths, assists),
    lastHits: num(p.last_hits),
    denies: num(p.denies),
    gpm: num(p.gold_per_min),
    xpm: num(p.xp_per_min),
    heroDamage: num(p.hero_damage),
    towerDamage: num(p.tower_damage),
    heroHealing: num(p.hero_healing),
    items: [0, 1, 2, 3, 4, 5].map((i) => posInt(p[`item_${i}`])),
    accountId: accountId === null ? null : String(accountId),
    slot,
    level: num(p.level),
    netWorth: num(p.net_worth),
    neutralItem: posInt(p.item_neutral),
    hasScepter: flag(p.aghanims_scepter),
    hasShard: flag(p.aghanims_shard),
    lane: num(p.lane),
    laneRole: num(p.lane_role),
    stuns: num(p.stuns),
    obsPlaced: num(p.obs_placed),
    senPlaced: num(p.sen_placed),
    damageTaken: numRecord(p.damage_taken),
    damageTargets: nestedNumRecord(p.damage_targets),
    b: mapPlayerB(p), // K-AV-D5
  };
}

// K-AV-D4: อ่าน object ตัวเลขจาก JSON — ไม่ใช่ object = null · ค่าที่ไม่ใช่ตัวเลขถูกข้าม (ไม่แต่งเป็น 0)
function numRecord(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v as Obj)) {
    const n = num(x);
    if (n !== null) out[k] = n;
  }
  return out;
}
function nestedNumRecord(v: unknown): Record<string, Record<string, number>> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, Record<string, number>> = {};
  for (const [k, x] of Object.entries(v as Obj)) {
    const inner = numRecord(x);
    if (inner) out[k] = inner;
  }
  return out;
}

/** แปลง JSON ของ /matches/{id} เป็นชนิดข้อมูลที่หน้าเว็บใช้
 *  JSON เพี้ยนหรือฟิลด์ขาด = ค่านั้นเป็น null ไม่ใช่ค่าที่แต่งขึ้น */
export function mapMatchDetail(matchId: string, raw: unknown): DotaMatchDetail {
  const m = obj(raw);
  return {
    matchId,
    isParsed: obj(m.od_data).has_parsed === true,
    radiantWin: typeof m.radiant_win === "boolean" ? m.radiant_win : null,
    duration: num(m.duration),
    startTime: num(m.start_time),
    gameMode: num(m.game_mode),
    lobbyType: num(m.lobby_type),
    region: num(m.region),
    radiantScore: num(m.radiant_score),
    direScore: num(m.dire_score),
    radiantTeamName: str(obj(m.radiant_team).name),
    direTeamName: str(obj(m.dire_team).name),
    players: arr(m.players).slice(0, 10).map(mapPlayer),
    b: mapMatchB(m), // K-AV-D5
    picksBans: arr(m.picks_bans).map((x): DotaPickBan => {
      const o = obj(x);
      return { isPick: o.is_pick === true, heroId: num(o.hero_id), team: num(o.team), order: num(o.order) };
    }),
  };
}

/** ภูมิภาคที่ OpenDota ใช้ (constants/region) — ค่าที่ไม่รู้จักหรือไม่มี = null ไม่เดา */
const REGIONS: Record<number, string> = {
  1: "US West", 2: "US East", 3: "Europe West", 5: "SE Asia", 6: "Dubai", 7: "Australia",
  8: "Russia", 9: "Europe East", 10: "South America", 11: "South Africa", 12: "China",
  13: "China", 14: "Chile", 15: "Peru", 16: "India", 17: "China", 18: "China",
  19: "Japan", 20: "China", 25: "China", 37: "Taiwan", 38: "Argentina",
};
export const regionLabel = (v: number | null): string | null => (v === null ? null : REGIONS[v] ?? null);
