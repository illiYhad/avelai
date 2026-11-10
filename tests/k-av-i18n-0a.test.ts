// K-AV-I18N.0a — โครงหลายภาษา: พจนานุกรม · /en rewrite · เส้นไทยไม่ถูกแตะ · ปุ่ม TH|EN · ไม่มีแพ็กเกจใหม่
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { th } from "@/lib/i18n/th";
import { en } from "@/lib/i18n/en";
import { localeFromPath, localePath, LOCALE_COOKIE, LOCALE_HEADER, stripLocale, switchLocalePath } from "@/lib/i18n";
import { navFor } from "@/lib/nav";

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u" } } }) } }) }));

const ROOT = join(__dirname, "..");
type Tree = { [k: string]: string | Tree };
const keys = (o: Tree, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)));

async function run(path: string) {
  process.env.SUPABASE_URL = "http://127.0.0.1:1";
  process.env.SUPABASE_ANON_KEY = "test";
  const { middleware } = await import("@/middleware");
  return middleware(new NextRequest(new URL(path, "http://localhost:3120")));
}

describe("K-AV-I18N.0a", () => {
  it("a) พจนานุกรม th/en key ครบตรงกัน · ไม่มีค่าว่าง", () => {
    expect(keys(en as unknown as Tree)).toEqual(keys(th as unknown as Tree));
    for (const k of keys(en as unknown as Tree)) expect(k.split(".").reduce<unknown>((o, x) => (o as Tree)[x], en)).not.toBe("");
  });

  it("b) เส้นไทย (ทุกเส้นใน nav + / + /login) ไม่ถูก redirect/rewrite · header ภาษา = th", async () => {
    const nav = navFor(true, "dota2", { username: "kolt", isAdmin: true });
    const paths = ["/", "/login", nav.home, ...nav.links.map((l) => l.href), ...nav.account.map((a) => a.href)];
    for (const p of paths) {
      expect(p.startsWith("/en")).toBe(false);
      const res = await run(p);
      expect(res.headers.get("location"), p).toBeNull();
      expect(res.headers.get("x-middleware-rewrite"), p).toBeNull();
      expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`), p).toBe("th");
    }
  });

  it("c) /en/dota2/tournaments → rewrite ไป /dota2/tournaments ภาษา en · จำ cookie", async () => {
    const res = await run("/en/dota2/tournaments");
    expect(new URL(res.headers.get("x-middleware-rewrite")!).pathname).toBe("/dota2/tournaments");
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("en");
    expect(res.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
    expect(localeFromPath("/en")).toBe("en");
    expect(localeFromPath("/entry")).toBe("th");
    expect(stripLocale("/en")).toBe("/");
  });

  it("d) ปุ่มสลับ: ไทย ↔ /en อยู่หน้าเดิม · ลิงก์ nav ภาษา en ขึ้นต้น /en", () => {
    expect(switchLocalePath("/dota2/tournaments", "en")).toBe("/en/dota2/tournaments");
    expect(switchLocalePath("/en/dota2/tournaments", "th")).toBe("/dota2/tournaments");
    expect(switchLocalePath("/", "en")).toBe("/en");
    expect(switchLocalePath("/en", "th")).toBe("/");
    expect(localePath("en", "https://x.y/z")).toBe("https://x.y/z");
    const n = navFor(true, "dota2", { locale: "en" });
    expect(n.links.map((l) => [l.href, l.label])).toEqual([["/en/dota2/tournaments", "Tournaments"], ["/en/dota2/teams", "Teams"], ["/en/dota2/rules", "Rules"]]);
    expect(navFor(true, "dota2").links[0]).toEqual({ href: "/dota2/tournaments", label: "ทัวร์นาเมนต์" });
  });

  it("e) ไม่มี import แพ็กเกจ i18n ใหม่ · package.json ไม่มี dependency i18n", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /i18n|intl|lingui|i18next/.test(d))).toEqual([]);
    for (const f of ["index.ts", "th.ts", "en.ts", "server.ts"]) {
      const imports = [...readFileSync(join(ROOT, "lib", "i18n", f), "utf8").matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
      for (const i of imports) expect(i === "next/headers" || i.startsWith("./")).toBe(true);
    }
  });
});
