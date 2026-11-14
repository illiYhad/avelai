import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AVE_DEFAULT_MODEL, aveModel, isAveConfigured } from "@/lib/ave/config";
import AveBox from "@/app/[game]/rules/AveBox";
import { dict } from "@/lib/i18n";

// K-AV-AVE.soon: no GROQ_API_KEY → "AVE is coming soon" label, no request to /api/ave/chat · model name from AVE_MODEL
const root = join(__dirname, "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

describe("K-AV-AVE.soon · lib/ave/config", () => {
  it("isAveConfigured: missing / blank / set", () => {
    expect(isAveConfigured({})).toBe(false);
    expect(isAveConfigured({ GROQ_API_KEY: "" })).toBe(false);
    expect(isAveConfigured({ GROQ_API_KEY: "   " })).toBe(false);
    expect(isAveConfigured({ GROQ_API_KEY: "gsk_test" })).toBe(true);
  });
  it("aveModel: missing / blank → default · set → that value", () => {
    expect(aveModel({})).toBe(AVE_DEFAULT_MODEL);
    expect(aveModel({ AVE_MODEL: "  " })).toBe("llama-3.3-70b-versatile");
    expect(aveModel({ AVE_MODEL: "llama-3.1-8b-instant" })).toBe("llama-3.1-8b-instant");
  });
});

describe("K-AV-AVE.soon · AveBox (rules page)", () => {
  it("aveReady=false → coming-soon label, no input/submit, fetch never called", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const html = renderToStaticMarkup(createElement(AveBox, { aveReady: false, soonLabel: dict("en").help.menu.aveSoon }));
    expect(html).toContain("AVE is coming soon");
    expect(html).toContain('data-testid="ave-soon"');
    expect(html).not.toMatch(/<input/);
    expect(html).not.toMatch(/type="submit"/);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("aveReady=true (default) → input + send button as before, no soon label", () => {
    const html = renderToStaticMarkup(createElement(AveBox));
    expect(html).toMatch(/<input/);
    expect(html).toMatch(/type="submit"/);
    expect(html).not.toContain('data-testid="ave-soon"');
  });
});

describe("K-AV-AVE.soon · wiring (source)", () => {
  it("i18n has the soon label in th and en", () => {
    expect(dict("th").help.menu.aveSoon).toBe("AVE กำลังจะมาเร็ว ๆ นี้");
    expect(dict("en").help.menu.aveSoon).toBe("AVE is coming soon");
  });
  it("route.ts: no hard-coded model · uses aveModel() and isAveConfigured()", () => {
    const route = src("app/api/ave/chat/route.ts");
    expect(route).not.toMatch(/model:\s*'llama/);
    expect(route).toMatch(/model:\s*aveModel\(\)/);
    expect(route).toMatch(/if\s*\(\s*!isAveConfigured\(\)\s*\)/);
  });
  it("AVEChatbot: guard before fetch + soon label replaces the input form", () => {
    const c = src("components/AVEChatbot.tsx");
    expect(c).toMatch(/if\s*\(\s*!aveReady\s*\|\|/);
    expect(c).toMatch(/!aveReady\s*\?\s*\(\s*<p data-ave-soon/);
    expect(c.indexOf("if (!aveReady")).toBeLessThan(c.indexOf("fetch('/api/ave/chat'"));
  });
  it("layout + rules page pass a boolean from isAveConfigured() (no key to the client)", () => {
    expect(src("app/layout.tsx")).toMatch(/aveReady=\{isAveConfigured\(\)\}/);
    expect(src("app/[game]/rules/page.tsx")).toMatch(/<AveBox aveReady=\{isAveConfigured\(\)\}/);
    for (const f of ["components/AVEChatbot.tsx", "app/[game]/rules/AveBox.tsx"]) expect(src(f)).not.toMatch(/GROQ_API_KEY/);
  });
});
