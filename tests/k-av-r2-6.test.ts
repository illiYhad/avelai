import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dict } from "@/lib/i18n";
import { Receipt } from "@/components/payments/Receipt";
import ProfileForm from "@/app/me/ProfileForm";
import SteamLinkBanner from "@/app/me/SteamLinkBanner";

// K-AV-R2.6: translation batch a · /pass · receipt · /login · /me
const THAI = /[฀-๿]/;
const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe("K-AV-R2.6 · dict", () => {
  it("th and en have the same key set", () => expect(keys(dict("en")).sort()).toEqual(keys(dict("th")).sort()));
  it("en values of the new sections contain no Thai characters", () => {
    for (const s of ["pass", "receipt", "login", "me"] as const) for (const [k, v] of Object.entries(dict("en")[s])) expect(v, `${s}.${k}`).not.toMatch(THAI);
  });
  it("en price line keeps every number (380 via {price}, 75 · 40 · 35 · 25)", () => {
    const line = dict("en").pass.priceLine.replace("{price}", "380");
    for (const n of ["380", "75%", "40%", "35%", "25%"]) expect(line).toContain(n);
    const th = dict("th").pass.priceLine.replace("{price}", "380");
    for (const n of ["380", "75%", "40%", "35%", "25%"]) expect(th).toContain(n);
  });
});

describe("K-AV-R2.6 · components render English without Thai", () => {
  it("Receipt (en)", () => {
    const html = renderToStaticMarkup(createElement(Receipt, { locale: "en", r: { paymentId: "p1", kind: "PASS", amountThb: 380, verifiedAt: "2026-11-01T00:00:00Z", payerUsername: "player1", description: "Arena Pass (Dota 2)", payee: "Balehm Tech Studio" } }));
    const withoutDate = html.replace(/<dd>[^<]*25\d\d[^<]*<\/dd>/g, ""); // Thai-formatted date = data, not UI text
    expect(withoutDate).not.toMatch(THAI);
    expect(html).toContain("Payment confirmation");
  });
  it("ProfileForm + SteamLinkBanner (en)", () => {
    expect(renderToStaticMarkup(createElement(ProfileForm, { username: "u", avatarUrl: "", locale: "en" }))).not.toMatch(THAI);
    expect(renderToStaticMarkup(createElement(SteamLinkBanner, { dota: null, unavailable: false, locale: "en" }))).not.toMatch(THAI);
  });
});

describe("K-AV-R2.6 · AVE label on /me and /login follows isAveConfigured()", () => {
  for (const f of ["app/me/page.tsx", "app/login/page.tsx"]) {
    it(f, () => {
      const s = readFileSync(join(__dirname, "..", f), "utf8");
      expect(s).toMatch(/isAveConfigured\(\)\s*\?\s*dict\(await getLocale\(\)\)\.login\.aveOnline\s*:\s*dict\(await getLocale\(\)\)\.login\.aveSoon/);
      expect(s).not.toMatch(/>\s*AVE ONLINE \/\/ ARENA READY\s*</);
    });
  }
});
