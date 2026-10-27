import { describe, it, expect } from "vitest";
import { GAME_REDIRECTS } from "../next.config";

// K-AV-UX2B: ลิงก์เก่า → /[game]/… · 301 ทุกแถว · ?game=dota2 มาก่อนแถว default

const SOURCES = [
  "/tournaments/:path*", "/tournaments", "/teams/:path*", "/teams",
  "/team/:id/:section(schedule|budget|scout)", "/passport/:username",
  "/pass/:path*", "/pass", "/matches/:id/:path*", "/matches/:id", "/organizer/:path*", "/organizer",
];

describe("redirects", () => {
  it("ครบทุกแถว · ทุกแถว permanent", () => {
    expect([...new Set(GAME_REDIRECTS.map((r) => r.source))]).toEqual(SOURCES);
    expect(GAME_REDIRECTS.every((r) => r.permanent === true)).toBe(true);
  });
  it("แต่ละ source: แถว dota2 (has query) มาก่อน แถว mlbb", () => {
    for (const s of SOURCES) {
      const rows = GAME_REDIRECTS.filter((r) => r.source === s);
      expect(rows).toHaveLength(2);
      expect(rows[0].has?.[0]).toEqual({ type: "query", key: "game", value: "dota2" });
      expect(rows[0].destination.startsWith("/dota2/")).toBe(true);
      expect(rows[1].has).toBeUndefined();
      expect(rows[1].destination.startsWith("/mlbb/")).toBe(true);
    }
  });
  it("/team/:id/... → /teams/:id/... · /matches เปล่าไม่ถูก redirect", () => {
    expect(GAME_REDIRECTS.find((r) => r.source.startsWith("/team/"))!.destination).toBe("/dota2/teams/:id/:section");
    expect(GAME_REDIRECTS.some((r) => r.source === "/matches")).toBe(false);
  });
});
