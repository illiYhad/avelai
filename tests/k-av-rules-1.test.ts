// K-AV-RULES.1 — หน้ากติกา Ultimate Solo: ตัวคำนวณใช้สูตรจริง · ข้อความสูตรจาก config · Snake Draft · ไม่มีคำ/สีต้องห้าม
// ไม่ใช้ env · ไม่ต่อเน็ต
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeMatchScore, formLevel, SCORE_CONFIG } from "@/lib/avelai/score";
import { calcView, EXAMPLE_FIELDS, parseFields, type CalcFields } from "@/app/[game]/rules/calc";
import { scoreRulesText } from "@/app/[game]/rules/rules-content";
import { snakeOrder } from "@/app/[game]/rules/snake";
import { needsLogin } from "@/lib/auth/protected-paths";
import { routes } from "@/lib/routes";

const base: CalcFields = { won: true, kills: "0", deaths: "0", assists: "0", towers: "0", wards: "0", heal: "0", stuns: "0", dmgTaken: "0" };

function same(f: CalcFields) {
  const v = calcView(f);
  expect(v.ok).toBe(true);
  if (!v.ok) return v;
  const r = computeMatchScore(parseFields(f)!);
  expect(Number(v.total)).toBeCloseTo(r.totalScore!, 2);
  expect(Math.abs(Number(v.match) - r.matchScore!)).toBeLessThanOrEqual(0.0005 + 1e-9); // แสดง 3 ตำแหน่ง (ปัดครึ่งขึ้น)
  expect(Number(v.baseKp)).toBeCloseTo(r.baseKp.value!, 2);
  expect(v.floored).toBe(r.baseKp.floored);
  expect(Number(v.kpAfter)).toBeCloseTo(r.kpAfterMultiplier!, 2);
  expect(Number(v.role.total)).toBeCloseTo(r.roleBonus.value!, 2);
  const lv = formLevel(r.matchScore);
  expect(v.level).toBe(`Level ${lv!.level} (${lv!.tier})`);
  return v;
}

describe("K-AV-RULES.1 · ตัวคำนวณ = computeMatchScore() จริง", () => {
  it("a) ชนะ · KP บวก (ตัวอย่างใบแม่) → Total 41.20 · Match 3.825 · Level 15", () => {
    const v = same(EXAMPLE_FIELDS);
    expect(v.ok && [v.total, v.match, v.level, v.multiplier]).toEqual(["41.20", "3.825", "Level 15 (S)", "×1.0"]);
  });
  it("b) แพ้ · KP บวก → ตัวคูณ ×0.5", () => {
    const v = same({ ...EXAMPLE_FIELDS, won: false });
    expect(v.ok && v.multiplier).toBe("×0.5");
  });
  it("c) ชนะ · KP ลบ (ไม่ถึงพื้น)", () => {
    const v = same({ ...base, won: true, kills: "1", deaths: "8" });
    expect(v.ok && [v.baseKp, v.floored]).toEqual(["-3.00", false]);
  });
  it("d) แพ้ · KP ลบ → ตัวคูณ ×1.0", () => {
    const v = same({ ...base, won: false, kills: "1", deaths: "8" });
    expect(v.ok && v.multiplier).toBe("×1.0");
  });
  it("e) ชนะ · KP ต่ำกว่า −10 → ชนพื้น", () => {
    const v = same({ ...base, won: true, deaths: "30" });
    expect(v.ok && [v.baseKp, v.floored]).toEqual([SCORE_CONFIG.kp.floor.toFixed(2), true]);
  });
  it("f) แพ้ · KP ต่ำกว่า −10 → ชนพื้น · Match Score ไม่ต่ำกว่า 0", () => {
    const v = same({ ...base, won: false, deaths: "40" });
    expect(v.ok && v.floored).toBe(true);
    expect(v.ok && Number(v.match)).toBeGreaterThanOrEqual(0);
  });
  it("ช่องว่างหรือไม่ใช่ตัวเลข → 'กรอกให้ครบ' ไม่ใช่ 0", () => {
    expect(calcView({ ...EXAMPLE_FIELDS, kills: "" })).toEqual({ ok: false, message: "กรอกให้ครบ" });
    expect(calcView({ ...EXAMPLE_FIELDS, heal: "abc" })).toEqual({ ok: false, message: "กรอกให้ครบ" });
  });
});

describe("K-AV-RULES.1 · ข้อความ · Snake · ไฟล์ · เส้นทาง", () => {
  it("g) scoreRulesText ใช้ค่าจาก config จริง (outcomeWin 30 → ข้อความเป็น +30)", () => {
    const text = (c: typeof SCORE_CONFIG) => scoreRulesText(c).flatMap((b) => b.lines).join("\n");
    expect(text(SCORE_CONFIG)).toContain(`ชนะ +${SCORE_CONFIG.outcomeWin}`);
    const t30 = text({ ...SCORE_CONFIG, outcomeWin: 30 } as unknown as typeof SCORE_CONFIG);
    expect(t30).toContain("ชนะ +30");
    expect(t30).not.toContain(`ชนะ +${SCORE_CONFIG.outcomeWin} `);
  });
  it("h) snakeOrder(10) = [1,4,5,8,9] / [2,3,6,7,10]", () => {
    expect(snakeOrder(10)).toEqual([[1, 4, 5, 8, 9], [2, 3, 6, 7, 10]]);
  });
  // K-AV-RULES.2 แก้เฉพาะข้อนี้: สี hex มีได้เฉพาะ ref-theme.ts · ELO/MMR มีได้เฉพาะประโยคต้นแบบ :252 · ห้าม fetch( · ห้าม 10px/11px
  it("i) ไฟล์ใต้ app/[game]/rules ไม่มีคำต้องห้าม · hex เฉพาะ ref-theme.ts · ELO/MMR เฉพาะประโยค RANK_01", () => {
    const dir = join(__dirname, "..", "app", "[game]", "rules");
    const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(5);
    const ALLOWED = "ไม่ใช้ MMR/ELO ตาม RANK_01";
    for (const f of files) {
      const s = readFileSync(join(dir, f), "utf8");
      for (const bad of [/gemini/i, /generativelanguage/i, /cdn\./i, /chart\.js/i, /fetch\(/, /text-\[10px\]/, /text-\[11px\]/]) {
        expect(bad.test(s), `${f} มี ${bad}`).toBe(false);
      }
      if (f !== "ref-theme.ts") expect(/#[0-9a-f]{6}\b/i.test(s), `${f} มีสี hex`).toBe(false);
      const rest = s.split(ALLOWED).join("");
      expect(/\bELO\b|\bMMR\b/i.test(rest), `${f} มี ELO/MMR นอกประโยคต้นแบบ`).toBe(false);
    }
  });
  it("j) /dota2/rules ไม่ต้องล็อกอิน · routes.rules", () => {
    expect(needsLogin("/dota2/rules")).toBe(false);
    expect(routes.rules("dota2")).toBe("/dota2/rules");
  });
});
