import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import TournamentHub from "@/components/tournament/TournamentHub";

// K-AV-HUB.1: หน้าทัวร์เก่า (daily · weekly · monthly) อยู่ใน Hub และใช้ CI กลาง
// เปลี่ยนแค่ชั้นแสดงผล — import / query / การเขียนข้อมูล / เส้นทาง ต้องเหมือนเดิม

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const PAGES = {
  daily: "app/tournament/daily/page.tsx",
  lobby: "app/tournament/daily/lobby/[lobbyId]/page.tsx",
  weekly: "app/tournament/weekly/page.tsx",
  monthly: "app/tournament/monthly/page.tsx",
} as const;

// import ที่มีอยู่ก่อนใบนี้ (main 91b2f57) — ห้ามเพิ่ม/ลด
const IMPORTS: Record<keyof typeof PAGES, string[]> = {
  daily: ["react", "next/navigation", "@/lib/supabase/client", "@/lib/matchmaking/dailyArenaTierEngine", "@/components/ui/HudScan"],
  lobby: ["react", "next/navigation", "@/lib/supabase/client", "@/lib/matchmaking/dailyArenaTierEngine", "@/components/ui/HudScan"],
  weekly: ["react"],
  monthly: ["react", "@/components/ui/HudScan"],
};

const importsOf = (src: string) =>
  [...src.matchAll(/^import[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe("K-AV-HUB.1 Hub links", () => {
  it("Hub มีลิงก์ไป /tournament/daily · weekly · monthly ครบ", () => {
    const out = renderToStaticMarkup(createElement(TournamentHub, { viewer: null, showLinkGame: false }));
    for (const href of ["/tournament/daily", "/tournament/weekly", "/tournament/monthly"]) {
      expect(out).toContain(`href="${href}"`);
    }
  });
});

describe("K-AV-HUB.1 old pages kept, display-only change", () => {
  it("4 หน้าเก่ายังอยู่", () => {
    for (const p of Object.values(PAGES)) expect(existsSync(join(root, p)), p).toBe(true);
  });

  it("ไม่มี import ใหม่ในหน้าเก่า", () => {
    for (const [k, p] of Object.entries(PAGES) as [keyof typeof PAGES, string][]) {
      const got = importsOf(read(p));
      for (const want of IMPORTS[k]) expect(got.some((g) => g === want || g.startsWith(want)), `${p} ${want}`).toBe(true);
      expect(got.length, p).toBe(IMPORTS[k].length);
    }
  });

  it("query / การเขียน / เส้นทางเดิมยังอยู่ครบ (ไม่แตะตรรกะ)", () => {
    const daily = read(PAGES.daily);
    for (const s of [".from('users')", ".from('daily_arena_match_results')", ".from('daily_arena_leaderboard')", "router.push(`/waiting-room/${data.lobbyId}`)"]) {
      expect(daily).toContain(s);
    }
    const lobby = read(PAGES.lobby);
    for (const s of [".from('daily_arena_lobbies')", ".update({ status: 'starting' })", "router.push(`/match/${formation.matchId}`)", "router.push('/tournament/daily')"]) {
      expect(lobby).toContain(s);
    }
  });

  it("ไม่เหลือสีฮาร์ดโค้ดชุดเก่า (gray/slate/amber · พื้น #090D14 #0D1117 #161B22)", () => {
    for (const p of Object.values(PAGES)) {
      const src = read(p);
      expect(src, p).not.toMatch(/\b(text|bg|border|divide)-(gray|slate|amber)-\d{2,3}\b/);
      expect(src, p).not.toMatch(/#090D14|#0D1117|#161B22/i);
    }
  });
});
