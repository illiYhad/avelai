// K-AV-RULES.1: แปลงช่องกรอกของตัวคำนวณ → PlayerMatchInput แล้วจัดรูปผลจาก computeMatchScore() / formLevel() จริง
// ไม่มีสูตรคะแนนในไฟล์นี้ · ทุกตัวเลขมาจาก lib/avelai/score
import { computeMatchScore, formLevel, type MatchScoreResult, type PlayerMatchInput } from "@/lib/avelai/score";

export type CalcFields = {
  won: boolean;
  kills: string;
  deaths: string;
  assists: string;
  towers: string;
  wards: string;
  heal: string;
  stuns: string;
  dmgTaken: string;
};

/** ค่าเริ่มต้น = ตัวอย่างในใบแม่ (TO_NOVA_20261107-1622) · ต้องได้ Total 41.20 · Match 3.825 · Level 15 */
export const EXAMPLE_FIELDS: CalcFields = {
  won: true, kills: "3", deaths: "5", assists: "18", towers: "2", wards: "6", heal: "6000", stuns: "45", dmgTaken: "12000",
};

const NUM_KEYS = ["kills", "deaths", "assists", "towers", "wards", "heal", "stuns", "dmgTaken"] as const;

/** ช่องว่างหรือไม่ใช่ตัวเลข ≥ 0 = null (ตัวคำนวณจะแสดง "กรอกให้ครบ" ไม่แสดง 0) */
export function parseFields(f: CalcFields): PlayerMatchInput | null {
  const n: Record<string, number> = {};
  for (const k of NUM_KEYS) {
    const s = f[k].trim();
    const v = Number(s);
    if (s === "" || !Number.isFinite(v) || v < 0) return null;
    n[k] = v;
  }
  // ช่อง Wards ช่องเดียว = Observer + Sentry รวม (สูตรใช้ผลรวม) → ใส่ทั้งหมดที่ obsPlaced · senPlaced = 0
  return {
    won: f.won, kills: n.kills, deaths: n.deaths, assists: n.assists, towers: n.towers,
    obsPlaced: n.wards, senPlaced: 0, heroHealing: n.heal, stuns: n.stuns, damageTaken: n.dmgTaken,
  };
}

const fix = (v: number, d: number) => (Math.round(v * 10 ** d + 1e-9 * Math.sign(v)) / 10 ** d).toFixed(d);
const signed = (v: number, d: number) => (v > 0 ? "+" : "") + fix(v, d);

export type CalcView =
  | { ok: false; message: string }
  | {
      ok: true;
      result: MatchScoreResult;
      outcome: string;
      baseKp: string;
      floored: boolean;
      multiplier: string;
      kpAfter: string;
      role: { wards: string; heal: string; stuns: string; dmgTaken: string; total: string };
      total: string;
      match: string;
      level: string;
    };

/** ผลที่หน้าแสดง · Total 2 ตำแหน่ง · Match Score 3 ตำแหน่ง (เลี่ยง toFixed(2) ปัด 3.825 เป็น 3.82) */
export function calcView(f: CalcFields): CalcView {
  const input = parseFields(f);
  if (!input) return { ok: false, message: "กรอกให้ครบ" };
  const r = computeMatchScore(input);
  if (r.totalScore === null || r.matchScore === null || r.outcome === null || r.baseKp.value === null
    || r.multiplier === null || r.kpAfterMultiplier === null || r.roleBonus.value === null) {
    return { ok: false, message: "กรอกให้ครบ" };
  }
  const p = r.roleBonus.parts;
  const lv = formLevel(r.matchScore);
  return {
    ok: true,
    result: r,
    outcome: signed(r.outcome, 0),
    baseKp: fix(r.baseKp.value, 2),
    floored: r.baseKp.floored,
    multiplier: "×" + fix(r.multiplier, 1),
    kpAfter: signed(r.kpAfterMultiplier, 2),
    role: {
      wards: fix(p.wards ?? 0, 2), heal: fix(p.heal ?? 0, 2), stuns: fix(p.stuns ?? 0, 2), dmgTaken: fix(p.dmgTaken ?? 0, 2),
      total: fix(r.roleBonus.value, 2),
    },
    total: fix(r.totalScore, 2),
    match: fix(r.matchScore, 3),
    level: lv ? `Level ${lv.level} (${lv.tier})` : "—",
  };
}
