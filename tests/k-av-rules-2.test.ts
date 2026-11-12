// K-AV-RULES.2 — หน้า /dota2/rules ยึดต้นแบบ 1:1: ลำดับหมวด/แท็บ · ข้อมูลกราฟ · Live Simulator · ข้อความตรงตัว · ไม่มี <img>
// ไม่ใช้ env · ไม่ต่อเน็ต · ต้นแบบ: D:\Balehm_Studio\02_Products\AVELAi\01_Spec\REF_ultimate_solo_อัปเดต_2026-11-07.html
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AVE, PENALTY, RADAR, RISK, ROLE_DONUT, SCORE_STACK, SECTIONS } from "@/app/[game]/rules/rules-content";
import { calcView, EXAMPLE_FIELDS } from "@/app/[game]/rules/calc";
import LiveSimulator from "@/app/[game]/rules/LiveSimulator";

const DIR = join(__dirname, "..", "app", "[game]", "rules");
const src = (f: string) => readFileSync(join(DIR, f), "utf8");

describe("K-AV-RULES.2", () => {
  it("a) ลำดับหมวดและป้ายแท็บตรงต้นแบบ :96–101", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(["structure", "matchmaking", "scoring", "finals", "risk", "ai-oracle"]);
    expect(SECTIONS.map((s) => s.tab)).toEqual(["โครงสร้างแข่ง", "การสุ่มทีม", "ระบบคะแนน", "รอบชิง & Tie-breaker", "บทลงโทษ & ระบบ", "✨ AVE Assistant"]);
    // ทุก id มี <section id=…> ในหน้า เรียงตามลำดับ
    const page = src("page.tsx");
    const pos = SECTIONS.map((s) => page.indexOf(`id="${s.id}"`));
    expect(pos.every((p) => p > 0)).toBe(true);
    expect([...pos].sort((x, y) => x - y)).toEqual(pos);
  });

  it("b) ข้อมูลกราฟตรงต้นแบบ", () => {
    expect(RADAR.swiss.data).toEqual([10, 6, 9.5, 7, 9.5]);
    expect(RADAR.queue.data).toEqual([6.5, 9.5, 4, 9, 6]);
    expect(ROLE_DONUT.data).toEqual([20, 20, 20, 20, 20]);
    expect(SCORE_STACK.series.map((s) => s.data)).toEqual([[25, 25, 25, -10], [18.5, 7.2, 7.2, 4.5], [0, 0, 8.5, 0]]);
    expect(PENALTY.data).toEqual([-10, -30, -50, -100]);
    expect(PENALTY.labels).toEqual(["Stream Ghosting 1st", "Disconnect <5m / Leaver (admin-confirmed)", "Griefing / Toxic Behavior", "Match Fixing / Cheating"]);
  });

  it("c) Simulator: ค่าเริ่มต้น 41.20 · 3.825 · Level 15 · breakdown · แพ้ 1.25 · 1.328 · Level 3 · ตำแหน่งไม่กระทบคะแนน", () => {
    const v = calcView(EXAMPLE_FIELDS);
    expect(v.ok && [v.total, v.match, v.levelNum, v.breakdown]).toEqual(["41.20", "3.825", 15, "Outcome (25) + KP (9.9) + Role Bonus (6.3)"]);
    const l = calcView({ ...EXAMPLE_FIELDS, won: false });
    expect(l.ok && [l.total, l.match, l.levelNum]).toEqual(["1.25", "1.328", 3]);
    // หน้าจอจริง (server render ของ client component) แสดงค่าเริ่มต้นเดียวกัน · ตำแหน่งเริ่ม Pos 4/5
    const html = renderToString(createElement(LiveSimulator));
    expect(html).toContain("41.20");
    expect(html).toContain("3.825");
    expect(html).toContain("Outcome (25) + KP (9.9) + Role Bonus (6.3)");
    expect(html).toMatch(/data-role="pos45"/);
    // ค่าตำแหน่งไม่ถูกส่งเข้า calcView (คำนวณจาก f อย่างเดียว) และ CalcFields ไม่มีช่องตำแหน่ง
    const sim = src("LiveSimulator.tsx");
    expect(sim).toContain("calcView(f)");
    expect(sim).not.toMatch(/calcView\([^)]*role/);
    expect(Object.keys(EXAMPLE_FIELDS)).not.toContain("role");
  });

  it("d) ข้อความ Stream Delay :525 · ไม่โหวต :527 · ทักทาย AVE :555–556 ตรงตัว", () => {
    expect(RISK.streamDelay).toBe("⚠️ Stream Delay Policy: ผู้เข้าแข่งขันที่สตรีมมิ่ง จะต้องตั้งค่า Delay รวมไม่น้อยกว่า 5 นาที หากฝ่าฝืนจะถูกหัก -10 คะแนนในครั้งแรก และปรับแพ้ฟาวล์ในครั้งถัดไป");
    expect(RISK.noVote).toBe("🗳️ ไม่โหวตหลังเกม (ออนไลน์อยู่): ไม่ได้ดรอป + ใบเตือน + Karma −5 + ห้ามค้นหาห้องแข่ง 15 นาที (หรือจนกลับไปโหวตย้อนหลัง) · หลุดเกม: ระบบสุ่มโหวตให้ ยังได้ดรอป · ไม่มีโทษอัตโนมัติ · ทิ้งเกม/AFK หรือหลุดใน 5 นาทีแรก → แอดมินตรวจ ถ้ายืนยันเจตนา หัก −30 Pulse");
    expect(AVE.greet1).toBe("สวัสดีค่ะ! 🎯 ฉันคือ AVE (อีฟ) AI ประจำทัวร์นาเมนต์ AVELAi — PRECISION IS FREEDOM —");
    expect(AVE.greet2).toBe("มีข้อสงสัยเกี่ยวกับการคิดคะแนน Killpoint, วิธีการจับคู่ Snake Draft, หรือกฎ Tie-breaker ถามฉันมาได้เลยค่ะ!");
    // กล่องแชทบนหน้าแสดงข้อความเดียวกัน (ตัดแท็ก strong/em ออกแล้วเทียบ)
    const box = src("AveBox.tsx").replace(/<\/?(strong|em)>/g, "").replace(/\s+/g, " ");
    expect(box).toContain(AVE.greet1);
    expect(box).toContain(AVE.greet2);
  });

  // ใบเสริม 2 (18:44): ไม่มี <img · ทุก src ของ <Image> ขึ้นต้น /brand/rules/ และไฟล์มีอยู่จริงใน public/brand/rules/
  it("e) ไม่มี <img · <Image> ทุกตัวชี้ไฟล์จริงใน public/brand/rules/ (กันรูปแตก)", () => {
    const srcs: string[] = [];
    for (const f of readdirSync(DIR).filter((x) => /\.(ts|tsx)$/.test(x))) {
      const s = src(f);
      expect(s, f).not.toMatch(/<img/i);
      for (const m of s.matchAll(/<Image[^>]*\ssrc="([^"]+)"/g)) srcs.push(m[1]);
    }
    expect(srcs.sort()).toEqual(["/brand/rules/avelai-logo-256.png", "/brand/rules/ave-avatar-256.jpg", "/brand/rules/ave-hero-900.jpg"].sort()); // K-AV-RULES.3a: Hero = AVE
    for (const s of srcs) {
      expect(s.startsWith("/brand/rules/")).toBe(true);
      expect(existsSync(join(__dirname, "..", "public", s)), s).toBe(true);
    }
  });

  // K-AV-UX.RULES.1 (มติซอง 028 · 2026-11-10): หลุด = ไม่มีโทษอัตโนมัติ · ทิ้งเกม/AFK/หลุดใน 5 นาทีแรก → แอดมินยืนยันก่อนหัก −30 Pulse
  it("f) ข้อความหลุดเกมตรงมติ 028 · ไม่มีคำว่าไม่โดนลงโทษ/ไม่ถูกหักคะแนน · ตัวเลขโทษไม่เปลี่ยน", () => {
    const prompt = readFileSync(join(__dirname, "..", "lib", "ave", "system-prompt.ts"), "utf8");
    for (const text of [RISK.noVote, src("rules-content.ts"), prompt]) {
      expect(text).not.toContain("ไม่โดนลงโทษ");
      expect(text).not.toContain("ไม่ถูกหักคะแนน");
    }
    expect(RISK.noVote).toContain("ไม่มีโทษอัตโนมัติ");
    expect(prompt).toContain("- หลุดการเชื่อมต่อ: ระบบสุ่มโหวตให้ ยังได้ของรางวัลการันตี · ไม่มีโทษอัตโนมัติ · ทิ้งเกม/AFK หรือหลุดใน 5 นาทีแรก แอดมินตรวจก่อน ถ้ายืนยันว่าตั้งใจ หัก −30 Pulse");
    expect(PENALTY.labels[1]).toBe("Disconnect <5m / Leaver (admin-confirmed)");
    expect(PENALTY.data).toEqual([-10, -30, -50, -100]);
  });
});
