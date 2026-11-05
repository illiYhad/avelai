import { describe, expect, it } from "vitest";
import {
  computeBaseKp, computeFormIndex, computeMatchScore, computeRoleBonus, formLevel, SCORE_CONFIG, toMatchScore,
  type PlayerMatchInput,
} from "@/lib/avelai/score";

// K-AV-S1: เทสโมดูลคำนวณคะแนน — ตัวเลขคาดหวังทุกตัวคิดมือไว้ในคอมเมนต์เหนือแต่ละกรณี
// ตัวอย่าง A/B/C มาจาก avelai_kp_formula.md · B ใช้กติกา R6 (RANK_01) จึงได้ −8.025 ไม่ใช่ −6.925 ของเอกสารเดิม

const zeroRole = { obsPlaced: 0, senPlaced: 0, heroHealing: 0, stuns: 0, damageTaken: 0 };
const mk = (o: Partial<PlayerMatchInput>): PlayerMatchInput => ({
  won: true, kills: 0, deaths: 0, assists: 0, towers: 0, ...zeroRole, ...o,
});

describe("Total Score และ Match Score · กรณีคิดมือ", () => {
  it("1) แพ้ · Base KP บวก ถูกคูณ 0.5 (ตัวอย่าง A: Leshrac 11/10/7)", () => {
    // Base KP = 11 − 10×0.5 + 7×0.3 + 0 = 11 − 5 + 2.1 = 8.1 → แพ้และเป็นบวก ×0.5 = 4.05
    // Role Bonus = 18000/15000 = 1.2
    // Total = −10 + 4.05 + 1.2 = −4.75 · Match Score = (−4.75 + 20) / 16 = 15.25 / 16 = 0.953125
    const r = computeMatchScore(mk({ won: false, kills: 11, deaths: 10, assists: 7, damageTaken: 18000 }));
    expect(r.baseKp.value).toBeCloseTo(8.1, 10);
    expect(r.multiplier).toBe(0.5);
    expect(r.kpAfterMultiplier).toBeCloseTo(4.05, 10);
    expect(r.roleBonus.value).toBeCloseTo(1.2, 10);
    expect(r.totalScore).toBeCloseTo(-4.75, 10);
    expect(r.matchScore).toBeCloseTo(0.953125, 10);
    expect(r.missing).toEqual([]);
  });

  it("2) แพ้ · Base KP ลบ ไม่ถูกคูณ (ตัวอย่าง B: Sand King 2/9/1 ตาม R6)", () => {
    // Base KP = 2 − 9×0.5 + 1×0.3 = 2 − 4.5 + 0.3 = −2.2 → แพ้แต่ติดลบ ตัวคูณ 1.0 = −2.2
    // Role Bonus = wards (4+2)/2 = 3.0 · heal 90/3000×0.5 = 0.015 · stuns 34.8/15×0.5 = 1.16 · dmg 0 → 4.175
    // Total = −10 − 2.2 + 4.175 = −8.025 · Match Score = 11.975 / 16 = 0.7484375
    const r = computeMatchScore(mk({ won: false, kills: 2, deaths: 9, assists: 1, obsPlaced: 4, senPlaced: 2, heroHealing: 90, stuns: 34.8 }));
    expect(r.baseKp.value).toBeCloseTo(-2.2, 10);
    expect(r.multiplier).toBe(1);
    expect(r.roleBonus.parts.wards).toBeCloseTo(3.0, 10);
    expect(r.roleBonus.parts.heal).toBeCloseTo(0.015, 10);
    expect(r.roleBonus.parts.stuns).toBeCloseTo(1.16, 10);
    expect(r.roleBonus.parts.dmgTaken).toBe(0);
    expect(r.roleBonus.value).toBeCloseTo(4.175, 10);
    expect(r.totalScore).toBeCloseTo(-8.025, 10);
    expect(r.matchScore).toBeCloseTo(0.7484375, 10);
  });

  it("3) ชนะ · มีป้อม (ตัวอย่าง C: Viper 5/3/0 Tower 1)", () => {
    // Base KP = 5 − 1.5 + 0 + 1×2.0 = 5.5 → ชนะ ตัวคูณ 1.0
    // Role Bonus = 12000/15000 = 0.8 · Total = 25 + 5.5 + 0.8 = 31.3 · Match Score = 51.3 / 16 = 3.20625
    const r = computeMatchScore(mk({ won: true, kills: 5, deaths: 3, assists: 0, towers: 1, damageTaken: 12000 }));
    expect(r.outcome).toBe(25);
    expect(r.baseKp.value).toBeCloseTo(5.5, 10);
    expect(r.multiplier).toBe(1);
    expect(r.totalScore).toBeCloseTo(31.3, 10);
    expect(r.matchScore).toBeCloseTo(3.20625, 10);
  });

  it("4) Base KP ติดลบเกินขั้นต่ำ ถูกตรึงที่ −10 (ชนะ 0/30/0)", () => {
    // raw = 0 − 30×0.5 = −15 → ขั้นต่ำ −10 · ชนะ: Total = 25 − 10 + 0 = 15 · Match Score = 35 / 16 = 2.1875
    const r = computeMatchScore(mk({ won: true, deaths: 30 }));
    expect(r.baseKp.raw).toBe(-15);
    expect(r.baseKp.value).toBe(-10);
    expect(r.baseKp.floored).toBe(true);
    expect(r.totalScore).toBe(15);
    expect(r.matchScore).toBe(2.1875);
  });

  it("5) พื้น 0.00: แพ้และ Base KP ที่ขั้นต่ำ (แพ้ 0/30/0)", () => {
    // Base KP = −10 (ตรึง) · แพ้และติดลบ ตัวคูณ 1.0 · Total = −10 − 10 + 0 = −20 · Match Score = 0 / 16 = 0
    const r = computeMatchScore(mk({ won: false, deaths: 30 }));
    expect(r.totalScore).toBe(-20);
    expect(r.matchScore).toBe(0);
    // ต่ำกว่า −20 (เกิดได้เมื่อค่าคงที่ถูกปรับ) ต้องถูกตรึงที่ 0: (−30 + 20) / 16 = −0.625 → 0
    expect(toMatchScore(-30)).toBe(0);
  });

  it("6) เพดาน 5.00: ชนะ 30/0/20 ป้อม 3", () => {
    // Base KP = 30 + 20×0.3 + 3×2 = 30 + 6 + 6 = 42 · Total = 25 + 42 = 67 · (67 + 20) / 16 = 5.4375 → 5
    const r = computeMatchScore(mk({ won: true, kills: 30, assists: 20, towers: 3 }));
    expect(r.totalScore).toBeCloseTo(67, 10);
    expect(r.matchScoreUnclamped).toBeCloseTo(5.4375, 10);
    expect(r.matchScore).toBe(5);
  });

  it("7) แพ้ · Base KP เท่ากับ 0 พอดี ไม่เข้าเงื่อนไขคูณ (แพ้ 1/2/0)", () => {
    // Base KP = 1 − 2×0.5 = 0 → ไม่เป็นบวก ตัวคูณ 1.0 · Total = −10 + 0 + 0 = −10 · Match Score = 10 / 16 = 0.625
    const r = computeMatchScore(mk({ won: false, kills: 1, deaths: 2 }));
    expect(r.baseKp.value).toBe(0);
    expect(r.multiplier).toBe(1);
    expect(r.totalScore).toBe(-10);
    expect(r.matchScore).toBe(0.625);
  });
});

describe("ฟิลด์ null · ห้ามถือเป็น 0", () => {
  it("8) แมตช์ยังไม่วิเคราะห์ (ไม่มีวอร์ด · เวลาควบคุม · ดาเมจที่รับ): Total และ Match Score เป็น null พร้อมชื่อฟิลด์", () => {
    const r = computeMatchScore(mk({ won: true, kills: 5, deaths: 3, heroHealing: 600, obsPlaced: null, senPlaced: null, stuns: null, damageTaken: null }));
    expect(r.totalScore).toBeNull();
    expect(r.matchScore).toBeNull();
    expect(r.matchScoreUnclamped).toBeNull();
    expect(r.missing).toEqual(["obsPlaced", "senPlaced", "stuns", "damageTaken"]);
    // ส่วนที่คิดได้ยังอยู่ให้ตรวจย้อน: Base KP = 5 − 1.5 = 3.5 · heal 600/3000×0.5 = 0.1
    expect(r.baseKp.value).toBe(3.5);
    expect(r.outcome).toBe(25);
    expect(r.roleBonus.value).toBeNull();
    expect(r.roleBonus.parts).toEqual({ wards: null, heal: 0.1, stuns: null, dmgTaken: null });
  });

  it("9) ไม่รู้ผลแพ้ชนะ: outcome และตัวคูณเป็น null · K/D/A ขาด: Base KP เป็น null", () => {
    const a = computeMatchScore(mk({ won: null, kills: 4 }));
    expect([a.outcome, a.multiplier, a.kpAfterMultiplier, a.totalScore]).toEqual([null, null, null, null]);
    expect(a.missing).toEqual(["won"]);
    expect(a.baseKp.value).toBe(4);

    const b = computeBaseKp(mk({ kills: null, towers: null }));
    expect(b).toEqual({ value: null, raw: null, floored: false, missing: ["kills", "towers"] });
    expect(computeMatchScore(mk({ kills: null })).totalScore).toBeNull();
  });

  it("10) ค่าที่ไม่ใช่ตัวเลขจริง (NaN · Infinity) นับเป็นขาด · วอร์ดขาดฝั่งเดียวก็คิดส่วนวอร์ดไม่ได้", () => {
    expect(computeBaseKp(mk({ deaths: NaN })).missing).toEqual(["deaths"]);
    expect(computeRoleBonus(mk({ damageTaken: Infinity })).missing).toEqual(["damageTaken"]);
    const r = computeRoleBonus(mk({ obsPlaced: 4, senPlaced: null }));
    expect(r.parts.wards).toBeNull();
    expect(r.value).toBeNull();
    expect(r.missing).toEqual(["senPlaced"]);
    expect(toMatchScore(null)).toBeNull();
  });
});

describe("Form Index", () => {
  it("11) ครบ 5 นัด: ถ่วงน้ำหนัก 1.5 / 1.3 / 1.1 / 1.0 / 0.9", () => {
    // [5, 4, 3, 2, 1] → 5×1.5 + 4×1.3 + 3×1.1 + 2×1.0 + 1×0.9 = 7.5 + 5.2 + 3.3 + 2 + 0.9 = 18.9
    // 18.9 / 5.8 = 3.2586… → ปัด 2 ตำแหน่ง = 3.26 → Level 13 (3.25–3.44)
    const r = computeFormIndex([5, 4, 3, 2, 1], "partial");
    expect(r).toEqual({ value: 3.26, used: 5, source: "weighted", nullAt: [] });
    expect(computeFormIndex([5, 4, 3, 2, 1], "baseline").value).toBe(3.26); // ครบ 5 แล้ว สองแบบได้เท่ากัน
    expect(formLevel(r.value)).toEqual({ level: 13, tier: "A", searchTolerance: 3 });
  });

  it("12) มีเกิน 5 นัด: ใช้ 5 นัดแรก (ล่าสุด) เท่านั้น", () => {
    expect(computeFormIndex([5, 4, 3, 2, 1, 0, 0], "partial").value).toBe(3.26);
  });

  it("13) ไม่ครบ 5 นัด: ผลขึ้นกับนโยบายที่ผู้เรียกระบุ (ข้อสงสัยข้อ 8 ยังไม่ตัดสิน)", () => {
    // partial [4, 2] → (4×1.5 + 2×1.3) / (1.5 + 1.3) = 8.6 / 2.8 = 3.0714… → 3.07 → Level 12
    expect(computeFormIndex([4, 2], "partial")).toEqual({ value: 3.07, used: 2, source: "weighted", nullAt: [] });
    expect(formLevel(3.07)?.level).toBe(12);
    // baseline → คงที่ 2.75 = Level 10
    expect(computeFormIndex([4, 2], "baseline")).toEqual({ value: 2.75, used: 0, source: "baseline", nullAt: [] });
  });

  it("14) ไม่มีนัดเลย = 2.75 ทั้งสองนโยบาย (สเปกระบุชัด)", () => {
    expect(computeFormIndex([], "partial").value).toBe(2.75);
    expect(computeFormIndex([], "baseline").value).toBe(2.75);
    expect(formLevel(2.75)).toEqual({ level: 10, tier: "B", searchTolerance: 3 });
  });

  it("15) มีนัดที่ Match Score เป็น null: คำนวณไม่ได้ คืน null พร้อมตำแหน่ง ไม่ข้ามและไม่ถือเป็น 0", () => {
    expect(computeFormIndex([4, null, 3, null, 2], "partial")).toEqual({ value: null, used: 0, source: "unavailable", nullAt: [1, 3] });
    // null อยู่นอก 5 นัดแรก ไม่กระทบ
    expect(computeFormIndex([5, 4, 3, 2, 1, null], "partial").value).toBe(3.26);
  });

  it("16) ค่านอกช่วง 0–5 ถูกจำกัดก่อนถ่วงน้ำหนัก (ตามโค้ดในสเปก)", () => {
    // [9, −3, 5, 5, 5] → [5, 0, 5, 5, 5] → 7.5 + 0 + 5.5 + 5 + 4.5 = 22.5 / 5.8 = 3.8793… → 3.88
    expect(computeFormIndex([9, -3, 5, 5, 5], "partial").value).toBe(3.88);
  });
});

describe("Level 1–20 ตามตารางสเปก v2.0.1", () => {
  it("17) ขอบช่วง: 2.75 และ 2.65–2.84 = Level 10 · 2.64 = 9 · 2.85 = 11", () => {
    expect(formLevel(2.65)?.level).toBe(10);
    expect(formLevel(2.84)?.level).toBe(10);
    expect(formLevel(2.64)?.level).toBe(9);
    expect(formLevel(2.85)?.level).toBe(11);
  });

  it("18) ปลายตาราง: 0 และ 1.04 = Level 1 · 1.05 = 2 · 4.64 = 19 · 4.65 และ 5 = 20 · นอกช่วงถูกจำกัด · null = null", () => {
    expect(formLevel(0)).toEqual({ level: 1, tier: "Calibrating", searchTolerance: 5 });
    expect(formLevel(1.04)?.level).toBe(1);
    expect(formLevel(1.05)?.level).toBe(2);
    expect(formLevel(4.64)?.level).toBe(19);
    expect(formLevel(4.65)).toEqual({ level: 20, tier: "SSS+", searchTolerance: 1 });
    expect(formLevel(5)?.level).toBe(20);
    expect(formLevel(7)?.level).toBe(20);
    expect(formLevel(-1)?.level).toBe(1);
    expect(formLevel(null)).toBeNull();
  });

  it("19) ทุก Level 1–20 มีครบและเรียงต่อกัน", () => {
    const mins = [0, 1.05, 1.25, 1.45, 1.65, 1.85, 2.05, 2.25, 2.45, 2.65, 2.85, 3.05, 3.25, 3.45, 3.65, 3.85, 4.05, 4.25, 4.45, 4.65];
    expect(mins.map((v) => formLevel(v)?.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

describe("ค่าคงที่", () => {
  it("20) ตรงกับสูตรที่ล็อก", () => {
    expect([SCORE_CONFIG.outcomeWin, SCORE_CONFIG.outcomeLose]).toEqual([25, -10]);
    expect(SCORE_CONFIG.kp).toEqual({ kill: 1.0, death: 0.5, assist: 0.3, tower: 2.0, floor: -10 });
    expect(SCORE_CONFIG.matchScore).toEqual({ offset: 20, divisor: 16, min: 0, max: 5 });
    expect(SCORE_CONFIG.form.weights).toEqual([1.5, 1.3, 1.1, 1.0, 0.9]);
  });
});
