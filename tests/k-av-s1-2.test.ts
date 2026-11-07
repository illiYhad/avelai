import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeMatchScore, fromOpenDotaMatch, openDotaParseStatus, PENDING_PARSING_LABEL } from "@/lib/avelai/score";
import { heroKeyById } from "@/lib/avelai/score/hero-keys";

// K-AV-S1.2: กติกา Pending Parsing (คำตัดสินพี่ศิลา 2026-11-07 · FROM_SILA_20261107_S1_Damage_Policy)
// แมตช์ที่ OpenDota ยังไม่วิเคราะห์ → DmgTaken = null ห้ามนับ 0 · ไม่ยิงเครือข่าย (fixture ย่อจาก JSON จริง 2026-11-07)

const load = (n: string) => JSON.parse(readFileSync(join(__dirname, n), "utf8")) as Record<string, unknown>;
const PARSED = load("fixtures-k-av-s1-2-parsed.json"); // 8214277203 · has_parsed true
const UNPARSED = load("fixtures-k-av-s1-2-unparsed.json"); // 8449754703 · has_parsed false · version null

// แมตช์สังเคราะห์ 4 คน: Tusk 100 + Lion 26 (Radiant) ชนะ · Sniper 35 + Mars 129 (Dire)
const synth = (dt: unknown[], od?: unknown) => ({
  radiant_win: true,
  ...(od === undefined ? {} : { od_data: od }),
  players: [
    { player_slot: 0, hero_id: 100, kills: 1, deaths: 1, assists: 1, tower_kills: 0, obs_placed: 1, sen_placed: 1, hero_healing: 0, stuns: 1, damage_taken: dt[0] },
    { player_slot: 1, hero_id: 26, kills: 1, deaths: 1, assists: 1, tower_kills: 0, obs_placed: 1, sen_placed: 1, hero_healing: 0, stuns: 1, damage_taken: dt[1] },
    { player_slot: 128, hero_id: 35, kills: 1, deaths: 1, assists: 1, tower_kills: 0, obs_placed: 1, sen_placed: 1, hero_healing: 0, stuns: 1, damage_taken: dt[2] },
    { player_slot: 129, hero_id: 129, kills: 1, deaths: 1, assists: 1, tower_kills: 0, obs_placed: 1, sen_placed: 1, hero_healing: 0, stuns: 1, damage_taken: dt[3] },
  ],
});
const dmg = (rows: ReturnType<typeof fromOpenDotaMatch>) => rows.map((r) => r.input.damageTaken);

describe("K-AV-S1.2 · Pending Parsing", () => {
  it("a) fixture unparsed → pending · DmgTaken null ทุกแถว · Total null · missing มี damageTaken", () => {
    expect(openDotaParseStatus(UNPARSED)).toBe("pending");
    const rows = fromOpenDotaMatch(UNPARSED, heroKeyById);
    expect(rows).toHaveLength(10);
    expect(dmg(rows).every((v) => v === null)).toBe(true);
    for (const r of rows) {
      expect(r.parseStatus).toBe("pending");
      const s = computeMatchScore(r.input);
      expect(s.totalScore).toBeNull();
      expect(s.missing).toContain("damageTaken");
    }
  });

  it("b) fixture parsed → parsed · DmgTaken เป็นตัวเลขทุกแถว", () => {
    expect(openDotaParseStatus(PARSED)).toBe("parsed");
    const rows = fromOpenDotaMatch(PARSED, heroKeyById);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.parseStatus === "parsed")).toBe(true);
    const nums = dmg(rows).filter((v): v is number => typeof v === "number");
    expect(nums.length).toBeGreaterThanOrEqual(1);
    expect(nums.some((v) => v > 0)).toBe(true);
  });

  it("c) has_parsed true แต่ damage_taken เป็น {} ทุกคน → pending · null", () => {
    const m = synth([{}, {}, {}, {}], { has_parsed: true });
    expect(openDotaParseStatus(m)).toBe("pending");
    expect(dmg(fromOpenDotaMatch(m, heroKeyById))).toEqual([null, null, null, null]);
  });

  it("d) damage_taken มีแต่ค่า 0 ทุกคน → pending · null", () => {
    const m = synth([{ npc_dota_hero_sniper: 0 }, { npc_dota_hero_mars: 0 }, { npc_dota_hero_tusk: 0 }, { npc_dota_hero_lion: 0 }], { has_parsed: true });
    expect(openDotaParseStatus(m)).toBe("pending");
    expect(dmg(fromOpenDotaMatch(m, heroKeyById))).toEqual([null, null, null, null]);
  });

  it("e) parsed · ผู้เล่น 1 คนโดนฝั่งตรงข้ามตี 0 จริง (คนอื่นมีค่า) → ได้ 0 ไม่ใช่ null", () => {
    // Lion โดนแค่เพื่อน (tusk 7) → ดาเมจจากฝั่งตรงข้าม = 0
    const m = synth([{ npc_dota_hero_sniper: 300 }, { npc_dota_hero_tusk: 7 }, { npc_dota_hero_tusk: 500 }, { npc_dota_hero_lion: 50 }], { has_parsed: true });
    expect(openDotaParseStatus(m)).toBe("parsed");
    expect(dmg(fromOpenDotaMatch(m, heroKeyById))).toEqual([300, 0, 500, 50]);
  });

  it("f) has_parsed false แม้มีตัวเลขครบ → pending · null", () => {
    const m = synth([{ npc_dota_hero_sniper: 300 }, { npc_dota_hero_mars: 9 }, { npc_dota_hero_tusk: 500 }, { npc_dota_hero_lion: 50 }], { has_parsed: false });
    expect(openDotaParseStatus(m)).toBe("pending");
    const rows = fromOpenDotaMatch(m, heroKeyById);
    expect(dmg(rows)).toEqual([null, null, null, null]);
    expect(rows.every((r) => r.parseStatus === "pending")).toBe(true);
  });

  it("g) ข้อความ PENDING_PARSING_LABEL ตรงทุกตัวอักษร", () => {
    expect(PENDING_PARSING_LABEL).toBe("รอการวิเคราะห์เชิงลึก (Pending Parsing)");
  });

  it("od_data หายไปเฉย ๆ แต่มีดาเมจจริง = parsed (เทสเดิมข้อ 25 ไม่มี od_data)", () => {
    expect(openDotaParseStatus(synth([{ npc_dota_hero_sniper: 1 }, {}, {}, {}]))).toBe("parsed");
  });
});
