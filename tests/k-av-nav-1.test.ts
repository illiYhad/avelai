// K-AV-NAV.1 — เมนูเลือกเกม: Dota 2 เปิด (ขึ้นก่อน) · MLBB "เร็ว ๆ นี้" กดไม่ได้ · เส้นทาง /mlbb/... ยังอยู่
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_SLUG, GAME_MENU, isGameSlug, navFor, switchGamePath } from "@/lib/nav";
import { routes } from "@/lib/routes";

const ROOT = join(__dirname, "..");

describe("K-AV-NAV.1", () => {
  it("GAME_MENU: DOTA 2 ก่อน soon=false · MLBB soon=true", () => {
    expect(GAME_MENU.map((g) => [g.slug, g.soon])).toEqual([["dota2", false], ["mlbb", true]]);
    expect(GAME_MENU[0].label).toBe("DOTA 2");
  });

  it("ค่าเริ่มเกม = dota2 · ล็อกอินแล้วไม่ระบุเกม → ลิงก์ใต้ /dota2/", () => {
    expect(DEFAULT_GAME_SLUG).toBe("dota2");
    expect(navFor(true).home).toBe("/dota2/tournaments");
  });

  it("Navbar: เกม soon เป็น <span aria-disabled> ไม่มี Link/href · เกมเปิดยังเป็น Link", () => {
    const src = readFileSync(join(ROOT, "components", "Navbar.tsx"), "utf8");
    const branch = src.slice(src.indexOf("{g.soon ? ("), src.indexOf(") : (", src.indexOf("{g.soon ? (")));
    expect(branch).toContain('aria-disabled="true"');
    // K-AV-I18N.0c: ป้ายมาจากพจนานุกรม (th.nav.soon = "เร็ว ๆ นี้")
    expect(branch).toContain("{t.soon}");
    expect(branch).not.toMatch(/<Link|href=/);
    expect(src).toMatch(/\) : \(\s*<Link[\s\S]{0,80}href=\{localePath\(locale, switchGamePath\(pathname, g\.slug\)\)\}/);
  });

  it("เส้นทาง /mlbb/... ยังอยู่ (ไม่ลบ) · ลิงก์ตรงยังสร้างได้", () => {
    expect(isGameSlug("mlbb")).toBe(true);
    expect(routes.tournaments("mlbb")).toBe("/mlbb/tournaments");
    expect(switchGamePath("/dota2/teams", "mlbb")).toBe("/mlbb/teams");
    expect(existsSync(join(ROOT, "app", "[game]", "tournaments", "page.tsx"))).toBe(true);
  });
});
