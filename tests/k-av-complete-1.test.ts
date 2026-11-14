import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legacyRoute } from "@/middleware";
import { dict, stripLocale } from "@/lib/i18n";

// K-AV-COMPLETE.1 (+1a): legacy routes closed in middleware · 404/500 pages
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("K-AV-COMPLETE.1 · legacyRoute redirects (exact path only)", () => {
  const table: [string, string][] = [
    ["/dashboard", "/me"],
    ["/profile", "/me"],
    ["/subscribe", "/dota2/pass"],
    ["/leaderboard", "/dota2/tournaments"],
    ["/matches", "/dota2/tournaments"],
    ["/match-history", "/me/dota"],
  ];
  for (const [from, to] of table) {
    it(`${from} → ${to} (and /en${from} via stripLocale)`, () => {
      expect(legacyRoute(from)).toEqual({ kind: "redirect", to });
      expect(legacyRoute(stripLocale(`/en${from}`))).toEqual({ kind: "redirect", to });
      expect(legacyRoute(`${from}/`)).toEqual({ kind: "redirect", to });
    });
  }
});

describe("K-AV-COMPLETE.1 · legacyRoute 404", () => {
  for (const p of ["/status", "/waiting-room/abc", "/draft/demo", "/match/123", "/match-result/9", "/profile/u1"]) {
    it(`${p} → 404 (and /en)`, () => {
      expect(legacyRoute(p)).toEqual({ kind: "404" });
      expect(legacyRoute(stripLocale(`/en${p}`))).toEqual({ kind: "404" });
    });
  }
});

describe("K-AV-COMPLETE.1a · paths that must NOT be caught", () => {
  for (const p of [
    "/", "/dota2/pass", "/dota2/tournaments", "/me", "/me/dota", "/login", "/login/callback",
    "/api/ave/chat", "/obs/overlay", "/admin/passport", "/auth/callback", "/link/steam",
    "/tournament/daily", "/tournament/weekly", "/tournament/monthly", "/tournament/abc/register",
    "/matches/abc", "/dashboard/x", "/subscribe/x",
  ]) {
    it(`${p} → null`, () => expect(legacyRoute(p)).toBeNull());
  }
});

describe("K-AV-COMPLETE.1 · i18n + error pages", () => {
  it("th/en have errors.notFound/backHome/serverError/tryAgain", () => {
    for (const l of ["th", "en"] as const) {
      const e = dict(l).errors;
      for (const k of ["notFound", "backHome", "serverError", "tryAgain"] as const) expect(e[k]).toBeTruthy();
    }
    expect(dict("th").errors.notFound).toBe("ไม่พบหน้านี้");
    expect(dict("en").errors.notFound).toBe("Page not found");
  });
  it("error.tsx / global-error.tsx never render error.message or stack", () => {
    for (const f of ["app/error.tsx", "app/global-error.tsx"]) {
      const s = src(f);
      expect(s).not.toMatch(/error\s*\.\s*message/);
      expect(s).not.toMatch(/error\s*\.\s*stack/);
      expect(s).toMatch(/reset\(\)/);
    }
    expect(src("app/global-error.tsx")).toMatch(/<html[\s>]/);
  });
  it("middleware: legacy check runs before the existing logic", () => {
    const m = src("middleware.ts");
    expect(m.indexOf("legacyRoute(stripLocale")).toBeLessThan(m.indexOf("let response = pass()"));
  });
});
