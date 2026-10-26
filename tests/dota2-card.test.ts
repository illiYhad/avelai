import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// K-AV-D2: การ์ดผู้เล่น/สรุปแมตช์ Dota 2 จาก OpenDota — ห้ามยิงเครือข่ายจริง (fetch mock)
// fixture แต่งเองเลียนโครงสร้างฟิลด์ OpenDota · ไม่มีข้อมูลบุคคลจริง

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  account: null as { external_id: string; status: string } | null,
  accountError: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: () => {
      const b = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: h.account, error: h.accountError }) };
      return b;
    },
  }),
}));

import { getMatchSummary, getPlayerCard, isValidMatchId, kda, mapMatch, mapPlayerCard, OPENDOTA_TIMEOUT_MS } from "@/lib/dota/opendota";
import { allowRequest, dotaRequestLog, DOTA_USER_LIMIT, MINUTE_MS } from "@/lib/dota/user-rate-limit";
import { GET as getMe } from "@/app/api/games/dota2/me/route";
import { GET as getMatch } from "@/app/api/games/dota2/match/[matchId]/route";

// ---------- fixture (แต่งเอง) ----------
const PROFILE = { profile: { account_id: 11111111, personaname: "TestPlayer", avatarfull: "https://example.test/a.png", steamid: "SECRET_RAW", loccountrycode: "TH" }, rank_tier: 53, mmr_estimate: { estimate: 9999 } };
const WL = { win: 30, lose: 20 };
const HEROES = [
  { hero_id: 1, games: 10, win: 6, with_games: 99, against_games: 99, last_played: 1 },
  { hero_id: "2", games: 25, win: 10 },
  { hero_id: 3, games: 0, win: 0 },
];
const RECENT = [
  { match_id: 12345678901, player_slot: 1, radiant_win: true, hero_id: 1, kills: 10, deaths: 2, assists: 5, duration: 1800, start_time: 1761000000, game_mode: 22, lobby_type: 7, secret_extra: "x" },
  { match_id: 12345678902, player_slot: 130, radiant_win: true, hero_id: 1, kills: 2, deaths: 0, assists: 3, duration: null },
  { match_id: "bad", hero_id: 9 },
];
const MATCH = {
  match_id: 12345678901, radiant_win: false, duration: 2400, game_mode: 2, lobby_type: 1, radiant_score: 20, dire_score: 35, start_time: 1761000000,
  chat: [{ key: "raw chat should never leak" }],
  picks_bans: [{ is_pick: true, hero_id: 5, team: 0, order: 1 }, { is_pick: false, hero_id: 6, team: 1, order: 0 }],
  players: [
    { account_id: 11111111, player_slot: 0, hero_id: 1, kills: 5, deaths: 5, assists: 5, last_hits: 100, denies: 5, gold_per_min: 400, xp_per_min: 500, hero_damage: 10000, tower_damage: 1000, hero_healing: 0, item_0: 1, item_1: 0, personaname: "TestPlayer", ip_address: "SECRET" },
    { player_slot: 128, hero_id: null, kills: null },
  ],
};

type Route = Record<string, { status?: number; body?: unknown; badJson?: boolean }>;
let calls: string[] = [];
let lastInit: RequestInit | undefined;
function stubFetch(routes: Route) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    lastInit = init;
    const path = url.replace("https://api.opendota.com/api", "");
    const r = routes[path] ?? { status: 404, body: {} };
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (r.badJson) throw new SyntaxError("Unexpected token <");
        return r.body;
      },
    } as Response;
  }));
}
const playerRoutes = (id: string): Route => ({
  [`/players/${id}`]: { body: PROFILE },
  [`/players/${id}/wl`]: { body: WL },
  [`/players/${id}/heroes`]: { body: HEROES },
  [`/players/${id}/recentMatches`]: { body: RECENT },
});

beforeEach(() => {
  calls = []; lastInit = undefined;
  h.user = null; h.account = null; h.accountError = null;
  dotaRequestLog.clear();
  delete process.env.OPENDOTA_API_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("map ข้อมูล OpenDota (pure)", () => {
  it("kda = (K+A)/max(D,1) · ขาดค่า = null", () => {
    expect(kda(10, 2, 5)).toBe(7.5);
    expect(kda(2, 0, 3)).toBe(5);
    expect(kda(null, 1, 1)).toBeNull();
  });

  it("การ์ดผู้เล่น: map ถูกฟิลด์ · วินเรท · ฮีโร่เรียงตามจำนวนแมตช์ · ตัดฮีโร่ 0 แมตช์ · แมตช์เพี้ยนถูกข้าม", () => {
    const c = mapPlayerCard("11111111", PROFILE, WL, HEROES, RECENT);
    expect(c).toMatchObject({ accountId: "11111111", name: "TestPlayer", avatar: "https://example.test/a.png", rankTier: 53, win: 30, lose: 20, winRate: 60 });
    expect(c.heroes.map((x) => x.heroId)).toEqual([2, 1]);
    expect(c.heroes[1]).toEqual({ heroId: 1, games: 10, win: 6, winRate: 60, recentKda: 10 }); // (10+5+2+3)/max(2,1)
    expect(c.recent).toHaveLength(2);
    expect(c.recent[0]).toMatchObject({ matchId: "12345678901", won: true, kda: 7.5 });
    expect(c.recent[1]).toMatchObject({ won: false, duration: null }); // player_slot 130 = Dire · radiant ชนะ
  });

  it("ฟิลด์ขาด/null/ผิดชนิด ไม่พัง", () => {
    const c = mapPlayerCard("1", {}, null, "x", undefined);
    expect(c).toMatchObject({ name: null, avatar: null, rankTier: null, win: null, lose: null, winRate: null, heroes: [], recent: [] });
    const m = mapMatch("12345678", { players: [{}] });
    expect(m.players[0]).toMatchObject({ name: "Anonymous", isRadiant: null, heroId: null, kda: null, items: [null, null, null, null, null, null] });
    expect(m).toMatchObject({ radiantWin: null, duration: null, picksBans: [] });
  });

  it("avatar ที่ไม่ใช่ https ไม่ถูกใช้", () => {
    expect(mapPlayerCard("1", { profile: { avatarfull: "http://x/a.png" } }, WL, [], []).avatar).toBeNull();
  });

  it("แมตช์: ผู้ชนะ · ฝั่ง · ไอเทม 0 = ว่าง · ชื่อหาย = Anonymous · pick/ban", () => {
    const m = mapMatch("12345678901", MATCH);
    expect(m).toMatchObject({ radiantWin: false, duration: 2400, gameMode: 2, lobbyType: 1, radiantScore: 20, direScore: 35 });
    expect(m.players[0]).toMatchObject({ name: "TestPlayer", isRadiant: true, kda: 2, lastHits: 100, gpm: 400, items: [1, null, null, null, null, null] });
    expect(m.players[1]).toMatchObject({ name: "Anonymous", isRadiant: false, kills: null });
    expect(m.picksBans).toEqual([{ isPick: true, heroId: 5, team: 0, order: 1 }, { isPick: false, heroId: 6, team: 1, order: 0 }]);
  });

  it("ไม่มีฟิลด์ดิบที่ไม่ได้ map หลุดออก", () => {
    const card = JSON.stringify(mapPlayerCard("11111111", PROFILE, WL, HEROES, RECENT));
    const match = JSON.stringify(mapMatch("12345678901", MATCH));
    for (const leak of ["SECRET_RAW", "steamid", "loccountrycode", "mmr_estimate", "with_games", "secret_extra", "last_played"]) expect(card).not.toContain(leak);
    for (const leak of ["SECRET", "ip_address", "chat", "raw chat", "account_id"]) expect(match).not.toContain(leak);
  });

  it("matchId ต้องเป็นตัวเลข 8–12 หลัก", () => {
    expect(isValidMatchId("12345678")).toBe(true);
    expect(isValidMatchId("123456789012")).toBe(true);
    for (const bad of ["abc", "1234567", "1234567890123", "12345678a", " 12345678", "", undefined]) expect(isValidMatchId(bad)).toBe(false);
  });
});

describe("เรียก OpenDota (fetch mock)", () => {
  it("สำเร็จ → การ์ดที่ map แล้ว · key อยู่ใน header ไม่อยู่ใน URL", async () => {
    process.env.OPENDOTA_API_KEY = "test-key-123";
    stubFetch(playerRoutes("11111111"));
    const r = await getPlayerCard("11111111");
    expect(r.ok).toBe(true);
    expect(calls.every((u) => !u.includes("test-key-123") && !u.includes("api_key"))).toBe(true);
    expect((lastInit?.headers as Record<string, string>).Authorization).toBe("Bearer test-key-123");
  });

  it("404 → ข้อความไทย", async () => {
    stubFetch({});
    expect(await getPlayerCard("11111111")).toMatchObject({ ok: false, status: 404 });
  });

  it("200 แต่ไม่มี profile → 404 (บัญชีไม่เปิดข้อมูล)", async () => {
    stubFetch({ ...playerRoutes("11111111"), "/players/11111111": { body: { profile: null } } });
    expect(await getPlayerCard("11111111")).toMatchObject({ ok: false, status: 404 });
  });

  it("429 → ลองใหม่ภายหลัง", async () => {
    stubFetch({ ...playerRoutes("11111111"), "/players/11111111/wl": { status: 429 } });
    const r = await getPlayerCard("11111111");
    expect(r).toMatchObject({ ok: false, status: 429 });
    expect(!r.ok && r.message).toContain("ลองใหม่ภายหลัง");
  });

  it("JSON เพี้ยน → 502 ไม่สะท้อนข้อความดิบ", async () => {
    stubFetch({ "/matches/12345678901": { badJson: true } });
    const r = await getMatchSummary("12345678901");
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(JSON.stringify(r)).not.toContain("Unexpected token");
  });

  it(`timeout ${OPENDOTA_TIMEOUT_MS / 1000} วินาที → 504`, async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: RequestInit) => new Promise((_ok, bad) => {
      init?.signal?.addEventListener("abort", () => bad(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })));
    const pending = getMatchSummary("12345678901");
    await vi.advanceTimersByTimeAsync(OPENDOTA_TIMEOUT_MS);
    expect(await pending).toMatchObject({ ok: false, status: 504 });
  });
});

describe("GET /api/games/dota2/me", () => {
  it("ไม่ล็อกอิน → 401 · ไม่เรียก OpenDota", async () => {
    stubFetch(playerRoutes("11111111"));
    expect((await getMe()).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("ยังไม่ผูกบัญชี → 404 พร้อมบอกให้ไปผูกที่ /me", async () => {
    h.user = { id: "u1" };
    stubFetch({});
    const res = await getMe();
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("/me");
    expect(calls).toHaveLength(0);
  });

  it("ดึงเฉพาะ ID ที่ผู้ใช้ผูกเอง · response มีแค่ฟิลด์ที่ map แล้ว", async () => {
    h.user = { id: "u1" };
    h.account = { external_id: "11111111", status: "UNVERIFIED" };
    stubFetch(playerRoutes("11111111"));
    const res = await getMe();
    expect(res.status).toBe(200);
    expect(calls.every((u) => u.includes("/players/11111111"))).toBe(true);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["player", "verified"]);
    expect(body.verified).toBe(false);
    expect(Object.keys(body.player).sort()).toEqual(["accountId", "avatar", "heroes", "lose", "name", "rankTier", "recent", "win", "winRate"]);
    expect(JSON.stringify(body)).not.toMatch(/SECRET|steamid|mmr_estimate/);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it(`เพดาน ${DOTA_USER_LIMIT} ครั้ง/นาที ต่อผู้ใช้ → 429`, async () => {
    h.user = { id: "u1" };
    h.account = { external_id: "11111111", status: "UNVERIFIED" };
    stubFetch(playerRoutes("11111111"));
    for (let i = 0; i < DOTA_USER_LIMIT; i++) expect((await getMe()).status).toBe(200);
    expect((await getMe()).status).toBe(429);
  });
});

describe("GET /api/games/dota2/match/[matchId]", () => {
  const call = (id: string) => getMatch(new Request(`http://x/api/games/dota2/match/${id}`), { params: Promise.resolve({ matchId: id }) });

  it("ไม่ล็อกอิน → 401", async () => {
    stubFetch({});
    expect((await call("12345678901")).status).toBe(401);
  });

  it.each(["abc", "1234567", "1234567890123", "12345678%2F"])("matchId ไม่ผ่าน (%s) → 400 · ไม่เรียก OpenDota", async (id) => {
    h.user = { id: "u1" };
    stubFetch({});
    expect((await call(id)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("ปกติ → 200 · มีแค่ข้อมูลที่ map", async () => {
    h.user = { id: "u1" };
    stubFetch({ "/matches/12345678901": { body: MATCH } });
    const res = await call("12345678901");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["match"]);
    expect(JSON.stringify(body)).not.toMatch(/SECRET|ip_address|raw chat/);
  });
});

describe("เพดานเรียกต่อผู้ใช้ (pure)", () => {
  it("ครบเพดานแล้วปฏิเสธ · พ้นหน้าต่าง 1 นาทีเรียกได้อีก · แยกตามผู้ใช้", () => {
    const log = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) expect(allowRequest(log, "a", 1000 + i, 3)).toBe(true);
    expect(allowRequest(log, "a", 1005, 3)).toBe(false);
    expect(allowRequest(log, "b", 1005, 3)).toBe(true);
    expect(allowRequest(log, "a", 1000 + MINUTE_MS + 10, 3)).toBe(true);
  });
});
