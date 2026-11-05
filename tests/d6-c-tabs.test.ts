import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// K-AV-D6: แท็บชุด C (Objectives · Runes · Vision · Log · Chat) — pure ทั้งหมด ไม่ยิงเครือข่าย
// fixture แต่งเองเลียนโครงฟิลด์ที่ยืนยันจาก OpenDota (objectives · chat · runes_log · obs/sen log · kills_log)

vi.mock("server-only", () => ({}));

import { mapMatchDetail } from "@/lib/dota/match/map";
import {
  buildTimeline, buildingName, gameTime, mapMatchEvents, mapPlayerEventLogs, objectiveKind, objectiveLabel, objectiveSide, runeName, slotSide, teamSide,
} from "@/lib/dota/match/c-events";
import { MATCH_TABS } from "@/app/[game]/stats/matches/[matchId]/tabs";
import ChatList from "@/app/[game]/stats/matches/[matchId]/ChatList";

const OBJ = [
  { time: 46, type: "CHAT_MESSAGE_COURIER_LOST", value: 25, killer: 0, team: 3 },
  { time: 145, type: "CHAT_MESSAGE_FIRSTBLOOD", slot: 8, key: 9, player_slot: 4, victim_player_slot: 132 },
  { time: 546, type: "building_kill", unit: "npc_dota_hero_sniper", key: "npc_dota_goodguys_tower1_mid", slot: 1, player_slot: 128 },
  { time: 1274, type: "CHAT_MESSAGE_ROSHAN_KILL", team: 2 },
  { time: 1275, type: "CHAT_MESSAGE_AEGIS", slot: 3, player_slot: 1 },
  { time: 1500, type: "building_kill", unit: "npc_dota_creep_badguys_melee", key: "npc_dota_goodguys_rax_melee_bot" },
];
const CHAT = [
  { time: -238, type: "chat", key: "gl hf", slot: 9, player_slot: 132 },
  { time: 10, type: "chatwheel", key: "71", slot: 0, player_slot: 0 },
  { time: 20, type: "chat", key: "<script>alert(1)</script><b>bold</b>", player_slot: 1 },
];
const P0 = {
  player_slot: 0, hero_id: 1, personaname: "Alpha",
  runes_log: [{ time: 1002, key: 5 }, { time: 1300, key: "0" }],
  obs_log: [{ time: 451, key: "[134,114]", x: 133.7, y: 113.9, player_slot: 0 }],
  sen_log: [{ time: 50, key: "[163,99]", x: 163, y: 99.1 }],
  obs_left_log: [{ time: 511, key: "[134,114]", attackername: "npc_dota_hero_mars" }],
  sen_left_log: [{ time: 439, key: "[121,128]" }],
  kills_log: [{ time: 889, key: "npc_dota_hero_morphling" }],
};

describe("map เหตุการณ์", () => {
  it("objectives / chat ถูก map ครบ · key เลขกลายเป็น string · รายการไม่มี type ถูกตัด", () => {
    const e = mapMatchEvents({ objectives: [...OBJ, { time: 1 }, "junk"], chat: CHAT });
    expect(e.objectives).toHaveLength(OBJ.length);
    expect(e.objectives![1].key).toBe("9");
    expect(e.objectives![2]).toEqual({ time: 546, type: "building_kill", key: "npc_dota_goodguys_tower1_mid", unit: "npc_dota_hero_sniper", playerSlot: 128, team: null, value: null });
    expect(e.chat).toHaveLength(3);
    expect(e.chat![0]).toEqual({ time: -238, type: "chat", key: "gl hf", playerSlot: 132 });
    expect(e.chat![2].key).toBe("<script>alert(1)</script><b>bold</b>"); // เก็บดิบ · หน้าเว็บ escape
  });
  it("log รายผู้เล่นถูก map · รูน key เลข/สตริง → string", () => {
    const l = mapPlayerEventLogs(P0);
    expect(l.runesLog).toEqual([{ time: 1002, key: "5" }, { time: 1300, key: "0" }]);
    expect(l.obsLog).toEqual([{ time: 451, key: "[134,114]", x: 133.7, y: 113.9 }]);
    expect(l.obsLeftLog).toEqual([{ time: 511, key: "[134,114]", attacker: "npc_dota_hero_mars" }]);
    expect(l.senLeftLog).toEqual([{ time: 439, key: "[121,128]", attacker: null }]);
    expect(l.killsLog).toEqual([{ time: 889, key: "npc_dota_hero_morphling" }]);
  });
  it("ฟิลด์ขาด (ยังไม่วิเคราะห์) = null ทุกตัว ไม่ใช่ [] · ผ่าน mapMatchDetail ด้วย", () => {
    const l = mapPlayerEventLogs({ player_slot: 0, kills: 3 });
    expect(l).toEqual({ runesLog: null, obsLog: null, senLog: null, obsLeftLog: null, senLeftLog: null, killsLog: null });
    const m = mapMatchDetail("1", { players: [{ player_slot: 0 }], od_data: { has_parsed: false } });
    expect(m.objectives).toBeNull();
    expect(m.chat).toBeNull();
    expect(m.players[0].runesLog).toBeNull();
    expect(buildTimeline({ objectives: m.objectives, chat: m.chat }, m.players.map((p) => ({ slot: p.slot, logs: p })), (x) => x ?? "–")).toBeNull();
  });
  it("JSON เพี้ยน: ไม่ระเบิด · ค่าที่ไม่ใช่ array = null · รายการเพี้ยนในอาร์เรย์ได้ null/ข้าม", () => {
    expect(mapMatchEvents({ objectives: "x", chat: 5 })).toEqual({ objectives: null, chat: null });
    expect(mapMatchEvents({ objectives: [null, 1, {}], chat: [{ type: "chat" }] })).toEqual({ objectives: [], chat: [{ time: null, type: "chat", key: null, playerSlot: null }] });
    const l = mapPlayerEventLogs({ runes_log: { a: 1 }, obs_log: [null, { time: "x", key: 3 }], kills_log: "nope" });
    expect(l.runesLog).toBeNull();
    expect(l.obsLog).toEqual([{ time: null, key: null, x: null, y: null }, { time: null, key: "3", x: null, y: null }]);
    expect(l.killsLog).toBeNull();
    expect(() => mapMatchDetail("1", { players: [null, "x"], objectives: [[]], chat: [[]] })).not.toThrow();
  });
});

describe("ป้ายแสดงผล", () => {
  it("gameTime: m:ss · ติดลบก่อนฮอร์น · null = –", () => {
    expect(gameTime(0)).toBe("0:00");
    expect(gameTime(1274)).toBe("21:14");
    expect(gameTime(-238)).toBe("-3:58");
    expect(gameTime(null)).toBe("–");
  });
  it("runeName ตามรหัส OpenDota · ไม่รู้จัก = รูน #n", () => {
    expect(runeName("5")).toBe("Bounty");
    expect(runeName("0")).toBe("Double Damage");
    expect(runeName("42")).toBe("รูน #42");
    expect(runeName(null)).toBe("–");
  });
  it("buildingName: ป้อม/บาร์แร็ค/ป้อมหลัก · ชื่ออื่นแสดงดิบ", () => {
    expect(buildingName("npc_dota_goodguys_tower1_mid")).toBe("ป้อม Radiant T1 กลาง");
    expect(buildingName("npc_dota_badguys_tower4")).toBe("ป้อม Dire T4");
    expect(buildingName("npc_dota_goodguys_rax_melee_bot")).toBe("บาร์แร็ค Radiant ระยะประชิด ล่าง");
    expect(buildingName("npc_dota_badguys_melee_rax_top")).toBe("บาร์แร็ค Dire ระยะประชิด บน"); // รูปแบบจริงจาก OpenDota
    expect(buildingName("npc_dota_badguys_range_rax_mid")).toBe("บาร์แร็ค Dire ระยะไกล กลาง");
    // objectiveSide: ป้อมถูกทำลาย = ฝั่งตรงข้ามเจ้าของ แม้ครีปเป็นคนทำลาย · อื่น ๆ ใช้ slot/team
    const e = mapMatchEvents({ objectives: OBJ }).objectives!;
    expect(objectiveSide(e[2])).toBe("Dire"); // goodguys tower ถูกทำลาย → Dire ได้
    expect(objectiveSide(e[5])).toBe("Dire"); // ครีป Dire ทำลาย rax ของ Radiant
    expect(objectiveSide(e[0])).toBe("Dire"); // team 3
    expect(objectiveSide(e[1])).toBe("Radiant"); // player_slot 4
    expect(objectiveSide({ time: 1, type: "CHAT_MESSAGE_X", key: null, unit: null, playerSlot: null, team: null, value: null })).toBeNull();
    expect(buildingName("npc_dota_badguys_fort")).toBe("ป้อมหลัก Dire");
    expect(buildingName("npc_dota_something_else")).toBe("something else");
    expect(buildingName(null)).toBe("–");
  });
  it("objectiveLabel / objectiveKind / teamSide / slotSide", () => {
    const e = mapMatchEvents({ objectives: OBJ }).objectives!;
    expect(objectiveLabel(e[0])).toBe("คูเรียร์ของ Dire ถูกฆ่า");
    expect(objectiveLabel(e[1])).toBe("First Blood");
    expect(objectiveLabel(e[2])).toBe("ทำลาย ป้อม Radiant T1 กลาง");
    expect(objectiveLabel(e[3])).toBe("Radiant ฆ่า Roshan");
    expect(objectiveLabel(e[4])).toBe("รับ Aegis");
    expect(objectiveLabel({ time: 1, type: "CHAT_MESSAGE_SOMETHING_NEW", key: null, unit: null, playerSlot: null, team: null, value: null })).toBe("something new");
    expect(e.map(objectiveKind)).toEqual(["other", "other", "tower", "roshan", "other", "barracks"]);
    expect(teamSide(2)).toBe("Radiant");
    expect(teamSide(3)).toBe("Dire");
    expect(teamSide(null)).toBeNull();
    expect(slotSide(128)).toBe("Dire");
    expect(slotSide(4)).toBe("Radiant");
    expect(slotSide(null)).toBeNull();
  });
});

describe("ไทม์ไลน์รวม (Log)", () => {
  it("รวมทุกแหล่ง เรียงตามเวลา · เวลา null ไปท้าย · ใช้ชื่อฮีโร่จาก lookup", () => {
    const events = mapMatchEvents({ objectives: OBJ.slice(0, 3), chat: CHAT });
    const logs = mapPlayerEventLogs({ ...P0, kills_log: [{ time: 889, key: "npc_dota_hero_morphling" }, { key: "npc_dota_hero_axe" }] });
    const t = buildTimeline(events, [{ slot: 0, logs }], (npc) => (npc === "npc_dota_hero_morphling" ? "Morphling" : npc === "npc_dota_hero_mars" ? "Mars" : "?"))!;
    expect(t.map((e) => e.time)).toEqual([46, 50, 145, 439, 451, 511, 546, 889, 1002, 1300, null]);
    expect(t.find((e) => e.kind === "kill" && e.time === 889)!.detail).toBe("ฆ่า Morphling");
    expect(t.find((e) => e.time === 511)!.detail).toBe("Observer [134,114] หายไป (โดย Mars)");
    expect(t.find((e) => e.time === 439)!.detail).toBe("Sentry [121,128] หายไป");
    expect(t.find((e) => e.time === 1002)!.detail).toBe("เก็บรูน Bounty");
    expect(t.every((e) => e.kind !== ("chat" as never))).toBe(true); // แชตไม่อยู่ใน Log
  });
});

describe("แชต", () => {
  it("ข้อความที่มีแท็ก HTML ถูก escape ทั้งหมด · chatwheel แสดงรหัส", () => {
    const lines = mapMatchEvents({ chat: CHAT }).chat!;
    const html = renderToStaticMarkup(createElement(ChatList, { lines, bySlot: (s) => `P${s}` }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("gl hf");
    expect(html).toContain("ชาตวีล #71");
    expect(html).toContain("-3:58");
  });
  it("ไม่มีรายการ = ข้อความไทย · ไม่มี dangerouslySetInnerHTML ในไฟล์ชุด C", () => {
    expect(renderToStaticMarkup(createElement(ChatList, { lines: [], bySlot: () => "" }))).toContain("ไม่มีข้อความแชต");
    const base = join(process.cwd(), "app", "[game]", "stats", "matches", "[matchId]");
    const files = [
      join(base, "ChatList.tsx"), join(base, "c-shared.tsx"),
      ...["objectives", "runes", "vision", "log", "chat"].map((s) => join(base, s, "page.tsx")),
      join(process.cwd(), "lib", "dota", "match", "c-events.ts"),
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/dangerouslySetInnerHTML\s*=/);
      expect(src, f).not.toMatch(/Total Score|MVP|Form Index|dotabuff|FALLBACK/i);
      expect(src, f).not.toMatch(/\bKP\b/);
    }
  });
});

describe("แท็บ", () => {
  it("tabs.ts: Overview + Combat (D4) + ชุด B (D5) + ชุด C เปิดครบ · ไม่เหลือแท็บปิด (K-AV-D6.2: ฐานใหม่มี D5)", () => {
    const ready = MATCH_TABS.filter((t) => t.ready).map((t) => t.slug);
    expect(ready).toEqual(["", "builds", "lanes", "combat", "kills", "farm", "objectives", "runes", "vision", "log", "chat"]);
    expect(MATCH_TABS.filter((t) => !t.ready).map((t) => t.slug)).toEqual([]);
  });
  it("ไฟล์ใหม่ชุด C ขึ้นต้น c- หรืออยู่ในเส้นทางแท็บของตัวเอง · ไม่แตะแท็บของ D4/D5 (Combat เป็นหน้าจริงของ D4 · ชุด B เป็นหน้าจริงของ D5)", () => {
    const names = readdirSync(join(process.cwd(), "lib", "dota", "match")).filter((f) => f.startsWith("c-"));
    expect(names).toEqual(["c-events.ts"]);
    const base = join(process.cwd(), "app", "[game]", "stats", "matches", "[matchId]");
    expect(readFileSync(join(base, "combat", "page.tsx"), "utf8")).toContain("K-AV-D4");
    for (const s of ["builds", "lanes", "kills", "farm"]) {
      expect(readFileSync(join(base, s, "page.tsx"), "utf8")).toContain("K-AV-D5");
    }
  });
});
