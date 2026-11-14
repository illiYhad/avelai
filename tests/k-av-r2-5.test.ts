import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

// K-AV-R2.5: robots · sitemap · <html lang> by locale
describe("K-AV-R2.5 · robots.txt", () => {
  it("allows / and disallows /admin /api /obs /me · points to sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/admin", "/api", "/obs", "/me"]);
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
  });
});

describe("K-AV-R2.5 · sitemap.xml", () => {
  const urls = sitemap().map((e) => new URL(e.url).pathname);
  it("static public pages + /en pairs", () => {
    for (const p of ["/", "/dota2/tournaments", "/dota2/rules", "/help", "/dota2/esta", "/en", "/en/dota2/tournaments", "/en/dota2/rules", "/en/help", "/en/dota2/esta"]) expect(urls).toContain(p);
    expect(urls).toHaveLength(10);
  });
  it("no private/admin pages", () => {
    for (const u of urls) expect(u).not.toMatch(/\/(admin|me|api|obs)(\/|$)/);
  });
});

describe("K-AV-R2.5 · layout", () => {
  const s = readFileSync(join(__dirname, "..", "app/layout.tsx"), "utf8");
  it("<html lang={locale}> from getLocale()", () => {
    expect(s).toMatch(/const locale = await getLocale\(\)/);
    expect(s).toMatch(/<html lang=\{locale\}/);
    expect(s).not.toMatch(/<html lang="th"/);
  });
  it("metadataBase + title template", () => {
    expect(s).toMatch(/metadataBase:\s*new URL\(SITE_URL\)/);
    expect(s).toMatch(/template:\s*'%s · AVELAi'/);
  });
});
