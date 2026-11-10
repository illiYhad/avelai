import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tournamentTimeLabel } from "@/lib/home/time-label";
import { HOME_SLIDES } from "@/lib/home/slides";
import type { HomeData } from "@/lib/home/types";

// K-AV-HOME.1 (+1a): หน้าแรกของคนล็อกอิน — ไม่ใช้ env · ไม่ต่อเน็ต

const h = vi.hoisted(() => ({ user: null as { id: string } | null, dbOff: false }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
}));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => (h.dbOff ? null : { auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));

import HomePage from "@/app/page";
import HomeView from "@/components/home/HomeView";

const root = join(__dirname, "..");

// ---------- a) time-label ----------
describe("a) ป้ายเวลา (เวลาไทย)", () => {
  // now = 2026-11-08 10:00 เวลาไทย (03:00Z)
  const now = Date.parse("2026-11-08T03:00:00Z");
  const cases: [string, string, string | null, string][] = [
    ["RUNNING", "RUNNING", "2026-11-01T00:00:00Z", "ตอนนี้"],
    ["CHECK_IN", "CHECK_IN", "2026-11-08T05:00:00Z", "ตอนนี้"],
    ["อีก 30 นาที", "REGISTRATION", "2026-11-08T03:30:00Z", "อีก 30 นาที"],
    ["วันนี้ (เกิน 60 นาที)", "REGISTRATION", "2026-11-08T12:00:00Z", "วันนี้ 19:00"],
    ["พรุ่งนี้ (ข้ามเที่ยงคืนไทย)", "REGISTRATION", "2026-11-08T18:00:00Z", "พรุ่งนี้ 01:00"],
    ["ไกล", "SEEDING", "2026-11-20T13:30:00Z", "20 พ.ย. 20:30"],
    ["null", "REGISTRATION", null, "ยังไม่กำหนดวัน"],
    ["อีก 60 นาทีพอดี", "REGISTRATION", "2026-11-08T04:00:00Z", "อีก 60 นาที"],
    ["คืนนี้ 23:59 ไทย ยังเป็นวันนี้", "REGISTRATION", "2026-11-08T16:59:00Z", "วันนี้ 23:59"],
  ];
  for (const [name, status, start, want] of cases) {
    it(name, () => expect(tournamentTimeLabel(status, start, now)).toBe(want));
  }
});

// ---------- b) slides ----------
describe("b) แบนเนอร์ 2 สไลด์", () => {
  it("มี 2 สไลด์ · ปุ่มและลิงก์ถูก", () => {
    expect(HOME_SLIDES).toHaveLength(2);
    expect(HOME_SLIDES[0].cta).toEqual({ label: "เข้าแข่ง", href: "/dota2/tournaments" });
    expect(HOME_SLIDES[1].cta).toEqual({ label: "ซื้อ Pass", href: "/dota2/pass" });
  });

  it("ประโยคตรงกับไฟล์ต้นแบบ REF_ultimate_solo :122 / :457 (สไลด์ 2 แก้ระยะ Pass ตามซอง 022)", () => {
    // ต้นแบบ D:\Balehm_Studio\02_Products\AVELAi\01_Spec\REF_ultimate_solo_อัปเดต_2026-11-07.html (นอก repo → เทียบค่าคงที่)
    expect(HOME_SLIDES[0].title).toBe("AVELAi : ULTIMATE SOLO");
    expect(HOME_SLIDES[0].eyebrow).toBe("// PRECISION IS FREEDOM");
    expect(HOME_SLIDES[0].body).toBe("สุ่มทีมทุกรอบ ถ่วงน้ำหนักคะแนนสมบูรณ์แบบ");
    expect(HOME_SLIDES[1].title).toBe("ARENA PASS");
    expect(HOME_SLIDES[1].body).toBe(
      "Arena Pass 380 บาท / 28 วัน (4 สัปดาห์) → 75% เข้ากองรางวัล (285 บาท/คน) · แบ่ง รายวัน 40% · Weekend 35% · Season/รายเดือน 25%",
    );
    expect(HOME_SLIDES[1].body).not.toContain("บาท/เดือน");
  });

  it("(1b) รูป: สไลด์ 1 = AVELAi · สไลด์ ARENA PASS = AVEL (ทอง) ไม่ใช่ AVE · public มีแค่ 2 รูปนี้", () => {
    expect(HOME_SLIDES[0].image.src).toBe("/brand/home/avelai-full-640.png");
    expect(HOME_SLIDES[1].image.src).toBe("/brand/home/avel-half-480.png");
    expect(HOME_SLIDES[1].glow).toBe("gold");
    expect(readdirSync(join(root, "public", "brand", "home")).sort()).toEqual(["avel-half-480.png", "avelai-full-640.png"]);
  });
});

// ---------- c) HomeView ----------
const sample: HomeData = {
  now: Date.parse("2026-11-08T03:00:00Z"),
  tournaments: [
    { id: "t1", name: "ESTA Daily #1", status: "RUNNING", format: "SWISS", best_of: 1, team_size: 5, max_teams: 16, start_at: "2026-11-08T02:00:00Z" },
    { id: "t2", name: "ESTA Daily #2", status: "REGISTRATION", format: "SE", best_of: 3, team_size: 5, max_teams: null, start_at: "2026-11-08T03:30:00Z" },
    { id: "t3", name: "ESTA Weekend", status: "REGISTRATION", format: "DE", best_of: 3, team_size: 5, max_teams: 32, start_at: "2026-11-08T18:00:00Z" },
  ],
  activities: [],
  teams: [],
};
const render = (d: HomeData) => renderToStaticMarkup(createElement(HomeView, d));

describe("c) HomeView", () => {
  const html = render(sample);

  it("ลำดับ แบนเนอร์ → การ์ดเกม → ทัวร์สำหรับคุณ", () => {
    const b = html.indexOf('data-section="banner"');
    const g = html.indexOf('data-section="games"');
    const t = html.indexOf('data-section="for-you"');
    expect(b).toBeGreaterThan(-1);
    expect(g).toBeGreaterThan(b);
    expect(t).toBeGreaterThan(g);
  });

  it("SSR แสดงสไลด์ 1 · สไลด์ 2 ซ่อน", () => {
    expect(html).toMatch(/data-slide="ultimate-solo" aria-roledescription="slide" aria-label="[^"]*" aria-hidden="false"/);
    expect(html).toMatch(/data-slide="arena-pass"[^>]*aria-hidden="true"[^>]*inert=""/);
  });

  it("การ์ด MLBB มี 'เร็ว ๆ นี้' และไม่มี href · Dota 2 ลิงก์ /dota2/tournaments", () => {
    const mlbb = html.split('data-game="mlbb"')[1].split("</li>")[0];
    expect(mlbb).toContain("เร็ว ๆ นี้");
    expect(mlbb).not.toContain("href=");
    expect(html).toMatch(/<a data-game="dota2"[^>]*href="\/dota2\/tournaments"/);
  });

  it("ทัวร์ 3 ใบลิงก์ถูก + ป้ายเวลา + ช่อง", () => {
    for (const id of ["t1", "t2", "t3"]) expect(html).toMatch(new RegExp(`<a data-tournament="${id}"[^>]*href="/dota2/tournaments/${id}"`));
    expect(html).toContain("ตอนนี้");
    expect(html).toContain("อีก 30 นาที");
    expect(html).toContain("พรุ่งนี้ 01:00");
    expect(html).toContain("5v5 · – ช่อง");
    expect(html).toMatch(/href="\/dota2\/tournaments"[^>]*>ดูเพิ่ม</);
  });

  it("K-AV-HOME.1d: การ์ดทัวร์ไม่มี 'ยืนยัน X ทีม' (RLS ตัดแถว = 0 ไม่จริง) · มีช่องจริง", () => {
    const cards = html.split('data-section="for-you"')[1];
    expect(cards).not.toContain("ยืนยัน");
    expect(cards).not.toMatch(/\d+\s*ทีม/);
    expect(cards).toContain("5v5 · 16 ช่อง");
    expect(cards).toContain("5v5 · 32 ช่อง");
  });

  it("K-AV-HOME.1d: <main> เว้นล่าง ≥ 88px บนจอ < 768px (pb-24 = 96px) ให้ปุ่ม AVE ไม่ทับ", () => {
    const main = html.match(/<main[^>]*data-home-main[^>]*>/)?.[0] ?? "";
    expect(main).toMatch(/\bpb-24\b/);
    expect(main).toMatch(/\bmd:pb-6\b/);
  });

  it("K-AV-HOME.1d: loadTournamentsForYou ไม่อ่าน registrations (คำขอเดียว)", () => {
    const src = readFileSync(join(__dirname, "..", "lib", "home", "load.ts"), "utf8");
    const fn = src.split("export async function loadTournamentsForYou")[1].split(/\r?\n\}\r?\n/)[0];
    expect(fn).not.toContain('from("registrations")');
    expect(fn.match(/\.from\(/g)).toHaveLength(1);
  });

  it("กล่องว่างทุกกล่องมีปุ่ม (กิจกรรม · ปาร์ตี้ · ทีม · เพื่อน)", () => {
    for (const box of ["activities", "party", "teams", "friends"]) {
      const seg = html.split(`data-box="${box}"`)[1].split("</section>")[0];
      expect(seg, box).toContain("data-empty");
      expect(seg, box).toMatch(/<(a|button)\b/);
    }
    expect(html).toMatch(/href="\/dota2\/tournaments"[^>]*>หาทัวร์</);
    expect(html).toMatch(/href="\/dota2\/teams\/create"[^>]*>สร้างทีม</);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>สร้างปาร์ตี้</);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>เพิ่มเพื่อน</);
  });

  it("ไม่มีทัวร์ = ข้อความว่าง + ปุ่มดูทัวร์ทั้งหมด", () => {
    const empty = render({ ...sample, tournaments: [] });
    expect(empty).toContain("ยังไม่มีทัวร์ที่เปิดรับ");
    expect(empty).toMatch(/href="\/dota2\/tournaments"[^>]*>ดูทัวร์ทั้งหมด</);
  });

  it("มีกิจกรรม/ทีม → ลิงก์ถูก", () => {
    const full = render({
      ...sample,
      activities: [{ id: "a1", name: "My Cup", status: "REGISTRATION", start_at: null, game: "dota2" }],
      teams: [{ id: "tm1", name: "Team One", tag: "ONE" }],
    });
    expect(full).toContain('href="/dota2/tournaments/a1"');
    expect(full).toContain('href="/dota2/teams/tm1"');
  });

  it("บันทึกผลเรนเดอร์ลง _checks (ถ้ามีโฟลเดอร์กล่อง)", () => {
    const dir = "D:\\Balehm_Studio\\03_Mailbox\\04_ACTIVE_THREAD\\_checks\\k-av-home-1";
    if (!existsSync("D:\\Balehm_Studio\\03_Mailbox\\04_ACTIVE_THREAD\\_checks")) return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "home-render.html"), `<!doctype html><meta charset="utf-8"><title>K-AV-HOME.1 render</title>\n${html}\n`);
    expect(existsSync(join(dir, "home-render.html"))).toBe(true);
  });
});

// ---------- d) app/page.tsx ----------
async function target(): Promise<string | null> {
  try {
    await HomePage();
  } catch (e) {
    const m = /^REDIRECT:(.+)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
  return null;
}

describe("d) หน้า / ", () => {
  beforeEach(() => { h.user = null; h.dbOff = false; });
  it("db null → /login", async () => { h.dbOff = true; expect(await target()).toBe("/login"); });
  it("ไม่ล็อกอิน → /login", async () => { expect(await target()).toBe("/login"); });
  it("ล็อกอิน → ไม่ redirect · อ่านพลาดทุกก้อน (mock ไม่มี .from) = หน้าว่างไม่ล้ม", async () => {
    h.user = { id: "u1" };
    expect(await target()).toBeNull();
    const el = await HomePage();
    const props = (el as { props: HomeData }).props;
    expect(props.tournaments).toEqual([]);
    expect(props.activities).toEqual([]);
    expect(props.teams).toEqual([]);
  });
});

// ---------- e) แหล่งไฟล์ ----------
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("e) ไฟล์ใต้ components/home · lib/home", () => {
  const files = [...walk(join(root, "components", "home")), ...walk(join(root, "lib", "home"))];

  it("ไม่มี <img · fetch( · localStorage", () => {
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/<img\b/);
      expect(t, f).not.toContain("fetch(");
      expect(t, f).not.toContain("localStorage");
    }
  });

  it("src รูปทุกตัวขึ้นต้น /brand/home/ และไฟล์มีจริง", () => {
    const srcs = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/src:\s*"([^"]+)"/g)].map((m) => m[1]));
    expect(srcs.length).toBeGreaterThanOrEqual(2);
    for (const s of srcs) {
      expect(s).toMatch(/^\/brand\/home\//);
      expect(existsSync(join(root, "public", s)), s).toBe(true);
    }
  });

  it("(1a) width/height ที่ส่งให้ next/image = สัดส่วนไฟล์จริง ±0.01", () => {
    for (const s of HOME_SLIDES) {
      const buf = readFileSync(join(root, "public", s.image.src));
      // PNG IHDR: width @16 · height @20 (big-endian)
      const w = buf.readUInt32BE(16);
      const hh = buf.readUInt32BE(20);
      expect(Math.abs(s.image.width / s.image.height - w / hh), s.image.src).toBeLessThanOrEqual(0.01);
      expect([s.image.width, s.image.height]).toEqual([w, hh]);
    }
  });
});
