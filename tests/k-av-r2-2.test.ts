import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AveBox from "@/app/[game]/rules/AveBox";
import { AVE, HERO } from "@/app/[game]/rules/rules-content";

// K-AV-R2.2: rules page AVE status labels follow isAveConfigured()
describe("K-AV-R2.2 · AveBox header status", () => {
  it("no key (aveReady=false) → STATUS: COMING SOON, no STATUS: ONLINE, dot not pulsing", () => {
    const html = renderToStaticMarkup(createElement(AveBox, { aveReady: false }));
    expect(html).toContain("STATUS: COMING SOON");
    expect(html).not.toContain("STATUS: ONLINE");
    const header = html.slice(0, html.indexOf("STATUS: COMING SOON"));
    expect(header.slice(header.lastIndexOf("<span"))).not.toContain("animate-pulse");
  });
  it("key set (aveReady=true) → unchanged STATUS: ONLINE // ARENA READY", () => {
    const html = renderToStaticMarkup(createElement(AveBox, { aveReady: true }));
    expect(html).toContain("STATUS: ONLINE // ARENA READY");
    expect(html).not.toContain("STATUS: COMING SOON");
  });
});

describe("K-AV-R2.2 · rules content + hero label", () => {
  it("content has both pairs", () => {
    expect(HERO.onlineSoon).toBe("AVE COMING SOON");
    expect(AVE.statusSoon).toBe("STATUS: COMING SOON");
  });
  it("page.tsx switches the hero label on isAveConfigured()", () => {
    const page = readFileSync(join(__dirname, "..", "app/[game]/rules/page.tsx"), "utf8");
    expect(page).toMatch(/isAveConfigured\(\)\s*\?\s*HERO\.online\s*:\s*HERO\.onlineSoon/);
  });
});
