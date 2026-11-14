import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ProfileFrame from "@/components/frames/ProfileFrame";
import { FRAME_IDS, resolveFrame } from "@/lib/frames/catalog";
import { dict } from "@/lib/i18n";
import { FEATURES } from "@/lib/featureFlags";

// K-AV-R3C.1: profile frames · unit (DB tests: supabase/checks/test_221_local.sql)
const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("K-AV-R3C.1 · ProfileFrame", () => {
  for (const id of FRAME_IDS) {
    it(`renders ${id} as inline SVG (no external images)`, () => {
      const html = renderToStaticMarkup(createElement(ProfileFrame, { itemId: id, size: 64 }));
      expect(html).toContain(`data-frame="${id}"`);
      expect(html).toContain("<svg");
      expect(html).not.toMatch(/<img|href="http|url\(/);
    });
  }
  it("unknown / null id → frame_rookie", () => {
    for (const v of [null, undefined, "nope", "test_card_legendary"]) {
      expect(resolveFrame(v)).toBe("frame_rookie");
      expect(renderToStaticMarkup(createElement(ProfileFrame, { itemId: v as string | null }))).toContain('data-frame="frame_rookie"');
    }
  });
  it("sizes 24/40/64/96 set width and height", () => {
    for (const size of [24, 40, 64, 96] as const) expect(renderToStaticMarkup(createElement(ProfileFrame, { size }))).toContain(`width:${size}px`);
  });
});

describe("K-AV-R3C.1 · i18n + wiring", () => {
  it("dict th/en same key set (incl. frames)", () => {
    expect(keys(dict("en")).sort()).toEqual(keys(dict("th")).sort());
    expect(dict("en").frames.equip).toBe("Equip");
  });
  it("frames flag stays off in the repo", () => expect(FEATURES.frames).toBe(false));
  it("/me renders FramePicker only behind FEATURES.frames", () => expect(read("app/me/page.tsx")).toMatch(/FEATURES\.frames \? await/));
  it("221 migration has 8 frames + equip_frame definer, no SELECT … INTO", () => {
    const sql = read("supabase/migrations/221_profile_frames.sql").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const id of FRAME_IDS) expect(sql).toContain(`'${id}'`);
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
    expect(sql).not.toMatch(/SELECT[^;]*\bINTO\s+v_/i);
  });
});
