import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-D3: เส้นทางของหน้าแมตช์ Dota 2 — เกมอื่น 404 · หน้าเก่า redirect ถาวร
// ไม่ยิงเครือข่าย: ทุกเคสในไฟล์นี้หยุดก่อนถึงขั้นดึงข้อมูล

class NotFound extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
class Redirect extends Error {
  constructor(public to: string, public permanent: boolean) {
    super("NEXT_REDIRECT");
  }
}

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound();
  },
  permanentRedirect: (to: string) => {
    throw new Redirect(to, true);
  },
  redirect: (to: string) => {
    throw new Redirect(to, false);
  },
}));

const headerStore = { fwd: "203.0.113.1" };
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => (n === "x-forwarded-for" ? headerStore.fwd : null) }),
}));

import MatchStatsLayout from "@/app/[game]/stats/matches/[matchId]/layout";
import OverviewPage from "@/app/[game]/stats/matches/[matchId]/page";
import LegacyMatchPage from "@/app/match/[matchId]/page";
import LegacyMyMatchPage from "@/app/me/dota/match/[matchId]/page";
import { MATCH_TABS, matchTabPath } from "@/app/[game]/stats/matches/[matchId]/tabs";
import { publicMatchIpLog } from "@/lib/dota/ip-rate-limit";

const MATCH_ID = "8214277203";
const layout = (game: string, matchId: string) =>
  MatchStatsLayout({ children: null, params: Promise.resolve({ game, matchId }) });

beforeEach(() => {
  publicMatchIpLog.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("เทสนี้ต้องไม่ยิงเครือข่าย");
    }),
  );
});

describe("เกมอื่นต้อง 404", () => {
  it("/mlbb/stats/matches/[id] = 404 ทั้ง layout และ page", async () => {
    await expect(layout("mlbb", MATCH_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(OverviewPage({ params: Promise.resolve({ game: "mlbb", matchId: MATCH_ID }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("slug แปลก ๆ ก็ 404", async () => {
    for (const g of ["dota", "DOTA2", "csgo", ""]) {
      await expect(layout(g, MATCH_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });

  it("matchId ไม่ถูกต้อง = 404 (ไม่ยิงเครือข่าย)", async () => {
    for (const bad of ["abc", "123", "1".repeat(13), "8214277203x"]) {
      await expect(layout("dota2", bad)).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });
});

describe("หน้าเก่า redirect ถาวรไปหน้าใหม่", () => {
  const grab = async (fn: Promise<unknown>) => {
    try {
      await fn;
      return null;
    } catch (e) {
      return e as Redirect | NotFound;
    }
  };

  it("/match/[matchId] เลขถูก = redirect ถาวร", async () => {
    const e = (await grab(LegacyMatchPage({ params: Promise.resolve({ matchId: MATCH_ID }) }))) as Redirect;
    expect(e.message).toBe("NEXT_REDIRECT");
    expect(e.to).toBe(`/dota2/stats/matches/${MATCH_ID}`);
    expect(e.permanent).toBe(true);
  });

  it("/match/[matchId] เลขผิด = 404 ไม่ redirect มั่ว", async () => {
    for (const bad of ["match_01", "abc", "1"]) {
      await expect(LegacyMatchPage({ params: Promise.resolve({ matchId: bad }) })).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });

  it("/me/dota/match/[matchId] = redirect ถาวรไปหน้าเดียวกัน", async () => {
    const e = (await grab(LegacyMyMatchPage({ params: Promise.resolve({ matchId: MATCH_ID }) }))) as Redirect;
    expect(e.to).toBe(`/dota2/stats/matches/${MATCH_ID}`);
    expect(e.permanent).toBe(true);
  });
});

describe("แท็บ", () => {
  it("มี 11 แท็บตามลำดับในใบ และ Overview เป็นหน้าแรก", () => {
    expect(MATCH_TABS.map((t) => t.label)).toEqual([
      "Overview", "Builds", "Lanes", "Combat", "Kills", "Farm", "Objectives", "Runes", "Vision", "Log", "Chat",
    ]);
    expect(MATCH_TABS[0].slug).toBe("");
    expect(MATCH_TABS.filter((t) => t.ready).map((t) => t.label)).toEqual(["Overview", "Builds", "Lanes", "Combat", "Kills", "Farm"]); // K-AV-D4 เปิด Combat · K-AV-D5 เปิดชุด B
  });

  it("ทุกแท็บลิงก์ตรงได้ และมีไฟล์เส้นทางจริง", async () => {
    const { existsSync } = await import("node:fs");
    expect(matchTabPath(MATCH_ID, "")).toBe(`/dota2/stats/matches/${MATCH_ID}`);
    expect(matchTabPath(MATCH_ID, "chat")).toBe(`/dota2/stats/matches/${MATCH_ID}/chat`);
    const base = "app/[game]/stats/matches/[matchId]";
    for (const t of MATCH_TABS) {
      const file = t.slug ? `${base}/${t.slug}/page.tsx` : `${base}/page.tsx`;
      expect(existsSync(file), `ขาดไฟล์ ${file}`).toBe(true);
    }
  });

  it("แท็บที่ยังไม่เปิดไม่มีข้อมูลจำลองในไฟล์", async () => {
    const { readFileSync } = await import("node:fs");
    const base = "app/[game]/stats/matches/[matchId]";
    for (const t of MATCH_TABS.filter((x) => x.slug && !x.ready)) { // K-AV-D4 · K-AV-D5: แท็บที่เปิดแล้วมีเทสของตัวเอง
      const src = readFileSync(`${base}/${t.slug}/page.tsx`, "utf8");
      expect(src).toContain("NotReadyTab");
      expect(src).not.toMatch(/\d{3,}/); // ไม่มีตัวเลขข้อมูลปลอมหลงอยู่
    }
  });
});

describe("เพดานต่อ IP บนหน้าสาธารณะ", () => {
  it("เกิน 30 ครั้งต่อนาที = แสดงข้อความให้รอ ไม่ไปดึงข้อมูล", async () => {
    // 30 ครั้งแรกจะพยายามดึงข้อมูล (fetch ของเทสนี้โยน error) — สนใจเฉพาะครั้งที่ 31
    for (let i = 0; i < 30; i++) {
      await layout("dota2", MATCH_ID).catch(() => {});
    }
    const el = (await layout("dota2", MATCH_ID)) as { props: unknown };
    expect(JSON.stringify(el)).toContain("เปิดหน้านี้บ่อยเกินไป");
  });
});
