import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// K-AV-D3: หน้าแมตช์ Dota 2 สาธารณะ + API ขอวิเคราะห์ — ห้ามยิงเครือข่ายจริง (fetch mock)
// fixture แต่งเองเลียนโครงฟิลด์ OpenDota · ไม่มีข้อมูลบุคคลจริง

const h = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", async () => (await import("./_fake-next-cache")).fakeNextCache); // K-AV-QUOTA.1
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));

import { mapMatchDetail, regionLabel } from "@/lib/dota/match/map";
import { resetQuotaState } from "@/lib/dota/quota";
import { fakeCacheStore } from "./_fake-next-cache";
import {
  clearParsedCache,
  getDotaConstant,
  getMatchDetail,
  isDotaConstant,
  DOTA_CONSTANTS,
  PARSED_TTL_MS,
  UNPARSED_REVALIDATE_SEC,
} from "@/lib/dota/match";
import {
  DOTA_PARSE_LIMIT,
  PARSE_DEDUPE_MS,
  findRecentParse,
  isValidJobId,
  parseRejectMessage,
  parseRequestLog,
  readJobId,
  rememberParse,
} from "@/lib/dota/match/parse";
import { allowIp, clientIpFrom, ipBucket, ipKey, publicMatchIpLog, pruneIpLog, resetPruneClock, DOTA_PUBLIC_IP_LIMIT, IP_LOG_MAX_KEYS } from "@/lib/dota/ip-rate-limit";
import { POST as parsePost, dotaParseLog } from "@/app/api/games/dota2/parse/[matchId]/route";

const MATCH_ID = "8214277203";

const player = (slot: number, extra: Record<string, unknown> = {}) => ({
  account_id: 1000 + slot,
  personaname: `P${slot}`,
  player_slot: slot,
  hero_id: 10 + slot,
  kills: 5,
  deaths: 2,
  assists: 7,
  last_hits: 150,
  denies: 10,
  gold_per_min: 500,
  xp_per_min: 600,
  hero_damage: 20000,
  tower_damage: 3000,
  hero_healing: 100,
  level: 25,
  net_worth: 18000,
  item_0: 1,
  item_1: 0,
  item_neutral: 0,
  aghanims_scepter: 1,
  aghanims_shard: 0,
  ...extra,
});

const rawMatch = (over: Record<string, unknown> = {}) => ({
  match_id: Number(MATCH_ID),
  radiant_win: true,
  duration: 2533,
  start_time: 1762000000,
  game_mode: 22,
  lobby_type: 7,
  region: 5,
  radiant_score: 47,
  dire_score: 43,
  players: [player(0), player(128)],
  picks_bans: [{ is_pick: true, hero_id: 14, team: 0, order: 0 }],
  od_data: { has_parsed: true },
  ...over,
});

function mockFetch(handler: (url: string, init?: RequestInit) => { status?: number; body?: unknown; throws?: unknown }) {
  return vi.fn(async (url: unknown, init?: RequestInit) => {
    const r = handler(String(url), init);
    if (r.throws) throw r.throws;
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body,
    } as unknown as Response;
  });
}

beforeEach(() => {
  h.user = null;
  resetQuotaState();
  fakeCacheStore.clear();
  clearParsedCache();
  parseRequestLog.clear();
  dotaParseLog.clear();
  publicMatchIpLog.clear();
});
afterEach(() => vi.unstubAllGlobals());

// ---------- 1. map ----------

describe("map ข้อมูลแมตช์", () => {
  it("แมตช์ที่วิเคราะห์แล้ว: isParsed = true และฟิลด์หลักครบ", () => {
    const m = mapMatchDetail(MATCH_ID, rawMatch());
    expect(m.isParsed).toBe(true);
    expect(m.matchId).toBe(MATCH_ID);
    expect(m.radiantWin).toBe(true);
    expect(m.radiantScore).toBe(47);
    expect(m.region).toBe(5);
    expect(m.players).toHaveLength(2);
    expect(m.players[0].isRadiant).toBe(true);
    expect(m.players[1].isRadiant).toBe(false);
    expect(m.players[0].kda).toBe(6);
    expect(m.players[0].hasScepter).toBe(true);
    expect(m.players[0].hasShard).toBe(false);
    expect(m.players[0].items[0]).toBe(1);
    expect(m.players[0].items[1]).toBeNull(); // item_0 = 0 แปลว่าช่องว่าง ไม่ใช่ไอเทม id 0
    expect(m.players[0].neutralItem).toBeNull();
    expect(m.picksBans[0]).toEqual({ isPick: true, heroId: 14, team: 0, order: 0 });
  });

  it("แมตช์ที่ยังไม่วิเคราะห์: isParsed = false (อ่านจาก od_data.has_parsed เท่านั้น)", () => {
    expect(mapMatchDetail(MATCH_ID, rawMatch({ od_data: { has_parsed: false } })).isParsed).toBe(false);
    expect(mapMatchDetail(MATCH_ID, rawMatch({ od_data: {} })).isParsed).toBe(false);
    expect(mapMatchDetail(MATCH_ID, rawMatch({ od_data: undefined })).isParsed).toBe(false);
    // มี version อยู่แต่ไม่มี has_parsed ก็ยังถือว่ายังไม่วิเคราะห์ ห้ามเดา
    expect(mapMatchDetail(MATCH_ID, rawMatch({ od_data: { version: 21 } })).isParsed).toBe(false);
  });

  it("ฟิลด์ขาด = null ไม่ใช่ค่าที่แต่งขึ้น", () => {
    const m = mapMatchDetail(MATCH_ID, { players: [{ player_slot: 0 }] });
    expect(m.radiantWin).toBeNull();
    expect(m.duration).toBeNull();
    expect(m.region).toBeNull();
    expect(m.radiantScore).toBeNull();
    expect(m.radiantTeamName).toBeNull();
    expect(m.players[0].name).toBe("Anonymous");
    expect(m.players[0].kills).toBeNull();
    expect(m.players[0].kda).toBeNull();
    expect(m.players[0].level).toBeNull();
    expect(m.players[0].accountId).toBeNull();
    expect(m.players[0].items).toEqual([null, null, null, null, null, null]);
  });

  it("JSON เพี้ยน = ไม่ระเบิด และไม่มีผู้เล่นปลอม", () => {
    for (const bad of [null, undefined, 42, "x", [], { players: "nope" }, { players: [1, "a"] }]) {
      const m = mapMatchDetail(MATCH_ID, bad);
      expect(m.matchId).toBe(MATCH_ID);
      expect(Array.isArray(m.players)).toBe(true);
      expect(m.isParsed).toBe(false);
    }
    expect(mapMatchDetail(MATCH_ID, { players: [1, "a"] }).players).toHaveLength(2);
    expect(mapMatchDetail(MATCH_ID, { players: [1] }).players[0].heroId).toBeNull();
  });

  it("รับผู้เล่นไม่เกิน 10 คน", () => {
    const many = Array.from({ length: 14 }, (_, i) => player(i));
    expect(mapMatchDetail(MATCH_ID, { players: many }).players).toHaveLength(10);
  });

  it("regionLabel: ค่าที่ไม่รู้จักหรือไม่มี = null ไม่เดา", () => {
    expect(regionLabel(5)).toBe("SE Asia");
    expect(regionLabel(999)).toBeNull();
    expect(regionLabel(null)).toBeNull();
  });
});

// ---------- 2. ห้ามมี fallback ----------

describe("ห้ามมี fallback", () => {
  it("OpenDota พัง 500 → error ไม่ใช่ข้อมูล", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 500 })));
    const r = await getMatchDetail(MATCH_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(502);
  });

  it("OpenDota 404 → error 404", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ status: 404 })));
    const r = await getMatchDetail(MATCH_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("OpenDota ตอบ 200 แต่ไม่มี players → error ไม่ใช่ข้อมูลเปล่า", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ body: { match_id: 1 } })));
    const r = await getMatchDetail(MATCH_ID);
    expect(r.ok).toBe(false);
  });

  it("matchId ไม่ถูกต้อง → error และไม่ยิงเครือข่ายเลย", async () => {
    const f = mockFetch(() => ({ body: rawMatch() }));
    vi.stubGlobal("fetch", f);
    const r = await getMatchDetail("abc");
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("ไม่มีคำว่า FALLBACK_MATCH เหลือในโปรเจกต์", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next" || name === ".git") continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) {
          // ตัดคอมเมนต์ออกก่อน: บรรทัดที่เขียนว่า "ลบ FALLBACK_MATCH แล้ว" ไม่ใช่ของจริง
          const code = readFileSync(p, "utf8").replace(/^\s*\/\/.*$/gm, "");
          if (code.includes("FALLBACK_MATCH")) hits.push(p);
        }
      }
    };
    for (const d of ["app", "lib", "components"]) walk(d);
    expect(hits).toEqual([]);
  });

  it("หน้า Dota สาธารณะไม่แสดงคะแนน KP", async () => {
    const { readFileSync } = await import("node:fs");
    const base = "app/[game]/stats/matches/[matchId]";
    for (const f of ["page.tsx", "layout.tsx"]) {
      // ตัดคอมเมนต์ออกก่อน เพราะคอมเมนต์อธิบายว่า "ไม่มีคะแนน KP" ซึ่งไม่ใช่การแสดงผล
      const code = readFileSync(`${base}/${f}`, "utf8").replace(/^\s*\/\/.*$/gm, "");
      expect(code).not.toMatch(/\bKP\b|killPoint|kpPlayers|totalKp|calculateKP/i);
    }
  });
});

// ---------- 3. แคชและค่าคงที่ ----------

describe("แคช", () => {
  it("แมตช์ที่วิเคราะห์แล้วถูกเก็บไว้ ไม่ยิงซ้ำ · ที่ยังไม่วิเคราะห์ยิงใหม่ทุกครั้ง", async () => {
    const f = mockFetch(() => ({ body: rawMatch() }));
    vi.stubGlobal("fetch", f);
    await getMatchDetail(MATCH_ID);
    await getMatchDetail(MATCH_ID);
    expect(f).toHaveBeenCalledTimes(1);

    clearParsedCache();
    const g = mockFetch(() => ({ body: rawMatch({ od_data: { has_parsed: false } }) }));
    vi.stubGlobal("fetch", g);
    await getMatchDetail("8214277204");
    await getMatchDetail("8214277204");
    expect(g).toHaveBeenCalledTimes(2);
  });

  // K-AV-QUOTA.1 (พี่หยัดอนุมัติ 19:02): แมตช์ที่วิเคราะห์แล้วเก็บ 7 วัน (เดิม 24 ชม.)
  it("ตั้งอายุแคชตามใบ: วิเคราะห์แล้ว 7 วัน · ยังไม่วิเคราะห์ 10 นาที", () => {
    expect(PARSED_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(UNPARSED_REVALIDATE_SEC).toBe(600);
  });

  it("getDotaConstant รับเฉพาะ allowlist · ค่านอกรายการไม่ยิงเครือข่าย", async () => {
    const f = mockFetch(() => ({ body: {} }));
    vi.stubGlobal("fetch", f);
    expect(DOTA_CONSTANTS).toEqual(["heroes", "items", "abilities", "hero_abilities", "ability_ids", "permanent_buffs"]);
    expect(isDotaConstant("heroes")).toBe(true);
    expect(isDotaConstant("../../players/1")).toBe(false);
    const bad = await getDotaConstant("patch" as never);
    expect(bad.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();

    await getDotaConstant("heroes");
    expect(String(f.mock.calls[0][0])).toContain("/constants/heroes");
    expect((f.mock.calls[0][1] as { next?: { revalidate?: number } })?.next?.revalidate).toBe(86400);
  });
});

// ---------- 4. API ขอวิเคราะห์ ----------

const req = (matchId: string) => parsePost(new Request("http://x"), { params: Promise.resolve({ matchId }) });

describe("API ขอวิเคราะห์แมตช์", () => {
  it("ไม่ล็อกอิน = 401 และไม่ยิง OpenDota เลย", async () => {
    const f = mockFetch(() => ({ body: rawMatch() }));
    vi.stubGlobal("fetch", f);
    const res = await req(MATCH_ID);
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("เลขแมตช์ผิด = 400", async () => {
    h.user = { id: "u1" };
    const f = mockFetch(() => ({ body: rawMatch() }));
    vi.stubGlobal("fetch", f);
    for (const bad of ["abc", "123", "1".repeat(13), "82142772031x"]) {
      expect((await req(bad)).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("เกินเพดาน 3 ครั้งต่อนาที = 429", async () => {
    h.user = { id: "u1" };
    vi.stubGlobal("fetch", mockFetch((u) => (u.includes("/request/") ? { body: { job: { jobId: 7 } } } : { body: rawMatch({ od_data: { has_parsed: false } }) })));
    expect(DOTA_PARSE_LIMIT).toBe(3);
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      parseRequestLog.clear(); // ตัดผลของการกันซ้ำออก ให้เหลือแค่เพดาน
      codes.push((await req(String(82142772000 + i))).status);
    }
    expect(codes[3]).toBe(429);
  });

  it("แมตช์ที่วิเคราะห์แล้ว = 409 และไม่ส่ง POST /request", async () => {
    h.user = { id: "u2" };
    const f = mockFetch(() => ({ body: rawMatch({ od_data: { has_parsed: true } }) }));
    vi.stubGlobal("fetch", f);
    const res = await req(MATCH_ID);
    expect(res.status).toBe(409);
    const posted = f.mock.calls.filter((c) => (c[1] as RequestInit)?.method === "POST");
    expect(posted).toHaveLength(0);
  });

  it("ส่งสำเร็จได้ jobId · ส่งซ้ำแมตช์เดิมใน 5 นาทีไม่ยิง POST อีก", async () => {
    h.user = { id: "u3" };
    const f = mockFetch((u) => (u.includes("/request/") ? { body: { job: { jobId: 99 } } } : { body: rawMatch({ od_data: { has_parsed: false } }) }));
    vi.stubGlobal("fetch", f);

    const first = await req(MATCH_ID);
    expect(first.status).toBe(202);
    expect((await first.json()).jobId).toBe("99");
    const postsAfterFirst = f.mock.calls.filter((c) => (c[1] as RequestInit)?.method === "POST").length;
    expect(postsAfterFirst).toBe(1);

    const second = await req(MATCH_ID);
    expect(second.status).toBe(200);
    expect((await second.json()).status).toBe("pending");
    const postsAfterSecond = f.mock.calls.filter((c) => (c[1] as RequestInit)?.method === "POST").length;
    expect(postsAfterSecond).toBe(1);
  });

  it("OpenDota ไม่ให้ jobId = ข้อความตรงตามคำตอบจริง ไม่เดาว่ารีเพลย์หมดอายุ", async () => {
    h.user = { id: "u4" };
    vi.stubGlobal("fetch", mockFetch((u) => (u.includes("/request/") ? { body: { error: "invalid match_id" } } : { body: rawMatch({ od_data: { has_parsed: false } }) })));
    const res = await req(MATCH_ID);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.message).toContain("invalid match_id");
    expect(body.message).not.toContain("รีเพลย์หมดอายุ");
  });

  it("ตัวช่วย pure: readJobId · findRecentParse · parseRejectMessage · isValidJobId", () => {
    expect(readJobId({ job: { jobId: 5 } })).toBe("5");
    expect(readJobId({ job: { jobId: "5" } })).toBe("5");
    expect(readJobId({ job: {} })).toBeNull();
    expect(readJobId(null)).toBeNull();

    const log = new Map<string, { at: number; jobId: string | null }>();
    rememberParse(log, "m", "1", 1000);
    expect(findRecentParse(log, "m", 1000 + PARSE_DEDUPE_MS - 1)).not.toBeNull();
    expect(findRecentParse(log, "m", 1000 + PARSE_DEDUPE_MS + 1)).toBeNull();
    expect(log.has("m")).toBe(false); // หมดอายุแล้วถูกลบทิ้ง

    expect(parseRejectMessage({})).not.toContain("รีเพลย์");
    expect(isValidJobId("12")).toBe(true);
    expect(isValidJobId("a")).toBe(false);
  });
});

// ---------- 5. เพดานต่อ IP ----------

describe("เพดานต่อ IP ของหน้าสาธารณะ", () => {
  it("ผ่าน 30 ครั้งแรก ครั้งที่ 31 ไม่ผ่าน แล้วรีเซ็ตเมื่อพ้น 1 นาที", () => {
    expect(DOTA_PUBLIC_IP_LIMIT).toBe(30);
    const k = ipKey("203.0.113.9");
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) expect(allowIp(publicMatchIpLog, k, now)).toBe(true);
    expect(allowIp(publicMatchIpLog, k, now)).toBe(false);
    expect(allowIp(publicMatchIpLog, k, now + 60_001)).toBe(true);
  });

  it("คนละ IP นับแยกกัน", () => {
    const now = 2_000_000;
    for (let i = 0; i < 30; i++) allowIp(publicMatchIpLog, ipKey("198.51.100.1"), now);
    expect(allowIp(publicMatchIpLog, ipKey("198.51.100.1"), now)).toBe(false);
    expect(allowIp(publicMatchIpLog, ipKey("198.51.100.2"), now)).toBe(true);
  });

  it("ไม่เก็บ IP: คีย์ที่ใช้นับไม่มี IP อยู่ในนั้นเลย", () => {
    const ip = "203.0.113.42";
    const k = ipKey(ip);
    expect(k).not.toContain(ip);
    expect(k).toMatch(/^[0-9a-f]{16}$/);
    allowIp(publicMatchIpLog, k, 1);
    expect([...publicMatchIpLog.keys()].join("|")).not.toContain(ip);
  });

  it("ใช้ค่าที่แพลตฟอร์มใส่ก่อน และไม่เชื่อค่าซ้ายสุดของ x-forwarded-for ที่ผู้เรียกปลอมได้", () => {
    const hdr = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });
    // ผู้เรียกใส่ค่าปลอมไว้ซ้ายสุด แต่ค่าที่แพลตฟอร์มใส่ต้องชนะเสมอ
    expect(clientIpFrom(hdr({ "x-forwarded-for": "1.1.1.1, 203.0.113.9", "x-vercel-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIpFrom(hdr({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    // เหลือแค่ XFF → ใช้ค่าขวาสุด (ช่วงที่ proxy ที่เราเชื่อถือเติมล่าสุด)
    expect(clientIpFrom(hdr({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIpFrom(hdr({}))).toBeNull();
  });

  it("ปลอม x-forwarded-for ซ้ายสุดแล้วข้ามเพดานไม่ได้", () => {
    const now = 3_000_000;
    const real = "203.0.113.50";
    const hdr = (fake: string) => ({ get: (n: string) => (n === "x-forwarded-for" ? `${fake}, ${real}` : null) });
    const keys = new Set<string>();
    for (let i = 0; i < 5; i++) keys.add(ipKey(clientIpFrom(hdr(`10.0.0.${i}`))));
    expect(keys.size).toBe(1); // ทุกคำขอตกคีย์เดียวกัน ปลอมไม่ช่วย
    const k = [...keys][0];
    for (let i = 0; i < 30; i++) allowIp(publicMatchIpLog, k, now);
    expect(allowIp(publicMatchIpLog, k, now)).toBe(false);
  });

  it("IPv6 ทั้งช่วง /64 นับรวมกัน (เครื่องเดียวถือหลายที่อยู่ เลี่ยงเพดานไม่ได้)", () => {
    const a = ipBucket("2001:db8:abcd:1234:1:1:1:1");
    expect(ipBucket("2001:db8:abcd:1234:9:9:9:9")).toBe(a);
    expect(ipBucket("2001:db8:abcd:1234::5")).toBe(a);
    expect(ipBucket("[2001:db8:abcd:1234::5]:443")).toBe(a);
    expect(ipBucket("2001:db8:abcd:1234::5%eth0")).toBe(a);
    // คนละ /64 ต้องนับแยก
    expect(ipBucket("2001:db8:abcd:9999::5")).not.toBe(a);
    // IPv4 ยังนับรายที่อยู่ และตัดพอร์ตออก
    expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("203.0.113.9:443")).toBe("203.0.113.9");
    expect(ipBucket(null)).toBe("unknown");
  });

  it("IPv4 ที่ห่อมาในรูป IPv6 ต้องนับรายที่อยู่ ไม่ยุบรวมเป็นถังเดียว", () => {
    // เคสจริง: socket แบบ dual-stack ของ Node ส่ง IPv4 มาเป็น ::ffff:a.b.c.d
    expect(ipBucket("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(ipBucket("::203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("[::ffff:203.0.113.9]:443")).toBe("203.0.113.9");
    // ของเดิมยุบทุกตัวเป็น 0:0:0:0::/64 เหมือนกันหมด — ต้องไม่ชนกันอีกแล้ว
    expect(ipBucket("::ffff:203.0.113.9")).not.toBe(ipBucket("::ffff:198.51.100.7"));
    // และต้องตรงกับรูปแบบ IPv4 ธรรมดาของที่อยู่เดียวกัน (คนเดียวกันต้องอยู่ถังเดียวกัน)
    expect(ipKey("::ffff:203.0.113.9")).toBe(ipKey("203.0.113.9"));
  });

  it("คนละ IPv4 ที่ห่อมาในรูป IPv6 ล็อกกันเองไม่ได้", () => {
    const now = 8_000_000;
    const victim = ipKey("::ffff:198.51.100.7");
    for (let i = 0; i < 30; i++) allowIp(publicMatchIpLog, ipKey("::ffff:203.0.113.9"), now);
    expect(allowIp(publicMatchIpLog, ipKey("::ffff:203.0.113.9"), now)).toBe(false);
    expect(allowIp(publicMatchIpLog, victim, now)).toBe(true);
  });

  it("ค่าที่ไม่ใช่ที่อยู่ IP ไม่ถูกยุบรวมกับใคร", () => {
    expect(ipBucket("not-an-ip")).toBe("not-an-ip");
    expect(ipBucket("unknown")).toBe("unknown");
    expect(ipBucket("not-an-ip")).not.toBe(ipBucket("other-junk"));
  });

  it("IPv6 คนละที่อยู่ใน /64 เดียวกันใช้เพดานร่วมกัน", () => {
    const now = 5_000_000;
    const keys = new Set<string>();
    for (let i = 0; i < 40; i++) keys.add(ipKey(`2001:db8:abcd:1234::${i}`));
    expect(keys.size).toBe(1);
    const k = [...keys][0];
    for (let i = 0; i < 30; i++) expect(allowIp(publicMatchIpLog, k, now)).toBe(true);
    expect(allowIp(publicMatchIpLog, k, now)).toBe(false);
  });

  it("เพดานจำนวนคีย์บังคับได้จริง แม้กวาดแล้วยังเต็ม (ทุกคีย์ยัง active)", () => {
    resetPruneClock();
    const now = 6_000_000;
    // ยัดคีย์ที่ยัง active ให้เกินเพดาน — map ต้องไม่โตเกิน IP_LOG_MAX_KEYS
    for (let i = 0; i < IP_LOG_MAX_KEYS + 120; i++) allowIp(publicMatchIpLog, `k${i}`, now);
    expect(publicMatchIpLog.size).toBeLessThanOrEqual(IP_LOG_MAX_KEYS);
  });

  it("กวาดอย่างมากหนึ่งครั้งต่อหน้าต่าง ไม่ใช่ทุกคำขอ", () => {
    resetPruneClock();
    const now = 7_000_000;
    allowIp(publicMatchIpLog, "a", now - 120_000); // คีย์เก่าที่ควรโดนกวาด
    allowIp(publicMatchIpLog, "b", now); // คำขอแรกในหน้าต่างนี้ → กวาด
    expect(publicMatchIpLog.has("a")).toBe(false);
    allowIp(publicMatchIpLog, "c", now + 1_000); // ยังอยู่ในหน้าต่างเดิม → ไม่กวาดซ้ำ
    publicMatchIpLog.set("stale", [now - 120_000]);
    allowIp(publicMatchIpLog, "d", now + 2_000);
    expect(publicMatchIpLog.has("stale")).toBe(true); // พิสูจน์ว่าไม่ได้กวาดทุกคำขอ
  });

  it("กวาดคีย์หมดอายุทิ้ง ไม่ปล่อยให้หน่วยความจำโตไม่หยุด", () => {
    resetPruneClock();
    const now = 4_000_000;
    for (let i = 0; i < 50; i++) allowIp(publicMatchIpLog, ipKey(`198.51.100.${i}`), now);
    expect(publicMatchIpLog.size).toBe(50);
    pruneIpLog(publicMatchIpLog, now + 60_001);
    expect(publicMatchIpLog.size).toBe(0);
    expect(IP_LOG_MAX_KEYS).toBe(5000);
  });
});
