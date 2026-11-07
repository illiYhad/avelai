import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderToStaticMarkup } from "react-dom/server";

// K-AV-PASSDOTA.2: กรอบ Dota 2 Public Match ในหน้า Passport ของเจ้าของ · fetch ปลอม ไม่ต่อเน็ต ไม่ใช้ env
// fixture แต่งเอง ไม่มีข้อมูลบุคคลจริง

const h = vi.hoisted(() => ({
  viewerId: "owner-uuid",
  account: { external_id: "33333333", status: "VERIFIED" } as { external_id: string; status: string } | null,
  accountError: null as { message: string } | null,
  tablesRead: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", async () => (await import("./_fake-next-cache")).fakeNextCache);
vi.mock("@/lib/dota/getHeroes", () => ({
  getHeroes: async () => ({ "1": { id: 1, name: "npc_dota_hero_antimage", localized_name: "Anti-Mage" } }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (u: string) => { throw new Error(`REDIRECT ${u}`); },
}));

const PASSPORT_ROW = { user_id: "owner-uuid", username: "tester", game: "DOTA2", rating: 1200, games_played: 3, peak: 1250, matches: 3, wins: 2, losses: 1, karma: 90, tournaments_entered: 1 };

function fakeDb() {
  return {
    from(table: string) {
      h.tablesRead.push(table);
      const result =
        table === "passport_v" ? { data: [PASSPORT_ROW], error: null }
        : table === "elo_history" ? { data: [], error: null }
        : { data: null, error: null };
      const b: Record<string, unknown> = {
        select: () => b, eq: () => b, order: () => b, limit: () => b,
        maybeSingle: async () => (table === "game_accounts" ? { data: h.account, error: h.accountError } : result),
        then: (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok),
      };
      return b;
    },
  };
}
vi.mock("@/lib/auth/roles", () => ({
  requireUser: async () => ({ db: fakeDb(), user: { id: h.viewerId } }),
}));

import { resetQuotaState, noteQuotaExceeded } from "@/lib/dota/quota";
import { fakeCacheStore } from "./_fake-next-cache";
import { DOTA_STATS_SOURCE_LABEL } from "@/lib/dota/opendota";
import DotaPublicStatsPanel from "@/components/dota/DotaPublicStatsPanel";
import PassportPage from "@/app/[game]/passport/[username]/page";

const ID = "33333333";
const PROFILE = { profile: { account_id: 33333333, personaname: "Tester" } };
const WL = { win: 70, lose: 30 };
const HEROES = Array.from({ length: 7 }, (_, i) => ({ hero_id: i + 1, games: 70 - i, win: 30 }));
const MATCHES = Array.from({ length: 20 }, (_, i) => ({
  match_id: 8000000000 + i, player_slot: 0, radiant_win: i % 2 === 0, duration: 1800, start_time: 1761000000 + i,
  game_mode: 22, lobby_type: 7, hero_id: 1, kills: 5, deaths: 2, assists: 7,
}));

let playerCalls = 0;
function stubFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const p = new URL(url).pathname.replace("/api", "");
    if (p === `/players/${ID}/wl`) playerCalls++; // 1 ครั้งต่อ getPlayerCard
    const body = p === `/players/${ID}` ? PROFILE : p.endsWith("/wl") ? WL : p.endsWith("/heroes") ? HEROES : p.endsWith("/matches") ? MATCHES : null;
    const status = body === null ? 404 : 200;
    return { ok: status === 200, status, json: async () => body } as Response;
  }));
}

const renderPanel = async () => renderToStaticMarkup(await DotaPublicStatsPanel({ accountId: ID }));
const renderPage = async (game: string) =>
  renderToStaticMarkup(await PassportPage({ params: Promise.resolve({ game, username: "tester" }) }));
const textOnly = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

beforeEach(() => {
  resetQuotaState();
  fakeCacheStore.clear();
  playerCalls = 0;
  h.viewerId = "owner-uuid";
  h.account = { external_id: ID, status: "VERIFIED" };
  h.accountError = null;
  h.tablesRead = [];
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("K-AV-PASSDOTA.2 · DotaPublicStatsPanel", () => {
  it("a) แสดงป้าย DOTA_STATS_SOURCE_LABEL ตรงตัว · ไม่มีคำว่า ELO นอกป้าย", async () => {
    const html = await renderPanel();
    expect(html).toContain(DOTA_STATS_SOURCE_LABEL);
    expect(textOnly(html).split(DOTA_STATS_SOURCE_LABEL).join("")).not.toMatch(/ELO|Rating|คะแนน AVELAi/i);
    expect(html).toContain("// DOTA 2 · PUBLIC MATCH");
  });

  it("b) 7 ฮีโร่ / 20 แมตช์ → แสดง 5 ฮีโร่ / 10 แมตช์ · ลิงก์ /dota2/stats/matches/{id}", async () => {
    const html = await renderPanel();
    const links = [...html.matchAll(/href="\/dota2\/stats\/matches\/(\d+)"/g)].map((m) => m[1]);
    expect(links).toEqual(MATCHES.slice(0, 10).map((m) => String(m.match_id)));
    const heroTable = html.split("ฮีโร่ที่เล่นมากสุด")[1].split("แมตช์ล่าสุด")[0];
    expect(heroTable.match(/<tr class="border-t/g)).toHaveLength(5);
  });

  it("c) โหมดประหยัด (429) → ข้อความในกรอบ ไม่ throw", async () => {
    noteQuotaExceeded(Date.now());
    const html = await renderPanel();
    expect(html).toContain("ข้อมูลแมตช์ใหม่จะอัปเดตอีกครั้งพรุ่งนี้");
    expect(html).toContain(DOTA_STATS_SOURCE_LABEL);
  });
});

describe("K-AV-PASSDOTA.2 · หน้า Passport", () => {
  it("d1) เจ้าของ + dota2 + VERIFIED → getPlayerCard 1 ครั้ง · กรอบอยู่ระหว่าง ELO กับประวัติแมตช์", async () => {
    const html = await renderPage("dota2");
    expect(playerCalls).toBe(1);
    const iElo = html.indexOf("// ELO"), iDota = html.indexOf("// DOTA 2 · PUBLIC MATCH"), iHist = html.indexOf("// ประวัติแมตช์");
    expect(iElo).toBeGreaterThan(-1);
    expect(iElo).toBeLessThan(iDota);
    expect(iDota).toBeLessThan(iHist);
    const out = path.join(os.tmpdir(), "k-av-passdota-2-owner-render.html"); // ไฟล์ผลให้ใบตอบ · ไม่เขียนลง repo
    fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><!-- K-AV-PASSDOTA.2 owner render from tests (fixture data) -->\n${html}\n`);
  });

  it("d2) คนอื่นดู → ไม่อ่าน game_accounts · getPlayerCard 0 ครั้ง", async () => {
    h.viewerId = "someone-else";
    const html = await renderPage("dota2");
    expect(playerCalls).toBe(0);
    expect(h.tablesRead).not.toContain("game_accounts");
    expect(html).not.toContain("PUBLIC MATCH");
  });

  it("d3) หน้า mlbb → ไม่อ่าน game_accounts · getPlayerCard 0 ครั้ง", async () => {
    const html = await renderPage("mlbb");
    expect(playerCalls).toBe(0);
    expect(h.tablesRead).not.toContain("game_accounts");
    expect(html).not.toContain("PUBLIC MATCH");
  });

  it("d4) unverified → 0 ครั้ง + ลิงก์ /link/steam/start", async () => {
    h.account = { external_id: ID, status: "UNVERIFIED" };
    const html = await renderPage("dota2");
    expect(playerCalls).toBe(0);
    expect(html).toContain('href="/link/steam/start"');
    expect(html).toContain(DOTA_STATS_SOURCE_LABEL);
  });

  it("d5) ยังไม่ผูก → ลิงก์ /me · อ่านตารางไม่ได้ → ไม่มีกรอบ", async () => {
    h.account = null;
    let html = await renderPage("dota2");
    expect(html).toContain("ยังไม่ได้ผูกบัญชี Dota 2");
    expect(playerCalls).toBe(0);
    h.accountError = { message: "relation does not exist" };
    html = await renderPage("dota2");
    expect(html).not.toContain("PUBLIC MATCH");
  });
});

describe("K-AV-PASSDOTA.2 · แยกจากคะแนนแรงก์", () => {
  it("e) DotaPublicStatsPanel.tsx ไม่ import lib/elo และไม่มี passport_v", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../components/dota/DotaPublicStatsPanel.tsx"), "utf8");
    expect(src).not.toMatch(/lib\/elo/);
    expect(src).not.toContain("passport_v");
    expect(src).not.toContain('glow="gold"');
  });
});
