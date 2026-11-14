import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Footer from "@/components/Footer";
import { dict } from "@/lib/i18n";
import { needsLogin } from "@/lib/auth/protected-paths";

// K-AV-R2.4: footer + /privacy /terms skeleton (policy text pending Alice)
let mockLocale: "th" | "en" = "th";
vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => mockLocale }));

describe("K-AV-R2.4 · Footer", () => {
  it("th: 3 links without /en", () => {
    const html = renderToStaticMarkup(createElement(Footer, { locale: "th" }));
    for (const h of ['href="/privacy"', 'href="/terms"', 'href="/help"']) expect(html).toContain(h);
    expect(html).toContain("ความเป็นส่วนตัว");
    expect(html).toContain("© 2026 AVELAi · Balehm Tech Studio");
  });
  it("en: 3 links with /en prefix", () => {
    const html = renderToStaticMarkup(createElement(Footer, { locale: "en" }));
    for (const h of ['href="/en/privacy"', 'href="/en/terms"', 'href="/en/help"']) expect(html).toContain(h);
    expect(html).toContain("Terms of use");
  });
  it("layout renders Footer after AVEChatbot; <html line untouched", () => {
    const s = readFileSync(join(__dirname, "..", "app/layout.tsx"), "utf8");
    expect(s.indexOf("<Footer locale=")).toBeGreaterThan(s.indexOf("<AVEChatbot"));
    expect(s).toMatch(/<html lang="th"/);
  });
});

describe("K-AV-R2.4 · /privacy /terms pages", () => {
  for (const kind of ["privacy", "terms"] as const) {
    for (const l of ["th", "en"] as const) {
      it(`${kind} (${l}) shows title + pending text only`, async () => {
        mockLocale = l;
        const { default: Page } = await import(`@/app/${kind}/page`);
        const html = renderToStaticMarkup(await Page());
        const t = dict(l).legal;
        expect(html).toContain(kind === "privacy" ? t.privacyTitle : t.termsTitle);
        expect(html).toContain(t.pending);
        expect(html).not.toMatch(/ข้อมูลส่วนบุคคลของท่านจะ/);
        expect((html.match(/<p/g) ?? []).length).toBe(1); // ไม่มีย่อหน้านโยบายแต่งเอง
      });
    }
    it(`/${kind} is public (no login)`, () => expect(needsLogin(`/${kind}`)).toBe(false));
  }
});
