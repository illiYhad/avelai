import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// K-AV-PASSDOTA.1: getPlayerCard นับทุกประเภทแมตช์ (significant=0) · ห้ามยิงเครือข่ายจริง (fetch mock)
// fixture แต่งเอง ไม่มีข้อมูลบุคคลจริง

vi.mock("server-only", () => ({}));
vi.mock("next/cache", async () => (await import("./_fake-next-cache")).fakeNextCache);

import { noteQuotaExceeded, resetQuotaState } from "@/lib/dota/quota";
import { fakeCacheStore } from "./_fake-next-cache";
import { DOTA_STATS_SOURCE_LABEL, getPlayerCard, mapRecentMatch } from "@/lib/dota/opendota";

const BASE = "https://api.opendota.com/api";
const ID = "22222222";
const PROFILE = { profile: { account_id: 22222222, personaname: "Tester" } };
const WL = { win: 3, lose: 2 };
const HEROES = [{ hero_id: 1, games: 5, win: 3 }];
// lobby 4 / 12 / 14 = ประเภทที่ OpenDota กรองออกเมื่อไม่ส่ง significant=0 (ตามใบ) → ต้องไม่ถูกทิ้ง · 7 = ranked ไว้เทียบ
const MATCHES = [4, 12, 14, 7].map((lobby, i) => ({
  match_id: 12345678900 + i, player_slot: 0, radiant_win: true, duration: 1200, start_time: 1761000000 + i,
  game_mode: 22, lobby_type: lobby, hero_id: 1, kills: 1, deaths: 1, assists: 1,
}));

let calls: string[] = [];
function stub(profile: unknown = PROFILE) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    const path = new URL(url).pathname.replace("/api", "");
    const body = path === `/players/${ID}` ? profile
      : path.endsWith("/wl") ? WL
      : path.endsWith("/heroes") ? HEROES
      : path.endsWith("/matches") ? MATCHES
      : null;
    const status = body === null ? 404 : 200;
    return { ok: status === 200, status, json: async () => body } as Response;
  }));
}
const urlOf = (suffix: string) => {
  const u = calls.map((c) => new URL(c)).find((x) => x.pathname === `/api/players/${ID}${suffix}`);
  if (!u) throw new Error(`no call to ${suffix}`);
  return u;
};

beforeEach(() => {
  resetQuotaState();
  fakeCacheStore.clear();
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("K-AV-PASSDOTA.1 · significant=0", () => {
  it("a) wl / heroes / matches มี significant=0 ทุกตัว · ไม่เรียก /recentMatches · โปรไฟล์ไม่ใส่", async () => {
    stub();
    await getPlayerCard(ID);
    for (const s of ["/wl", "/heroes", "/matches"]) expect(urlOf(s).searchParams.get("significant")).toBe("0");
    expect(calls.some((c) => c.includes("recentMatches"))).toBe(false);
    expect(urlOf("").search).toBe("");
  });

  it("b) matches มี limit=20 และ project=lobby_type", async () => {
    stub();
    await getPlayerCard(ID);
    const u = urlOf("/matches");
    expect(u.searchParams.get("limit")).toBe("20");
    expect(u.searchParams.getAll("project")).toContain("lobby_type");
  });

  it("c) แมตช์ lobby 4 / 12 / 14 ผ่าน map ครบ · lobbyType ตรงค่าเดิม", async () => {
    stub();
    const r = await getPlayerCard(ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.recent.map((m) => m.lobbyType)).toEqual([4, 12, 14, 7]);
    for (const lobby of [4, 12, 14]) expect(mapRecentMatch({ match_id: 1, lobby_type: lobby })?.lobbyType).toBe(lobby);
  });

  it("d) getPlayerCard เรียก fetch 4 ครั้งพอดี", async () => {
    stub();
    await getPlayerCard(ID);
    expect(calls).toHaveLength(4);
    expect(calls.every((c) => c.startsWith(BASE))).toBe(true);
  });

  it("e) โหมดประหยัดโควตาเปิด → 429 ข้อความเดิม · ไม่ยิง fetch", async () => {
    stub();
    noteQuotaExceeded(Date.now());
    const r = await getPlayerCard(ID);
    expect(r).toMatchObject({ ok: false, status: 429, message: "ข้อมูลแมตช์ใหม่จะอัปเดตอีกครั้งพรุ่งนี้" });
    expect(calls).toHaveLength(0);
  });

  it("f) โปรไฟล์ปิด (ไม่มี profile) → 404 ข้อความเดิม", async () => {
    stub({ profile: null });
    const r = await getPlayerCard(ID);
    expect(r).toMatchObject({ ok: false, status: 404, message: "ไม่พบข้อมูล หรือผู้เล่นไม่ได้เปิดข้อมูลสาธารณะใน Dota 2" });
  });

  it("ป้ายแหล่งข้อมูลตามคำตัดสินพี่ศิลา Q1", () => {
    expect(DOTA_STATS_SOURCE_LABEL).toBe("สถิติ Public Match จาก OpenDota (รวมทุกประเภทแมตช์ · significant=0) · ไม่นำมาคำนวณ ELO");
  });
});
