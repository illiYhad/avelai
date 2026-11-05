import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  advMinutes, atMinute, gameClock, isConsumable, isHeroUnit, killsOn, killTimeline, laneLabel, laneRoleLabel,
  laneSummaries, mapMatchB, mapPlayerB, recordTotal,
} from "@/lib/dota/match/b-tabs";
import { mapMatchDetail } from "@/lib/dota/match/map";

// K-AV-D5: map ของแท็บ Builds · Lanes · Farm · Kills — ไม่ยิงเครือข่าย
// โครง fixture ย่อจากคำตอบจริงของ GET /matches/8214277203 (ตัดให้สั้น · ตัวเลขในอนุกรมแต่งให้คิดมือได้)

const PARSED_PLAYER = {
  player_slot: 0,
  hero_id: 26,
  purchase_log: [
    { time: -89, key: "tango", charges: 6 },
    { time: -89, key: "circlet" },
    { time: 259, key: "boots" },
    { time: 700, key: "blink" },
  ],
  item_uses: { tango: 6, blink: 25 },
  lane: 1,
  lane_role: 1,
  is_roaming: false,
  lane_efficiency_pct: 42,
  times: [0, 60, 120],
  gold_t: [0, 195, 330],
  xp_t: [0, 118, 337],
  lh_t: [0, 1, 2],
  dn_t: [0, 0, 1],
  total_gold: 11433,
  total_xp: 13274,
  gold_spent: 9960,
  actions_per_min: 172,
  kills_log: [{ time: 889, key: "npc_dota_hero_morphling" }],
  killed: { npc_dota_hero_morphling: 1, npc_dota_creep_badguys_melee: 14 },
  killed_by: { npc_dota_hero_faceless_void: 2 },
  buyback_log: [{ time: 2549, type: "buyback_log", slot: 0 }],
  multi_kills: { "2": 3, "3": 1 },
  kill_streaks: {},
  life_state_dead: 80,
};

describe("mapPlayerB · ปกติ", () => {
  const b = mapPlayerB(PARSED_PLAYER);

  it("Builds: ลำดับซื้อพร้อมเวลาและ charges · ของที่กดใช้", () => {
    expect(b.purchaseLog).toEqual([
      { time: -89, key: "tango", charges: 6 },
      { time: -89, key: "circlet", charges: null },
      { time: 259, key: "boots", charges: null },
      { time: 700, key: "blink", charges: null },
    ]);
    expect(b.itemUses).toEqual({ tango: 6, blink: 25 });
  });

  it("Lanes: เลน · บทบาท · โรม · ประสิทธิภาพ", () => {
    expect([b.lane, b.laneRole, b.isRoaming, b.laneEfficiencyPct]).toEqual([1, 1, false, 42]);
  });

  it("Farm: อนุกรมรายนาทีและยอดรวม", () => {
    expect(b.goldT).toEqual([0, 195, 330]);
    expect(b.lhT).toEqual([0, 1, 2]);
    expect([b.totalGold, b.totalXp, b.goldSpent, b.apm]).toEqual([11433, 13274, 9960, 172]);
  });

  it("Kills: log · killed · บายแบ็ก · มัลติคิล · เวลาตาย", () => {
    expect(b.killsLog).toEqual([{ time: 889, key: "npc_dota_hero_morphling" }]);
    expect(b.killed).toEqual({ npc_dota_hero_morphling: 1, npc_dota_creep_badguys_melee: 14 });
    expect(b.buybackTimes).toEqual([2549]);
    expect(b.multiKills).toEqual({ "2": 3, "3": 1 });
    expect(b.killStreaks).toEqual({}); // มีฟิลด์แต่ว่าง = {} (ค่าจริง) ไม่ใช่ null
    expect(b.deadSeconds).toBe(80);
  });
});

describe("mapPlayerB · ฟิลด์ขาด / null / JSON เพี้ยน", () => {
  it("แมตช์ยังไม่วิเคราะห์ (ไม่มีฟิลด์วิเคราะห์เลย) = null ทุกช่อง ไม่มี 0 หรือ [] แต่ง", () => {
    const b = mapPlayerB({ player_slot: 0, hero_id: 26, kills: 3 });
    for (const [k, v] of Object.entries(b)) expect(v, k).toBeNull();
  });

  it("ฟิลด์เป็น null ตรง ๆ = null", () => {
    const b = mapPlayerB({ purchase_log: null, gold_t: null, lane: null, killed: null, buyback_log: null, is_roaming: null });
    expect([b.purchaseLog, b.goldT, b.lane, b.killed, b.buybackTimes, b.isRoaming]).toEqual([null, null, null, null, null, null]);
  });

  it("ชนิดข้อมูลผิด = null ไม่พัง", () => {
    const b = mapPlayerB({
      purchase_log: "x", item_uses: [1, 2], lane: "1", is_roaming: 1, gold_t: { a: 1 }, kills_log: 5, killed: "no",
      buyback_log: {}, multi_kills: [], life_state_dead: "80", total_gold: NaN,
    });
    expect(b.purchaseLog).toBeNull();
    expect(b.itemUses).toBeNull();
    expect(b.lane).toBeNull();
    expect(b.isRoaming).toBeNull();
    expect(b.goldT).toBeNull();
    expect(b.killsLog).toBeNull();
    expect(b.killed).toBeNull();
    expect(b.buybackTimes).toBeNull();
    expect(b.multiKills).toBeNull();
    expect(b.deadSeconds).toBeNull();
    expect(b.totalGold).toBeNull();
  });

  it("รายการข้างในเพี้ยน: ไม่มี key ถูกทิ้ง · เวลาไม่ใช่ตัวเลข = null · ช่องอนุกรมเพี้ยน = null ในช่องนั้น", () => {
    const b = mapPlayerB({
      purchase_log: [{ time: 10, key: "boots" }, { time: 20 }, null, "junk", { time: "30", key: "blink" }],
      gold_t: [0, "195", null, 330],
      item_uses: { blink: 2, bad: "x" },
      buyback_log: [{ time: 100 }, {}, null],
    });
    expect(b.purchaseLog).toEqual([
      { time: 10, key: "boots", charges: null },
      { time: null, key: "blink", charges: null },
    ]);
    expect(b.goldT).toEqual([0, null, null, 330]);
    expect(b.itemUses).toEqual({ blink: 2 });
    expect(b.buybackTimes).toEqual([100, null, null]);
  });

  it("raw ไม่ใช่ object เลย (null · string · array) ไม่พัง", () => {
    for (const raw of [null, undefined, "x", 5, []]) {
      const b = mapPlayerB(raw);
      expect(b.purchaseLog).toBeNull();
      expect(b.lane).toBeNull();
    }
  });
});

describe("mapMatchB และ mapMatchDetail", () => {
  it("ส่วนต่างทีมรายนาที · ไม่มี = null", () => {
    expect(mapMatchB({ radiant_gold_adv: [0, -120, 300], radiant_xp_adv: [0, 50, -10] })).toEqual({
      radiantGoldAdv: [0, -120, 300],
      radiantXpAdv: [0, 50, -10],
    });
    expect(mapMatchB({})).toEqual({ radiantGoldAdv: null, radiantXpAdv: null });
    expect(mapMatchB({ radiant_gold_adv: null, radiant_xp_adv: "x" })).toEqual({ radiantGoldAdv: null, radiantXpAdv: null });
    expect(mapMatchB(null)).toEqual({ radiantGoldAdv: null, radiantXpAdv: null });
  });

  it("mapMatchDetail ใส่ b ให้ทั้งแมตช์และผู้เล่น โดยฟิลด์เดิมของ D3 ไม่เปลี่ยน", () => {
    const m = mapMatchDetail("8214277203", {
      od_data: { has_parsed: true },
      radiant_gold_adv: [0, 100],
      players: [{ ...PARSED_PLAYER, kills: 1, deaths: 2, assists: 3, gold_per_min: 416 }, { player_slot: 128 }],
    });
    expect(m.b.radiantGoldAdv).toEqual([0, 100]);
    expect(m.b.radiantXpAdv).toBeNull();
    expect(m.players[0].b.lane).toBe(1);
    expect(m.players[0].gpm).toBe(416);
    expect(m.players[0].isRadiant).toBe(true);
    expect(m.players[1].b.purchaseLog).toBeNull();
    expect(m.players[1].isRadiant).toBe(false);
  });

  it("JSON เพี้ยนทั้งก้อนไม่พัง", () => {
    const m = mapMatchDetail("1", { players: [null, "x", 5] });
    expect(m.players).toHaveLength(3);
    for (const p of m.players) expect(p.b.goldT).toBeNull();
    expect(m.b).toEqual({ radiantGoldAdv: null, radiantXpAdv: null });
  });
});

describe("ตัวช่วยของหน้าแท็บ", () => {
  it("atMinute: นาทีที่มี · เกมจบก่อน = null (ไม่ใช้ค่าสุดท้ายแทน) · ไม่มีอนุกรม = null", () => {
    expect(atMinute([0, 195, 330], 2)).toBe(330);
    expect(atMinute([0, 195, 330], 0)).toBe(0); // 0 ที่เป็นค่าจริงต้องคงเป็น 0
    expect(atMinute([0, 195, 330], 10)).toBeNull();
    expect(atMinute([0, null, 330], 1)).toBeNull();
    expect(atMinute(null, 2)).toBeNull();
    expect(atMinute([1, 2], -1)).toBeNull();
  });

  it("gameClock: ก่อนเริ่มเกมติดลบ · null = –", () => {
    expect(gameClock(889)).toBe("14:49");
    expect(gameClock(-89)).toBe("-1:29");
    expect(gameClock(0)).toBe("0:00");
    expect(gameClock(null)).toBe("–");
  });

  it("ป้ายเลน/บทบาท: ค่าที่ไม่รู้จัก = null ไม่เดา", () => {
    expect([laneLabel(1), laneLabel(2), laneLabel(3)]).toEqual(["ล่าง", "กลาง", "บน"]);
    expect(laneLabel(9)).toBeNull();
    expect(laneLabel(null)).toBeNull();
    expect(laneRoleLabel(3)).toBe("Off Lane");
    expect(laneRoleLabel(0)).toBeNull();
  });

  it("แยกของสิ้นเปลืองและยูนิตฮีโร่", () => {
    expect(isConsumable("tango")).toBe(true);
    expect(isConsumable("blink")).toBe(false);
    expect(isHeroUnit("npc_dota_hero_lion")).toBe(true);
    expect(isHeroUnit("npc_dota_creep_badguys_melee")).toBe(false);
  });

  it("laneSummaries: รวมทอง/XP ตามเลนและฝั่ง · มีคนขาดค่า = null ทั้งผลรวม · ฝั่งที่ไม่มีคน = null", () => {
    const mk = (isRadiant: boolean | null, lane: number | null, gold: number[] | null, xp: number[] | null) => ({
      isRadiant,
      b: mapPlayerB({ lane, gold_t: gold, xp_t: xp }),
    });
    const rows = laneSummaries(
      [
        mk(true, 1, [0, 100], [0, 10]),
        mk(true, 1, [0, 150], [0, 20]),
        mk(false, 1, [0, 300], null), // ทองมี · XP ไม่มี
        mk(true, 2, [0, 500], [0, 50]),
        mk(null, null, [0, 999], [0, 999]), // ไม่มีเลน = ไม่ถูกนับ
      ],
      1,
    );
    // เลน 1: Radiant 100+150 = 250 · Dire 300 · XP Radiant 10+20 = 30 · XP Dire ขาด = null
    expect(rows[0]).toEqual({ lane: 1, radiant: 2, dire: 1, radiantGold: 250, direGold: 300, radiantXp: 30, direXp: null });
    // เลน 2: มีแต่ Radiant
    expect(rows[1]).toEqual({ lane: 2, radiant: 1, dire: 0, radiantGold: 500, direGold: null, radiantXp: 50, direXp: null });
    expect(rows).toHaveLength(2);
    expect(laneSummaries([mk(true, null, null, null)], 10)).toEqual([]);
  });

  it("killTimeline: เรียงตามเวลา · ทุกคนไม่มี log = null · มี log ว่าง = []", () => {
    const a = { b: mapPlayerB({ kills_log: [{ time: 900, key: "npc_dota_hero_a" }, { time: 100, key: "npc_dota_hero_b" }] }) };
    const c = { b: mapPlayerB({ kills_log: [{ time: 500, key: "npc_dota_hero_c" }] }) };
    const none = { b: mapPlayerB({}) };
    expect(killTimeline([a, none, c])).toEqual([
      { time: 100, killerIndex: 0, victimKey: "npc_dota_hero_b" },
      { time: 500, killerIndex: 2, victimKey: "npc_dota_hero_c" },
      { time: 900, killerIndex: 0, victimKey: "npc_dota_hero_a" },
    ]);
    expect(killTimeline([none, none])).toBeNull();
    expect(killTimeline([{ b: mapPlayerB({ kills_log: [] }) }])).toEqual([]);
  });

  it("killsOn: ไม่มี killed = null · มีแต่ไม่เคยฆ่าตัวนั้น = 0 · หา key ฮีโร่ไม่ได้ = null", () => {
    const k = mapPlayerB({ killed: { npc_dota_hero_morphling: 2 } });
    expect(killsOn(k, "npc_dota_hero_morphling")).toBe(2);
    expect(killsOn(k, "npc_dota_hero_lion")).toBe(0);
    expect(killsOn(k, null)).toBeNull();
    expect(killsOn(mapPlayerB({}), "npc_dota_hero_lion")).toBeNull();
  });

  it("recordTotal และ advMinutes", () => {
    expect(recordTotal({ "2": 3, "3": 1 })).toBe(4);
    expect(recordTotal({})).toBe(0);
    expect(recordTotal(null)).toBeNull();
    expect(advMinutes(28)).toEqual([0, 5, 10, 15, 20, 25, 27]);
    expect(advMinutes(26)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(advMinutes(1)).toEqual([0]);
    expect(advMinutes(0)).toEqual([]);
  });
});
