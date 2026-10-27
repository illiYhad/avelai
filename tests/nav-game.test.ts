import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gameFromPath, isGameLocked, navFor, switchGamePath } from "@/lib/nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import StatusBadge, { STATUS_BADGES, type BadgeStatus } from "@/components/ui/StatusBadge";

// K-AV-UX2A: หัวเว็บตามเกม + ป้ายสถานะ
const LEGACY = ["/dashboard", "/leaderboard", "/profile", "/tournament/", "/teams", "/tournaments"];
const GLOBAL_OK = ["/me", "/login", "/admin/roles"];

function hrefsOf(m: ReturnType<typeof navFor>) {
  return [...m.links, ...m.account].map((l) => l.href);
}

describe("navFor (K-AV-UX2A)", () => {
  it("ไม่ล็อกอิน → /login อย่างเดียว ไม่มีตัวสลับเกม", () => {
    const m = navFor(false, "dota2");
    expect(m.home).toBe("/login");
    expect(hrefsOf(m)).toEqual([]);
    expect(m.showGameSwitcher).toBe(false);
  });

  it("ล็อกอิน mlbb → ทัวร์ · ทีม · Passport · เมนูบัญชีมี /me", () => {
    const m = navFor(true, "mlbb", { username: "pao" });
    expect(m.links.map((l) => l.label)).toEqual(["ทัวร์นาเมนต์", "ทีม", "Passport"]);
    expect(m.links.map((l) => l.href)).toEqual(["/mlbb/tournaments", "/mlbb/teams", "/mlbb/passport/pao"]);
    expect(m.links.some((l) => l.href === "/me")).toBe(false);
    expect(m.account.map((a) => a.href)).toContain("/me");
    expect(m.account.map((a) => a.label)).not.toContain("หลังบ้าน");
  });

  it("ล็อกอิน dota2 · ไม่มี username → ซ่อน Passport · admin เห็นหลังบ้าน", () => {
    const m = navFor(true, "dota2", { isAdmin: true });
    expect(m.links.map((l) => l.href)).toEqual(["/dota2/tournaments", "/dota2/teams"]);
    expect(m.account.map((a) => a.label)).toContain("หลังบ้าน");
  });

  it("locked → gameLocked จริง", () => {
    expect(navFor(true, "mlbb", { locked: true }).gameLocked).toBe(true);
    expect(navFor(true, "mlbb").gameLocked).toBe(false);
  });

  it("ไม่มีลิงก์ legacy · ทุกลิงก์ขึ้นต้น /${game}/ ยกเว้นหน้า global", () => {
    for (const game of ["mlbb", "dota2"] as const) {
      for (const href of hrefsOf(navFor(true, game, { username: "x", isAdmin: true }))) {
        if (GLOBAL_OK.includes(href)) continue;
        expect(href.startsWith(`/${game}/`)).toBe(true);
        for (const p of LEGACY) expect(href.startsWith(p)).toBe(false);
      }
    }
  });

  it("username มีอักขระพิเศษ → encode", () => {
    expect(navFor(true, "mlbb", { username: "a b/c" }).links[2].href).toBe("/mlbb/passport/a%20b%2Fc");
  });
});

describe("game path helpers", () => {
  it("ล็อกเฉพาะหน้าที่มี id", () => {
    expect(isGameLocked("/mlbb/tournaments/abc")).toBe(true);
    expect(isGameLocked("/dota2/teams/t1/schedule")).toBe(true);
    expect(isGameLocked("/mlbb/passport/pao")).toBe(true);
    expect(isGameLocked("/mlbb/tournaments")).toBe(false);
    expect(isGameLocked("/me")).toBe(false);
  });
  it("อ่านเกมจาก segment แรก", () => {
    expect(gameFromPath("/dota2/teams")).toBe("dota2");
    expect(gameFromPath("/me")).toBeNull();
    expect(gameFromPath(null)).toBeNull();
  });
  it("สลับเกม = เส้นทางเดียวกัน · หน้า global → /${to}/tournaments", () => {
    expect(switchGamePath("/mlbb/tournaments", "dota2")).toBe("/dota2/tournaments");
    expect(switchGamePath("/mlbb", "dota2")).toBe("/dota2");
    expect(switchGamePath("/me", "dota2")).toBe("/dota2/tournaments");
  });
});

describe("StatusBadge", () => {
  const ALL: BadgeStatus[] = ["OPEN", "SCHEDULED", "LIVE", "COMPLETED", "PENDING_PAYMENT", "READY_CHECK", "AWAITING_RESULT", "DISPUTED", "LOCKED"];
  it("ทุกสถานะ render ได้เป็นข้อความไทย ไม่ใช่ชื่อสถานะอังกฤษดิบ", () => {
    expect(Object.keys(STATUS_BADGES).sort()).toEqual([...ALL].sort());
    for (const s of ALL) {
      const html = renderToStaticMarkup(createElement(StatusBadge, { status: s }));
      expect(html).not.toContain(s);
      expect(html).toMatch(/[฀-๿]/);
    }
  });
});
