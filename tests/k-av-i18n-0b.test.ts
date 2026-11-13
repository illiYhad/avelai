// K-AV-I18N.0b — หน้า Home ใช้พจนานุกรม TH/EN: key ครบ · th = ข้อความเดิม · en ไม่มีอักษรไทยจากพจนานุกรม · ลิงก์ en ขึ้นต้น /en/
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { th } from "@/lib/i18n/th";
import { en } from "@/lib/i18n/en";
import { homeSlides, HOME_SLIDES } from "@/lib/home/slides";
import { tournamentTimeLabel } from "@/lib/home/time-label";
import type { HomeData } from "@/lib/home/types";

vi.mock("server-only", () => ({}));
import HomeView from "@/components/home/HomeView";

type Tree = { [k: string]: string | Tree };
const keys = (o: Tree, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)));
const values = (o: Tree): string[] => Object.values(o).flatMap((v) => (typeof v === "string" ? [v] : values(v)));
const THAI = /[฀-๿]/;

// ทัวร์/ทีมจากฐาน = ชื่อไทยได้ (ไม่แปล) · ใช้ชื่ออังกฤษในเทส en เพื่อแยกว่าอักษรไทยมาจากพจนานุกรมหรือไม่
const now = Date.parse("2026-11-08T03:00:00Z");
const data: HomeData = {
  now,
  tournaments: [
    { id: "t1", name: "Cup A", status: "RUNNING", start_at: "2026-11-08T01:00:00Z", format: "SE", best_of: 1, team_size: 5, max_teams: 16 },
    { id: "t2", name: "Cup B", status: "REGISTRATION", start_at: "2026-11-20T13:30:00Z", format: "SE", best_of: 3, team_size: 5, max_teams: null },
  ],
  activities: [],
  teams: [],
} as unknown as HomeData;
const render = (locale?: "th" | "en", d: HomeData = data) => renderToStaticMarkup(createElement(HomeView, { ...d, locale }));
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe("K-AV-I18N.0b", () => {
  it("a) พจนานุกรม home: key th/en ครบตรงกัน · ไม่มีค่าว่าง · en ไม่มีอักษรไทย", () => {
    expect(keys(en.home as unknown as Tree)).toEqual(keys(th.home as unknown as Tree));
    for (const v of values(en.home as unknown as Tree)) {
      expect(v).not.toBe("");
      expect(v, v).not.toMatch(THAI);
    }
  });

  it("b) th = ข้อความเดิม (ไม่ส่ง locale กับส่ง th ได้ HTML เดียวกัน) · Pass เดือนปฏิทิน (K-AV-HOME.PASS-SLIDE)", () => {
    expect(render("th")).toBe(render());
    expect(homeSlides("th")).toEqual(HOME_SLIDES);
    expect(HOME_SLIDES[1].body).toContain("380 บาท ต่อเดือนปฏิทิน · ใช้ได้ 1–สิ้นเดือน");
    expect(homeSlides("en")[1].body).toContain("380 THB per calendar month · valid from the 1st to month-end");
    const html = render("th");
    for (const s of ["เลือกเกม", "ทัวร์นาเมนต์สำหรับคุณ", "กิจกรรมของฉัน", "ยังไม่มีกิจกรรม", "ปาร์ตี้", "ทีมของฉัน", "เพื่อน", "ตอนนี้", "20 พ.ย. 20:30", "5v5 · 16 ช่อง", "5v5 · – ช่อง", "ดูเพิ่ม"]) expect(html).toContain(s);
  });

  it("c) en: ข้อความจากพจนานุกรมเป็นอังกฤษ · ป้ายเวลาอังกฤษ", () => {
    const html = render("en");
    for (const s of ["Choose a game", "Tournaments for you", "My activities", "No activities yet", "Party", "My teams", "Friends", "Now", "Nov 20, 20:30", "5v5 · 16 slots", "5v5 · – slots", "See more", "Buy Pass", "Join"]) expect(html).toContain(s);
    for (const v of values(th.home as unknown as Tree)) if (THAI.test(v) && v.length > 3) expect(html, v).not.toContain(v);
    expect(html).toContain('lang="en"');
  });

  it("d) en: ลิงก์ภายในทุกตัวขึ้นต้น /en/ · th ไม่มี /en", () => {
    const en_ = hrefs(render("en")).filter((h) => h.startsWith("/"));
    expect(en_.length).toBeGreaterThan(5);
    for (const h of en_) expect(h, h).toMatch(/^\/en\//);
    expect(en_).toContain("/en/dota2/tournaments/t1");
    expect(en_).toContain("/en/dota2/pass");
    for (const h of hrefs(render("th")).filter((x) => x.startsWith("/"))) expect(h.startsWith("/en")).toBe(false);
  });

  it("e) ป้ายเวลา en ทุกกรณี (เขตเวลาไทยเท่าเดิม)", () => {
    const L = (s: string, at: string | null) => tournamentTimeLabel(s, at, now, "en");
    expect(L("CHECK_IN", "2026-11-08T05:00:00Z")).toBe("Now");
    expect(L("REGISTRATION", "2026-11-08T03:30:00Z")).toBe("In 30 min");
    expect(L("REGISTRATION", "2026-11-08T12:00:00Z")).toBe("Today 19:00");
    expect(L("REGISTRATION", "2026-11-08T18:00:00Z")).toBe("Tomorrow 01:00");
    expect(L("SEEDING", "2026-11-11T21:15:00Z")).toBe("Nov 12, 04:15");
    expect(L("REGISTRATION", null)).toBe("Date TBA");
    expect(tournamentTimeLabel("SEEDING", "2026-11-20T13:30:00Z", now)).toBe("20 พ.ย. 20:30");
  });
});
