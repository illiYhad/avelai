// K-AV-HOME.0: หน้าแรกคนไม่ล็อกอิน + เส้นสาธารณะ /api/public/dota2/match/[matchId]
// mock OpenDota ทั้งหมด (ไม่ยิงเน็ตจริง) · ไม่ต่อ DB
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/public/dota2/match/[matchId]/route";
import { publicMatchApiIpLog, toPublicMatch, heroLabel } from "@/lib/dota/public-match";
import { lookupPublicMatch } from "@/lib/dota/public-match-client";
import { DOTA_PUBLIC_IP_LIMIT } from "@/lib/dota/ip-rate-limit";
import PublicHome from "@/components/home/PublicHome";
import { errorText } from "@/components/home/PublicMatchLookup";
import { th } from "@/lib/i18n/th";
import { en } from "@/lib/i18n/en";

/** แมตช์ปลอมแบบ OpenDota: 10 คน · คนที่ 2 ไม่มี personaname · มี account_id/ข้อมูลดิบเกินที่ต้องไม่หลุดออก */
function fakeMatch() {
  const players = Array.from({ length: 10 }, (_, i) => ({
    player_slot: i < 5 ? i : 128 + i - 5,
    account_id: 1000 + i,
    personaname: i === 1 ? undefined : `P${i}`,
    hero_id: i + 1,
    kills: 5,
    deaths: 2,
    assists: 10,
    tower_kills: 1,
    obs_placed: 2,
    sen_placed: 2,
    hero_healing: 0,
    stuns: 0,
    damage_taken: { npc_dota_hero_antimage: 100 },
    gold_per_min: 500,
    ip_address: "1.2.3.4",
  }));
  return {
    match_id: 8012345678,
    radiant_win: true,
    duration: 2125,
    radiant_score: 30,
    dire_score: 20,
    players,
    picks_bans: [{ is_pick: true, hero_id: 1, team: 0, order: 0 }],
    chat: [{ key: "gg" }],
  };
}

const call = (id: string, ip = "203.0.113.9") =>
  GET(new Request(`http://localhost/api/public/dota2/match/${id}`, { headers: { "x-real-ip": ip } }), {
    params: Promise.resolve({ matchId: id }),
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  publicMatchApiIpLog.clear();
  fetchMock = vi.fn(async () => new Response(JSON.stringify(fakeMatch()), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("K-AV-HOME.0 เส้น API สาธารณะ", () => {
  it("a) matchId ผิดรูปแบบ = 400 invalid · ไม่ยิง OpenDota", async () => {
    for (const id of ["1234567", "1234567890123", "abc12345678", "80123456 78", ""]) {
      const res = await call(id);
      expect(res.status, id).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("b) matchId ถูก = 200 · ยิง GET /matches/{id} อย่างเดียว (ไม่มี /request = ไม่ขอ parse)", async () => {
    const res = await call("8012345678");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe("https://api.opendota.com/api/matches/8012345678");
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("c) ส่งออกเฉพาะฟิลด์ที่ map แล้ว · ไม่มี account_id / ip / chat / gpm · คนไม่มีชื่อ = Anonymous", async () => {
    const { match } = (await (await call("8012345678")).json()) as { match: Record<string, unknown> };
    expect(Object.keys(match).sort()).toEqual(["direScore", "duration", "matchId", "parseStatus", "picksBans", "players", "radiantScore", "radiantWin"]);
    const players = match.players as Record<string, unknown>[];
    expect(players).toHaveLength(10);
    for (const p of players) expect(Object.keys(p).sort()).toEqual(["assists", "deaths", "hero", "heroId", "isRadiant", "kills", "matchScore", "name"]);
    expect(players[1].name).toBe("Anonymous");
    const text = JSON.stringify(match);
    for (const bad of ["account_id", "1000", "ip_address", "1.2.3.4", "chat", "gold_per_min"]) expect(text).not.toContain(bad);
  });

  it("d) Match Score ตามสูตร RANK_01 (lib/avelai/score) · ข้อมูลไม่พอ = null", () => {
    const m = toPublicMatch("8012345678", fakeMatch());
    // ผู้ชนะคนแรก (Radiant): Outcome 25 + Base KP (5 − 1 + 3 + 2 = 9) + Role (wards 4/2 = 2 · heal 0 · stuns 0 ·
    // ดาเมจรับจากฝั่งตรงข้าม 0 เพราะ antimage (id 1) อยู่ทีมเดียวกัน) → (36 + 20) / 16 = 3.5
    expect(m.players[0].matchScore).toBeCloseTo(3.5, 6);
    // ฝั่ง Dire (แพ้): ดาเมจรับจาก antimage ฝั่งตรงข้าม 100 → Role มี 100/15000 · Base KP บวก × 0.5
    expect(m.players[5].matchScore).toBeCloseTo((-10 + 9 * 0.5 + 2 + 100 / 15000 + 20) / 16, 6);
    const noWards = fakeMatch();
    for (const p of noWards.players) delete (p as Record<string, unknown>).obs_placed;
    expect(toPublicMatch("8012345678", noWards).players[0].matchScore).toBeNull();
  });

  it("e) เกินเพดานต่อ IP = 429 rate_limited · IP อื่นยังผ่าน", async () => {
    for (let i = 0; i < DOTA_PUBLIC_IP_LIMIT; i++) expect((await call("8012345678")).status).toBe(200);
    const res = await call("8012345678");
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect((await call("8012345678", "198.51.100.7")).status).toBe(200);
  });

  it("f) OpenDota 404 = not_found · ล่ม = upstream · ไม่มีผู้เล่น = not_found", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await (await call("8012345678")).json()).toEqual({ error: "not_found" });
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    const r = await call("8012345678");
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "upstream" });
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await (await call("8012345678")).json()).toEqual({ error: "upstream" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ players: [] }), { status: 200 }));
    expect(await (await call("8012345678")).json()).toEqual({ error: "not_found" });
  });

  it("g) ใต้ app/api/public มีแค่เส้นนี้ (ไม่มี parse) · ไม่แตะ DB / ไม่ขอ parse / ไม่ดึง Dotabuff", () => {
    const root = path.resolve(__dirname, "../app/api/public");
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const files = walk(root).map((f) => path.relative(root, f).split(path.sep).join("/"));
    expect(files).toEqual(["dota2/match/[matchId]/route.ts"]);
    const src = (
      fs.readFileSync(path.join(root, "dota2/match/[matchId]/route.ts"), "utf8") +
      fs.readFileSync(path.resolve(__dirname, "../lib/dota/public-match.ts"), "utf8") +
      fs.readFileSync(path.resolve(__dirname, "../lib/dota/public-match-client.ts"), "utf8")
    ).toLowerCase();
    for (const bad of ["postopendota", "/request", "parse/", "getserverdb", "supabase", "dotabuff", "opendota_api_key"]) expect(src).not.toContain(bad);
  });

  it("h) heroLabel: id ที่รู้จัก = ชื่อ · ไม่รู้จัก = Hero #id · null = –", () => {
    expect(heroLabel(1)).toMatch(/^[A-Z]/);
    expect(heroLabel(99999)).toBe("Hero #99999");
    expect(heroLabel(null)).toBe("–");
  });
});

describe("K-AV-HOME.0 ฝั่งหน้าเว็บ", () => {
  it("i) lookupPublicMatch: ผิดรูปแบบไม่ยิง · แปลงรหัสข้อผิดพลาด · เน็ตล่ม = upstream", async () => {
    const f = vi.fn();
    expect(await lookupPublicMatch("12", f as unknown as typeof fetch)).toEqual({ ok: false, code: "invalid" });
    expect(f).not.toHaveBeenCalled();
    const g = vi.fn(async () => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }));
    expect(await lookupPublicMatch(" 8012345678 ", g as unknown as typeof fetch)).toEqual({ ok: false, code: "rate_limited" });
    expect((g.mock.calls[0] as unknown[])[0]).toBe("/api/public/dota2/match/8012345678");
    const h = vi.fn(async () => {
      throw new Error("x");
    });
    expect(await lookupPublicMatch("8012345678", h as unknown as typeof fetch)).toEqual({ ok: false, code: "upstream" });
  });

  it("j) PublicHome ไม่ render ราว/ทัวร์สำหรับคุณ/ทีม · มีแบนเนอร์ ช่อง Match ID และปุ่มล็อกอินตามภาษา", () => {
    for (const [locale, login] of [
      ["th", 'href="/login"'],
      ["en", 'href="/en/login"'],
    ] as const) {
      const html = renderToStaticMarkup(createElement(PublicHome, { locale }));
      expect(html).toContain("data-public-home");
      expect(html).toContain('data-section="public-match"');
      expect(html).toContain('name="matchId"');
      expect(html).toContain(login);
      for (const hidden of ['data-section="for-you"', 'data-section="rail-left"', 'data-section="rail-right"', "home-foryou-title"]) {
        expect(html).not.toContain(hidden);
      }
      const t = locale === "th" ? th.publicHome : en.publicHome;
      expect(html).toContain(t.title);
      expect(html).toContain(t.empty);
    }
  });

  it("k) พจนานุกรม publicHome th/en คีย์ตรงกัน · ข้อความผิดพลาดครบทุกรหัส · en ไม่มีไทย", () => {
    expect(Object.keys(en.publicHome).sort()).toEqual(Object.keys(th.publicHome).sort());
    for (const v of Object.values(en.publicHome)) expect(v).not.toMatch(/[฀-๿]/);
    for (const code of ["invalid", "rate_limited", "not_found", "upstream"] as const) {
      expect(errorText(th.publicHome, code)).toBeTruthy();
      expect(errorText(en.publicHome, code)).toBeTruthy();
    }
  });
});
