import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

// K-AV-D4: แยก damage_taken · เลน/บทบาท · แท็บ Combat — pure ทั้งหมด ไม่ยิงเครือข่าย
// fixture แต่งเองเลียนโครงฟิลด์ OpenDota (ไม่ใช่ข้อมูลจริงของแมตช์ใด)

import { mapMatchDetail } from "@/lib/dota/match/map";
import {
  classifyDamageSource, laneLabel, laneName, laneRoleName, seconds, sortedDamageEntries, sourceLabel, splitDamageTaken,
} from "@/lib/dota/match/a-combat";
import { MATCH_TABS } from "@/app/[game]/stats/matches/[matchId]/tabs";

const TAKEN = {
  npc_dota_hero_sniper: 10000,
  npc_dota_hero_phantom_lancer: 5000,
  npc_dota_badguys_tower1_mid: 3000,
  npc_dota_goodguys_tower2_top: 938,
  npc_dota_creep_badguys_melee: 2500,
  npc_dota_neutral_kobold: 700,
  npc_dota_lone_druid_bear: 1200, // ซัมมอน
  npc_dota_badguys_fort: 300, // ป้อมหลัก (ไม่มี _tower) → อื่น ๆ
  something_unknown_42: 57, // ชื่อที่ไม่รู้จัก ต้องไม่ถูกทิ้ง
};

const raw = (players: Record<string, unknown>[], parsed = true) => ({
  match_id: 1,
  radiant_win: true,
  players,
  od_data: { has_parsed: parsed },
});

describe("แยก damage_taken", () => {
  it("ฮีโร่ · ป้อม · ซัมมอน/ครีป/ไม่รู้จัก → อื่น ๆ · ผลรวม 3 ก้อนเท่ายอดรวม", () => {
    const s = splitDamageTaken(TAKEN)!;
    expect(s.heroes).toBe(15000);
    expect(s.towers).toBe(3938);
    expect(s.other).toBe(2500 + 700 + 1200 + 300 + 57);
    expect(s.total).toBe(Object.values(TAKEN).reduce((a, b) => a + b, 0));
    expect(s.heroes + s.towers + s.other).toBe(s.total);
  });
  it("classify: hero prefix · _tower ทุกตำแหน่ง · อื่น ๆ", () => {
    expect(classifyDamageSource("npc_dota_hero_axe")).toBe("heroes");
    expect(classifyDamageSource("npc_dota_goodguys_tower4")).toBe("towers");
    expect(classifyDamageSource("npc_dota_badguys_tower3_bot")).toBe("towers");
    expect(classifyDamageSource("npc_dota_creep_goodguys_ranged")).toBe("other");
    expect(classifyDamageSource("npc_dota_warlock_golem_1")).toBe("other");
    expect(classifyDamageSource("")).toBe("other");
  });
  it("ยังไม่วิเคราะห์ (null/undefined) → null ไม่ใช่ 0 · object ว่าง → ทุกก้อน 0 และ total 0", () => {
    expect(splitDamageTaken(null)).toBeNull();
    expect(splitDamageTaken(undefined)).toBeNull();
    expect(splitDamageTaken({})).toEqual({ heroes: 0, towers: 0, other: 0, total: 0 });
  });
  it("ค่าที่ไม่ใช่ตัวเลขถูกข้าม ไม่ทำให้ผลรวมเพี้ยน", () => {
    const s = splitDamageTaken({ npc_dota_hero_axe: 100, bad: Number.NaN, worse: Infinity } as Record<string, number>)!;
    expect(s).toEqual({ heroes: 100, towers: 0, other: 0, total: 100 });
  });
  it("sortedDamageEntries เรียงมาก→น้อย · null = []", () => {
    expect(sortedDamageEntries(null)).toEqual([]);
    expect(sortedDamageEntries({ a: 1, b: 3, c: 2 }).map((e) => e.key)).toEqual(["b", "c", "a"]);
  });
});

describe("map ฟิลด์วิเคราะห์ของผู้เล่น", () => {
  it("แมตช์ที่วิเคราะห์แล้ว: damageTaken · damageTargets · lane · stuns · วอร์ด ถูก map", () => {
    const m = mapMatchDetail("1", raw([{
      player_slot: 1, hero_id: 38, lane: 3, lane_role: 3, stuns: 12.34, obs_placed: 4, sen_placed: 6,
      damage_taken: TAKEN,
      damage_targets: { sniper_assassinate: { npc_dota_hero_axe: 800, npc_dota_hero_lina: 650 }, junk: "x" },
    }]));
    const p = m.players[0];
    expect(p.lane).toBe(3);
    expect(p.laneRole).toBe(3);
    expect(p.stuns).toBe(12.34);
    expect(p.obsPlaced).toBe(4);
    expect(p.senPlaced).toBe(6);
    expect(p.damageTaken).toEqual(TAKEN);
    expect(p.damageTargets).toEqual({ sniper_assassinate: { npc_dota_hero_axe: 800, npc_dota_hero_lina: 650 } });
    const s = splitDamageTaken(p.damageTaken)!;
    expect(s.total).toBe(23695);
    expect(s.towers).toBe(3938);
  });
  it("แมตช์ยังไม่วิเคราะห์: ทุกฟิลด์วิเคราะห์เป็น null ไม่ใช่ 0 · splitDamageTaken = null", () => {
    const m = mapMatchDetail("1", raw([{ player_slot: 0, hero_id: 1, kills: 3, hero_damage: 9000 }], false));
    const p = m.players[0];
    expect(m.isParsed).toBe(false);
    expect(p.heroDamage).toBe(9000);
    expect(p.lane).toBeNull();
    expect(p.laneRole).toBeNull();
    expect(p.stuns).toBeNull();
    expect(p.obsPlaced).toBeNull();
    expect(p.senPlaced).toBeNull();
    expect(p.damageTaken).toBeNull();
    expect(p.damageTargets).toBeNull();
    expect(splitDamageTaken(p.damageTaken)).toBeNull();
    expect(laneLabel(p.lane, p.laneRole)).toBe("–");
  });
  it("JSON เพี้ยน: damage_taken เป็น string/array/ค่าปน → ไม่ระเบิด และไม่แต่งตัวเลข", () => {
    const m = mapMatchDetail("1", raw([
      { player_slot: 0, damage_taken: "nope", damage_targets: [] },
      { player_slot: 1, damage_taken: ["a"], damage_targets: "x" },
      { player_slot: 2, damage_taken: { npc_dota_hero_axe: "100", npc_dota_hero_lina: 50, t: null }, damage_targets: { q: { a: 1, b: "2" }, z: 5 } },
      { player_slot: 3, lane: "top", lane_role: {}, stuns: "5", obs_placed: null },
    ]));
    expect(m.players[0].damageTaken).toBeNull();
    expect(m.players[0].damageTargets).toBeNull();
    expect(m.players[1].damageTaken).toBeNull();
    expect(m.players[1].damageTargets).toBeNull();
    expect(m.players[2].damageTaken).toEqual({ npc_dota_hero_lina: 50 });
    expect(m.players[2].damageTargets).toEqual({ q: { a: 1 } });
    expect(m.players[3].lane).toBeNull();
    expect(m.players[3].laneRole).toBeNull();
    expect(m.players[3].stuns).toBeNull();
    expect(m.players[3].obsPlaced).toBeNull();
    expect(() => mapMatchDetail("1", { players: [null, 1, "x", []] })).not.toThrow();
  });
});

describe("ป้ายแสดงผล", () => {
  it("เลน/บทบาทตาม OpenDota · ค่าที่ไม่รู้จัก = #n · ไม่มี = –", () => {
    expect(laneName(1)).toBe("ล่าง");
    expect(laneName(2)).toBe("กลาง");
    expect(laneName(3)).toBe("บน");
    expect(laneName(9)).toBeNull();
    expect(laneRoleName(1)).toBe("Safe");
    expect(laneRoleName(4)).toBe("Jungle");
    expect(laneLabel(3, 3)).toBe("บน / Off");
    expect(laneLabel(2, null)).toBe("กลาง");
    expect(laneLabel(null, 1)).toBe("Safe");
    expect(laneLabel(7, 9)).toBe("#7 / #9");
    expect(laneLabel(null, null)).toBe("–");
  });
  it("sourceLabel: ฮีโร่ใช้ชื่อจาก constants · ป้อม/ครีปแปลงจากชื่อ ไม่แต่ง", () => {
    const names = new Map([["npc_dota_hero_sniper", "Sniper"]]);
    expect(sourceLabel("npc_dota_hero_sniper", names)).toBe("Sniper");
    expect(sourceLabel("npc_dota_hero_sniper")).toBe("sniper");
    expect(sourceLabel("npc_dota_badguys_tower1_mid")).toBe("Dire tower1 mid");
    expect(sourceLabel("npc_dota_goodguys_tower2_top")).toBe("Radiant tower2 top");
    expect(sourceLabel("npc_dota_neutral_kobold")).toBe("neutral kobold");
    expect(sourceLabel("null")).toBe("ไม่ระบุสกิล");
  });
  it("seconds: ทศนิยม 1 ตำแหน่ง · null = –", () => {
    expect(seconds(null)).toBe("–");
    expect(seconds(12.34)).toBe("12.3");
    expect(seconds(0)).toBe("0.0");
  });
});

describe("แท็บ Combat", () => {
  it("tabs.ts: Overview กับ Combat เปิด · ชุด C เปิดโดย D6 · ที่เหลือยังปิด (K-AV-D6.1: D6 ต่อจาก D4)", () => {
    const ready = MATCH_TABS.filter((t) => t.ready).map((t) => t.slug);
    expect(ready).toEqual(["", "combat", "objectives", "runes", "vision", "log", "chat"]);
  });
  it("หน้า Combat/Overview ไม่มี KP · Total Score · MVP · Form Index · ไม่มีข้อมูลจำลอง · ไม่ดึง Dotabuff", () => {
    const base = join(process.cwd(), "app", "[game]", "stats", "matches", "[matchId]");
    for (const f of [join(base, "combat", "page.tsx"), join(base, "page.tsx"), join(process.cwd(), "lib", "dota", "match", "a-combat.ts")]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/Total Score|MVP|Form Index|dotabuff|FALLBACK|sample/i);
    }
    // KP: หน้า Overview ของ D3 มีคอมเมนต์ "ไม่มีคะแนน KP" อยู่แล้ว (เทส D3 คุม) — ไฟล์ D4 ห้ามมีคำนี้เลย
    for (const f of [join(base, "combat", "page.tsx"), join(process.cwd(), "lib", "dota", "match", "a-combat.ts")]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/\bKP\b/);
    }
  });
});
