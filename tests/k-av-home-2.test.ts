import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { th } from "@/lib/i18n/th";
import { en } from "@/lib/i18n/en";
import { CONTACT } from "@/lib/contact";
import { helpMenuItems } from "@/lib/help/menu";
import { helpCategories } from "@/lib/help/articles";
import { localePath } from "@/lib/i18n";
import { homeSlides } from "@/lib/home/slides";
import { LeftRail } from "@/components/home/HomeRails";
import { shouldShowIntro, markIntroSeen, ESTA_INTRO_KEY } from "@/components/esta/EstaIntro";

// K-AV-HOME.2: หน้าลีก ESTA · กล่องแนะนำครั้งแรก · เมนูช่วยเหลือ · ศูนย์ช่วยเหลือ — ไม่ใช้ env · ไม่ต่อเน็ต

const h = vi.hoisted(() => ({ locale: "th" as "th" | "en", rows: [] as unknown[], dbOff: false }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => h.locale }));
vi.mock("@/lib/db/server", () => {
  const q = (data: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "order", "limit", "in"]) c[m] = () => c;
    (c as { then: unknown }).then = (r: (v: unknown) => void) => r({ data });
    return c;
  };
  return {
    getServerDb: async () => (h.dbOff ? null : { from: (tbl: string) => q(tbl === "tournaments" ? h.rows : []) }),
  };
});

import EstaPage from "@/app/[game]/esta/page";
import HelpPage from "@/app/help/page";

const root = join(__dirname, "..");
const renderEsta = async (game = "dota2") => renderToStaticMarkup(await EstaPage({ params: Promise.resolve({ game }) }));
const renderHelp = async () => renderToStaticMarkup(await HelpPage());

beforeEach(() => { h.locale = "th"; h.rows = []; h.dbOff = false; });

describe("a) หน้าลีก ESTA th/en render", () => {
  it("ไทย: หัวลีก + คำอธิบายจาก SYSTEM_CORE + ตารางอันดับ รายวัน/Weekend ว่างพร้อมปุ่มทำต่อ", async () => {
    const html = await renderEsta();
    expect(html).toContain("ESTA");
    expect(html).toContain(th.esta.subtitle);
    expect(html).toContain('data-standings="daily"');
    expect(html).toContain('data-standings="weekend"');
    expect(html).toContain(th.esta.noStandings);
    expect(html).toMatch(/href="\/dota2\/tournaments"[^>]*>หาทัวร์</);
  });
  it("อังกฤษ: ข้อความจาก en + ลิงก์ขึ้นต้น /en", async () => {
    h.locale = "en";
    h.rows = [{ id: "t1", name: "ESTA Daily #1", format: "SWISS", best_of: 1, max_teams: 16, status: "REGISTRATION", start_at: null, team_size: 5 }];
    const html = await renderEsta();
    expect(html).toContain(en.esta.subtitle);
    expect(html).toContain('href="/en/dota2/tournaments/t1"');
    expect(html).toContain("0/16 teams");
    expect(html).not.toContain("ตารางอันดับ");
  });
  it("เกมที่ไม่มี = 404", async () => {
    await expect(renderEsta("valorant")).rejects.toThrow("NOT_FOUND");
  });
  it("ไม่ต่อฐาน = ข้อความแจ้ง ไม่ล้ม", async () => {
    h.dbOff = true;
    expect(await renderEsta()).toContain(th.esta.noDb);
  });
});

describe("b) ปุ่ม Join disabled ไม่มี action", () => {
  it("button disabled · ไม่มี href/form/onClick", async () => {
    const html = await renderEsta();
    const m = html.match(/<button[^>]*data-esta-join[^>]*>/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain("disabled");
    expect(html).not.toMatch(/<form/);
    const src = readFileSync(join(root, "app/[game]/esta/page.tsx"), "utf8");
    expect(src).not.toMatch(/data-esta-join[^>]*onClick/);
  });
});

describe("c) ไม่เรียก organizer_memberships", () => {
  it("ไฟล์ใหม่ของใบนี้ไม่มีคำ organizer_memberships", () => {
    const files = ["app/[game]/esta/page.tsx", "app/help/page.tsx", "components/esta/EstaIntro.tsx", "components/AVEChatbot.tsx", "lib/help/menu.ts", "lib/help/articles.ts", "lib/contact.ts"];
    for (const f of files) expect(readFileSync(join(root, f), "utf8"), f).not.toContain("organizer_memberships");
  });
});

describe("d) กล่องแนะนำครั้งแรกครั้งเดียว", () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it("ครั้งแรกเด้ง · กดแล้วครั้งต่อไปไม่เด้ง", () => {
    const s = mem();
    expect(shouldShowIntro(s)).toBe(true);
    markIntroSeen(s);
    expect(s.getItem(ESTA_INTRO_KEY)).toBe("1");
    expect(shouldShowIntro(s)).toBe(false);
  });
  it("อ่าน storage ไม่ได้ = ไม่เด้ง ไม่พัง", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(shouldShowIntro(bad)).toBe(false);
    expect(() => markIntroSeen(bad)).not.toThrow();
    expect(shouldShowIntro(null)).toBe(false);
  });
});

describe("e) เมนูช่วยเหลือ 5 รายการ", () => {
  it("ทักทาย · คุยกับ AVE · กติกา · ติดต่อ · ศูนย์ช่วยเหลือ", () => {
    const items = helpMenuItems("th", "Yhad");
    expect(items.map((i) => i.id)).toEqual(["greeting", "chat", "rules", "contact", "help"]);
    expect(items[0].label).toContain("Yhad");
    expect(helpMenuItems("th", null)[0].label).toBe(th.help.menu.greetGuest);
    const links = Object.fromEntries(items.filter((i) => i.kind === "link").map((i) => [i.id, (i as { href: string }).href]));
    expect(links).toEqual({ rules: "/dota2/rules", help: "/help" });
    const enLinks = helpMenuItems("en").filter((i) => i.kind === "link").map((i) => (i as { href: string }).href);
    expect(enLinks).toEqual(["/en/dota2/rules", "/en/help"]);
  });
  it("AVEChatbot ใช้ helpMenuItems + ยังเรียก /api/ave/chat เหมือนเดิม", () => {
    const src = readFileSync(join(root, "components/AVEChatbot.tsx"), "utf8");
    expect(src).toContain("helpMenuItems(");
    expect(src).toContain("fetch('/api/ave/chat'");
  });
});

describe("f) ค่าติดต่อมาจากค่าคงที่เดียว", () => {
  it("CONTACT = XXX ทั้ง 2 · เมนูและหน้า help อ่านจาก CONTACT", async () => {
    expect(CONTACT).toEqual({ discord: "XXX", email: "XXX" });
    const c = helpMenuItems("th").find((i) => i.kind === "contact") as { lines: string[] };
    expect(c.lines).toEqual(["Discord: XXX", "อีเมล: XXX"]);
    expect(await renderHelp()).toContain("Discord: XXX");
  });
  it("ไม่มีลิงก์ discord.gg / mailto: ในโค้ดใหม่", () => {
    for (const f of ["lib/help/menu.ts", "app/help/page.tsx", "components/AVEChatbot.tsx", "lib/contact.ts"]) {
      const s = readFileSync(join(root, f), "utf8");
      expect(s, f).not.toMatch(/discord\.gg|mailto:/);
    }
  });
});

describe("g) ศูนย์ช่วยเหลือ 4 หมวด th/en", () => {
  it("4 หมวด · เรื่องที่ไม่มีมติ = เร็ว ๆ นี้", async () => {
    const cats = helpCategories(th.help.center, (p) => p);
    expect(cats.map((c) => c.id)).toEqual(["start", "play", "organizer", "space"]);
    expect(cats.find((c) => c.id === "play")!.articles.find((a) => a.id === "tickets")!.body).toBeUndefined();
    const html = await renderHelp();
    for (const id of ["start", "play", "organizer", "space"]) expect(html).toContain(`data-help-category="${id}"`);
    expect(html).toContain(th.help.center.soon);
  });
  it("อังกฤษ: ลิงก์ /en", async () => {
    h.locale = "en";
    const html = await renderHelp();
    expect(html).toContain(en.help.center.title);
    expect(html).toContain('href="/en/dota2/esta"');
    expect(html).toContain('href="/en/dota2/rules"');
  });
});

describe("h) ทางเข้าหน้าลีก", () => {
  it("ปุ่มเข้าแข่งบนแบนเนอร์ → /dota2/esta (en /en/dota2/esta)", () => {
    expect(homeSlides("th")[0].cta.href).toBe("/dota2/esta");
    expect(homeSlides("en")[0].cta.href).toBe("/en/dota2/esta");
  });
  it("ไอคอน ESTA ราวซ้าย → หน้าลีก", () => {
    expect(renderToStaticMarkup(createElement(LeftRail, { locale: "th" }))).toMatch(/title="ESTA"[^>]*href="\/dota2\/esta"/);
    expect(renderToStaticMarkup(createElement(LeftRail, { locale: "en" }))).toMatch(/title="ESTA"[^>]*href="\/en\/dota2\/esta"/);
  });
  it("หน้าใหม่ไม่ต้องล็อกอิน", async () => {
    const { needsLogin } = await import("@/lib/auth/protected-paths");
    expect(needsLogin("/dota2/esta")).toBe(false);
    expect(needsLogin("/help")).toBe(false);
    expect(localePath("en", "/help")).toBe("/en/help");
  });
});

describe("i) พจนานุกรม key ตรงกัน th/en", () => {
  const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  it("esta + help ทุก key ตรงกัน และไม่ว่าง", () => {
    expect(keys(en.esta)).toEqual(keys(th.esta));
    expect(keys(en.help)).toEqual(keys(th.help));
    for (const k of keys(en.help)) expect(k.split(".").reduce((o: never, x) => o[x], en.help as never), k).not.toBe("");
  });
});
