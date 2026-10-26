// K-AV-UX2-OBS: จอ OBS ตามคัมภีร์ — ฐาน 8 · ขอบปลอดภัย ≥ 64 · กล่องสปอนเซอร์เท่ากันใน Tier · poll/route เดิมไม่เปลี่ยน
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ObsScreen, POLL_MS } from "@/app/obs/_components/ObsScreen";
import { BRACKET_MAX_ROUNDS, BRACKET_MAX_ROWS, LOWER_THIRD_BG, OBS_SAFE, S, SPACE_SCALE, SPONSOR_BOX, clipBracket, obsLayoutVars, stripeColor } from "@/lib/obs/theme";
import { obsDataPath } from "@/lib/obs/urls";
import { OBS_THEMES } from "@/lib/obs/validate";

const SRC = readFileSync(join(process.cwd(), "app/obs/_components/ObsScreen.tsx"), "utf8");
const ALLOWED = new Set<number>(SPACE_SCALE);
const TID = "11111111-1111-4111-8111-111111111111";
const T = { name: "Cup", game: "MLBB", format: "SE", status: "RUNNING", best_of: 3 };

describe("(ก) ฐาน 8: ไม่มี padding/margin/gap เลขดิบนอกสเกล", () => {
  it("ไม่มีตัวเลขดิบใน padding/margin/gap (ต้องใช้ S.*)", () => {
    // 0 = รีเซ็ตค่าเริ่มต้นของเบราว์เซอร์ (อนุญาต) · เลขอื่นห้ามเขียนดิบ
    const raw = [...SRC.matchAll(/\b(padding|margin|gap)[A-Za-z]*\s*:\s*(\d+)/g)].filter((m) => m[2] !== "0").map((m) => m[0]);
    expect(raw).toEqual([]);
  });
  it("ค่า px ในสตริง padding/margin/gap อยู่ในสเกล", () => {
    const bad = [...SRC.matchAll(/\b(padding|margin|gap)[A-Za-z]*\s*:\s*["'`]([^"'`]*)["'`]/g)]
      .flatMap((m) => [...m[2].matchAll(/(\d+)px/g)].map((p) => Number(p[1])))
      .filter((n) => !ALLOWED.has(n));
    expect(bad).toEqual([]);
  });
  it("ค่าใน S ทุกตัวอยู่ในสเกลฐาน 8 (4 สำหรับส่วนย่อย)", () => {
    for (const v of Object.values(S)) expect(ALLOWED.has(v)).toBe(true);
  });
});

describe("(ข) ขอบปลอดภัย ≥ 64 · ไม่เลื่อน", () => {
  it("OBS_SAFE 64–96 และตัวแปร --obs-safe ทุกธีม", () => {
    expect(OBS_SAFE).toBeGreaterThanOrEqual(64);
    expect(OBS_SAFE).toBeLessThanOrEqual(96);
    for (const th of OBS_THEMES) expect(obsLayoutVars(th)["--obs-safe"]).toBe("64px");
  });
  it("ราก ObsScreen ใช้ padding = var(--obs-safe) + overflow hidden", () => {
    const html = renderToStaticMarkup(createElement(ObsScreen, { kind: "bracket", tournamentId: TID, theme: "DARK", tournament: T, initialRows: [] }));
    const root = html.match(/<div data-obs-screen="[^"]*" style="([^"]*)"/)?.[1] ?? "";
    expect(root).toContain("--obs-safe:64px");
    expect(root).toContain("padding:var(--obs-safe)");
    expect(root).toContain("overflow:hidden");
  });
  it("สายยาวตัดที่ระดับรอบ/แถว ไม่เลื่อน", () => {
    const rounds = Array.from({ length: 8 }, (_, i) => i + 1);
    const c = clipBracket(rounds, () => Array.from({ length: 12 }, (_, i) => i));
    expect(c.hiddenRounds).toBe(8 - BRACKET_MAX_ROUNDS);
    expect(c.rounds.map((r) => r.round)).toEqual([4, 5, 6, 7, 8]);
    expect(c.rounds[0].rows).toHaveLength(BRACKET_MAX_ROWS);
    expect(c.rounds[0].hidden).toBe(12 - BRACKET_MAX_ROWS);
  });
});

describe("(ค) กล่องสปอนเซอร์ขนาดเท่ากันภายใน Tier", () => {
  it("โลโก้ต่างขนาดได้กล่องเท่ากัน · GOLD ใหญ่สุด", () => {
    const rows = [
      { name: "A", tier: "GOLD", logo_url: "https://x/a-wide.png" },
      { name: "B", tier: "GOLD", logo_url: "https://x/b-tall.png" },
      { name: "C", tier: "SILVER", logo_url: "https://x/c.png" },
      { name: "D", tier: "SILVER", logo_url: null },
      { name: "E ชื่อสปอนเซอร์ยาวมากมากมากมากมากมาก", tier: "PARTNER", logo_url: "https://x/e.png" },
    ];
    const html = renderToStaticMarkup(createElement(ObsScreen, { kind: "sponsors", tournamentId: TID, theme: "GOLD", tournament: T, initialRows: rows }));
    const boxes = [...html.matchAll(/data-sponsor-tier="(\w+)"[^>]*style="width:(\d+)px/g)].map((m) => ({ tier: m[1], w: Number(m[2]) }));
    expect(boxes).toHaveLength(5);
    for (const tier of ["GOLD", "SILVER"]) {
      const ws = new Set(boxes.filter((b) => b.tier === tier).map((b) => b.w));
      expect(ws.size).toBe(1);
    }
    expect(boxes.find((b) => b.tier === "GOLD")!.w).toBe(SPONSOR_BOX.GOLD.w);
    expect(SPONSOR_BOX.GOLD.w).toBeGreaterThan(SPONSOR_BOX.SILVER.w);
    expect(html).toContain("object-fit:contain");
    expect(html).toContain("-webkit-line-clamp:2");
  });
  it("ขนาดกล่องทุก Tier อยู่บนฐาน 8", () => {
    for (const b of Object.values(SPONSOR_BOX)) { expect(b.w % 8).toBe(0); expect(b.h % 8).toBe(0); }
  });
});

describe("(ง) poll 5000ms + route เดิม", () => {
  it("POLL_MS = 5000 · path /obs/api/[id]/[kind]", () => {
    expect(POLL_MS).toBe(5000);
    expect(obsDataPath(TID, "now")).toBe(`/obs/api/${TID}/now`);
    expect(SRC).toContain("setInterval(tick, POLL_MS)");
    expect(SRC).toContain('startsWith("https://")');
  });
});

describe("ป้ายล่าง + ตัวเลข", () => {
  it("พื้นทึบ 85–90% ทุกธีม · แถบ LIVE = สีสด", () => {
    for (const th of OBS_THEMES) {
      const a = Number(LOWER_THIRD_BG[th].match(/([\d.]+)\)$/)?.[1]);
      expect(a).toBeGreaterThanOrEqual(0.85);
      expect(a).toBeLessThanOrEqual(0.9);
    }
    expect(stripeColor("LIVE")).toBe("#F87171");
    expect(stripeColor("PAUSED")).toBe("var(--obs-accent)");
  });
  it("หน้า now มี blur 12px + แถบ 6px + tabular-nums", () => {
    const rows = [{ stage: "WB", round: 1, position: 1, status: "LIVE", best_of: 3, score_a: 1, score_b: 0, team_a_name: "ทีมชื่อไทยยาวมากมากมากมากมากมากมากมาก", team_a_tag: "AAA", team_b_name: "B", team_b_tag: "BBB" }];
    const html = renderToStaticMarkup(createElement(ObsScreen, { kind: "now", tournamentId: TID, theme: "DARK", tournament: T, initialRows: rows }));
    expect(html).toContain("backdrop-filter:blur(12px)");
    expect(html).toContain("border-left:6px solid #F87171");
    expect(html).toContain("font-variant-numeric:tabular-nums");
    expect(html).toContain("[AAA]");
    expect(html).not.toContain("max-width:420px");
  });
});
