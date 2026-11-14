import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dict } from "@/lib/i18n";

// K-AV-R2.7: /login/steam/choose + /me/dota → dict (login / me)
vi.mock("@/app/login/steam/choose/actions", () => ({ newPlayerAction: vi.fn(), sendCodeAction: vi.fn(), verifyCodeAction: vi.fn() }));

const THAI = /[฀-๿]/;
const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const code = (f: string) =>
  readFileSync(join(__dirname, "..", f), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\{\/\*)/.test(l)).join("\n");

describe("K-AV-R2.7 · dict", () => {
  it("th/en have the same key set", () => expect(keys(dict("en")).sort()).toEqual(keys(dict("th")).sort()));
  it("new en values carry no Thai", () => {
    const en = dict("en");
    for (const [k, v] of Object.entries(en.login)) if (k.startsWith("choose")) expect(v, k).not.toMatch(THAI);
    for (const [k, v] of Object.entries(en.me)) if (k.startsWith("dota")) expect(v, k).not.toMatch(THAI);
  });
});

describe("K-AV-R2.7 · pages", () => {
  it("ChooseForm renders with en and no Thai", async () => {
    const { default: ChooseForm } = await import("@/app/login/steam/choose/ChooseForm");
    const html = renderToStaticMarkup(createElement(ChooseForm, { locale: "en" }));
    expect(html).toContain("I&#x27;m a new player");
    expect(html).not.toMatch(THAI);
  });
  it("ChooseForm default (th) unchanged", async () => {
    const { default: ChooseForm } = await import("@/app/login/steam/choose/ChooseForm");
    expect(renderToStaticMarkup(createElement(ChooseForm))).toContain("ฉันเป็นผู้เล่นใหม่");
  });
  it("choose/page.tsx + me/dota/page.tsx: no Thai outside comments, metadata via generateMetadata", () => {
    for (const f of ["app/login/steam/choose/page.tsx", "app/login/steam/choose/ChooseForm.tsx", "app/me/dota/page.tsx"]) expect(code(f), f).not.toMatch(THAI);
    expect(code("app/login/steam/choose/page.tsx")).toMatch(/export async function generateMetadata/);
  });
});
