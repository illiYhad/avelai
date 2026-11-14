import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legacyRoute } from "@/middleware";
import { dict, stripLocale } from "@/lib/i18n";

// K-AV-R2.1: /tournament/daily·weekly·monthly → /dota2/tournaments · hub cards show "coming soon"
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("K-AV-R2.1 · tournament tier redirects", () => {
  for (const p of ["/tournament/daily", "/tournament/weekly", "/tournament/monthly"]) {
    it(`${p} → /dota2/tournaments (and /en)`, () => {
      expect(legacyRoute(p)).toEqual({ kind: "redirect", to: "/dota2/tournaments" });
      expect(legacyRoute(stripLocale(`/en${p}`))).toEqual({ kind: "redirect", to: "/dota2/tournaments" });
    });
  }
  it("/tournament/x/register and /tournament/daily/x are not caught", () => {
    expect(legacyRoute("/tournament/x/register")).toBeNull();
    expect(legacyRoute("/tournament/daily/x")).toBeNull();
  });
});

describe("K-AV-R2.1 · hub cards", () => {
  it("TIERS has no link to /tournament/", () => {
    const hub = src("components/tournament/TournamentHub.tsx");
    const tiers = hub.slice(hub.indexOf("const TIERS"), hub.indexOf("];", hub.indexOf("const TIERS")));
    expect(tiers).not.toMatch(/href:\s*"\/tournament\//);
    expect((tiers.match(/href:\s*null/g) ?? []).length).toBe(4);
  });
  it("dict th/en has hub.comingSoon and the page passes it in", () => {
    expect(dict("th").hub.comingSoon).toBe("เร็ว ๆ นี้");
    expect(dict("en").hub.comingSoon).toBe("Coming soon");
    expect(src("app/[game]/tournaments/page.tsx")).toMatch(/soonLabel=\{dict\(await getLocale\(\)\)\.hub\.comingSoon\}/);
  });
});
