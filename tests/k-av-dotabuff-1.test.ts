// K-AV-DOTABUFF.1: เทสชั้นข้อมูล 28 รายการ · ค่าจริงของ GET /matches/8214277203 (ดึง 2026-11-06 17:42 · ตัดเฉพาะฟิลด์ที่ใช้)
// ไฟล์ fixture: tests/fixtures-k-av-dotabuff-1.json · ไม่ยิงเครือข่าย
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import raw from "./fixtures-k-av-dotabuff-1.json";
import { mapMatchDetail } from "@/lib/dota/match/map";
import { laneSummaries } from "@/lib/dota/match/b-tabs";
import {
  decodeBarracks, decodeTowers, goldLost, itemCount, killGold, killMatrix, killParticipation, lastPurchaseTime,
  laneOutcome, lhAtMinutes, chartMarkers, runeCounts, teamfightDamage, teamfightDeaths,
  LANE_OUTCOME_MINUTE, LANE_OUTCOME_MIN_RATIO,
} from "@/lib/dota/match/d-full";

const m = mapMatchDetail("8214277203", raw);
const p0 = m.players[0];

describe("K-AV-DOTABUFF.1 · ค่าจริงแมตช์ 8214277203", () => {
  it("ผู้เล่น slot 0 (hero 26): % มีส่วนร่วม 21/32 · ทองจากการฆ่า 2278 · ทองที่เสีย 235 · LH 4/8/12 = 3/6/16", () => {
    expect(p0.heroId).toBe(26);
    expect(killParticipation(p0.kills, p0.assists, m.radiantScore)).toBe(21 / 32);
    expect(killGold(p0.d.goldReasons)).toBe(2278);
    expect(goldLost(p0.d.goldReasons)).toBe(235);
    expect(lhAtMinutes(p0.b.lhT)).toEqual([3, 6, 16]);
  });

  it("บิตป้อม/ค่าย: Radiant 1975 เสียกลาง T1 กับล่าง T1 · Dire 256 เหลือล่าง T3 · ค่าย Dire 48 เหลือค่ายล่าง", () => {
    const r = decodeTowers(m.d.towerStatusRadiant)!;
    expect(r.filter((t) => !t.alive).map((t) => `${t.lane}${t.tier}`)).toEqual(["mid1", "bot1"]);
    const d = decodeTowers(m.d.towerStatusDire)!;
    expect(d.filter((t) => t.alive).map((t) => `${t.lane}${t.tier}`)).toEqual(["bot3"]);
    const b = decodeBarracks(m.d.barracksStatusDire)!;
    expect(b.filter((x) => x.alive).map((x) => `${x.lane}-${x.kind}`)).toEqual(["bot-melee", "bot-ranged"]);
    expect(decodeBarracks(m.d.barracksStatusRadiant)!.every((x) => x.alive)).toBe(true);
  });

  it("ผลเลน: เลน 1 Radiant ชนะ (6333 กับ 5238) · เลน 2 และ 3 ไม่ตัดสิน (จำนวนคนต่างกัน)", () => {
    expect(LANE_OUTCOME_MINUTE).toBe(10);
    expect(LANE_OUTCOME_MIN_RATIO).toBe(0.1);
    const s = laneSummaries(m.players, LANE_OUTCOME_MINUTE);
    const l1 = s.find((x) => x.lane === 1)!;
    expect([l1.radiantGold, l1.direGold]).toEqual([6333, 5238]);
    expect(laneOutcome(l1)).toBe("radiant");
    expect(laneOutcome(s.find((x) => x.lane === 2)!)).toBe("uneven");
    expect(laneOutcome(s.find((x) => x.lane === 3)!)).toBe("uneven");
  });

  it("เกณฑ์ผลเลน: ต่างน้อยกว่า 10% = เสมอ · ทองขาด = ไม่มีข้อมูล", () => {
    const base = { lane: 1, radiant: 1, dire: 1, radiantXp: null, direXp: null };
    expect(laneOutcome({ ...base, radiantGold: 1000, direGold: 950 })).toBe("draw");
    expect(laneOutcome({ ...base, radiantGold: 900, direGold: 1000 })).toBe("dire");
    expect(laneOutcome({ ...base, radiantGold: null, direGold: 1000 })).toBe("nodata");
  });

  it("บัฟถาวรและลำดับสกิลอ่านจากข้อมูลจริง", () => {
    expect(p0.d.permanentBuffs).toEqual([{ buffId: 7, stacks: 6 }, { buffId: 12, stacks: 0 }]);
    expect(p0.d.abilityUpgrades).toEqual([5044, 5045, 5046]);
  });
});

describe("K-AV-DOTABUFF.1 · ฟิลด์ขาด = null ไม่ใช่ 0", () => {
  const e = mapMatchDetail("1", { players: [{}] });
  const q = e.players[0];
  it("ทุกรายการ", () => {
    expect(q.d).toEqual({ permanentBuffs: null, abilityUpgrades: null, goldReasons: null, purchase: null });
    expect(e.d).toEqual({ towerStatusRadiant: null, towerStatusDire: null, barracksStatusRadiant: null, barracksStatusDire: null, teamfights: null });
    expect(decodeTowers(null)).toBeNull();
    expect(decodeBarracks(null)).toBeNull();
    expect(killParticipation(null, 1, 10)).toBeNull();
    expect(killParticipation(1, 1, 0)).toBeNull();
    expect(killGold(null)).toBeNull();
    expect(killGold({ "1": -5 })).toBeNull();
    expect(goldLost(null)).toBeNull();
    expect(goldLost({ "12": 5 })).toBeNull();
    expect(lhAtMinutes(null)).toEqual([null, null, null]);
    expect(lhAtMinutes([0, 1, 2])).toEqual([null, null, null]);
    expect(lastPurchaseTime(null, "blink")).toBeNull();
    expect(lastPurchaseTime([{ time: 5, key: "tango", charges: null }], "blink")).toBeNull();
    expect(itemCount(null, "dust")).toBeNull();
    expect(itemCount({ smoke_of_deceit: 3 }, "gem")).toBeNull();
    expect(chartMarkers(null)).toBeNull();
    expect(teamfightDamage(null)).toBeNull();
    expect(teamfightDeaths(null)).toBeNull();
    expect(runeCounts([null, null])).toBeNull();
    expect(killMatrix([{ killed: null }], ["npc_dota_hero_lion"])).toEqual([[null]]);
  });

  it("ค่าจริงที่เป็น 0 ยังเป็น 0", () => {
    expect(killMatrix([{ killed: {} }], ["npc_dota_hero_lion"])).toEqual([[0]]);
    expect(lastPurchaseTime([{ time: 100, key: "blink", charges: null }, { time: 900, key: "blink", charges: null }], "blink")).toBe(900);
    expect(runeCounts([[{ key: "5" }, { key: "5" }], null])).toEqual({ "5": 2 });
  });
});
