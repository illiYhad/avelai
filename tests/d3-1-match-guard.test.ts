import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// K-AV-D3.1: ยามเดียวทั้งเส้นทาง · ตัวติดตามสถานะ · ไม่จำคำขอที่ถูกปฏิเสธ
// ไม่ยิงเครือข่าย: getMatchDetail และ heroLookup ถูก mock ทั้งไฟล์ · fetch จริงโยน error

const h = vi.hoisted(() => ({
  scope: 0, // จำลอง "หนึ่งคำขอ" ของ React cache: เปลี่ยนเลขนี้ = คำขอใหม่
  user: null as { id: string } | null,
  detailCalls: 0,
}));

// จำลอง cache() ของ React แบบ RSC: จำผลต่อฟังก์ชันภายในคำขอเดียวกัน (h.scope)
vi.mock("react", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  const memo = new WeakMap<object, { scope: number; value: unknown }>();
  return {
    ...actual,
    cache: (fn: (...a: unknown[]) => unknown) =>
      function cached(...args: unknown[]) {
        const hit = memo.get(fn);
        if (hit && hit.scope === h.scope) return hit.value;
        const value = fn(...args);
        memo.set(fn, { scope: h.scope, value });
        return value;
      },
  };
});
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => (n === "x-real-ip" ? "198.51.100.77" : null) }),
}));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));

const PLAYER_NAME = "kick.com/yisusdota"; // ชื่อที่อลิสใช้ตรวจว่าข้อมูลรั่ว
const fixture = {
  matchId: "8214277203",
  isParsed: false,
  radiantWin: true,
  radiantScore: 30,
  direScore: 20,
  duration: 2000,
  gameMode: 22,
  lobbyType: 7,
  region: 5,
  startTime: 1700000000,
  radiantTeamName: null,
  direTeamName: null,
  picksBans: [],
  players: [
    {
      slot: 0,
      isRadiant: true,
      name: PLAYER_NAME,
      heroId: 1,
      level: 25,
      kills: 1,
      deaths: 2,
      assists: 3,
      kda: 2,
      lastHits: 1,
      denies: 1,
      gpm: 1,
      xpm: 1,
      netWorth: 1,
      heroDamage: 1,
      heroHealing: 1,
      towerDamage: 1,
      items: [null, null, null, null, null, null],
      hasScepter: false,
      hasShard: false,
    },
  ],
};
vi.mock("@/lib/dota/match", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    getMatchDetail: vi.fn(async () => {
      h.detailCalls += 1;
      return { ok: true, data: fixture };
    }),
  };
});
vi.mock("@/lib/dota/display", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, heroLookup: async () => () => ({ label: "H", img: "" }) };
});

import MatchStatsLayout from "@/app/[game]/stats/matches/[matchId]/layout";
import OverviewPage from "@/app/[game]/stats/matches/[matchId]/page";
import BuildsPage from "@/app/[game]/stats/matches/[matchId]/builds/page";
import CombatPage from "@/app/[game]/stats/matches/[matchId]/combat/page";
import { MATCH_TABS } from "@/app/[game]/stats/matches/[matchId]/tabs";
import { publicMatchIpLog, DOTA_PUBLIC_IP_LIMIT } from "@/lib/dota/ip-rate-limit";
import { PUBLIC_MATCH_BLOCKED_MESSAGE } from "@/lib/dota/match/guard";
import { parseRequestLog, rememberParse, findRecentParse } from "@/lib/dota/match/parse";
import { readStatusBody, startParsePoller, PARSE_POLL_INTERVAL_MS, PARSE_POLL_MAX_MS } from "@/lib/dota/match/poll";
import { POST as parsePost, dotaParseLog } from "@/app/api/games/dota2/parse/[matchId]/route";

const MATCH_ID = "8214277203";
const params = () => Promise.resolve({ game: "dota2", matchId: MATCH_ID });
const newRequest = () => {
  h.scope += 1;
};
// เก็บเฉพาะข้อความใน props ของต้นไม้ React (ไม่ตาม type/_owner ที่วนซ้ำ)
const textOf = (node: unknown, seen = new Set<object>()): string => {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "function") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((n) => textOf(n, seen)).join("|");
  if (typeof node !== "object" || seen.has(node)) return "";
  seen.add(node);
  const o = node as Record<string, unknown>;
  const props = "props" in o && o.props && typeof o.props === "object" ? (o.props as Record<string, unknown>) : o;
  return Object.entries(props)
    .filter(([k]) => k !== "type" && k !== "_owner" && k !== "_store")
    .map(([, v]) => textOf(v, seen))
    .join("|");
};
const render = async (fn: () => Promise<unknown>) => textOf(await fn());
const recentCount = () => [...publicMatchIpLog.values()].reduce((n, ts) => n + ts.length, 0);

beforeEach(() => {
  publicMatchIpLog.clear();
  parseRequestLog.clear();
  dotaParseLog.clear();
  h.detailCalls = 0;
  h.user = null;
  newRequest();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("เทสนี้ต้องไม่ยิงเครือข่าย");
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ยามเดียวทั้งเส้นทาง (ข้อ 1)", () => {
  it("หน้าเต็ม (layout + page) ในคำขอเดียว นับเพดาน 1 ครั้ง ไม่ใช่ 2", async () => {
    const out =
      (await render(() => MatchStatsLayout({ children: null, params: params() }))) +
      (await render(() => OverviewPage({ params: params() })));
    expect(out).toContain(PLAYER_NAME); // ยังไม่เกินเพดาน ข้อมูลออกตามปกติ
    expect(recentCount()).toBe(1);
  });

  it("เกินเพดานแล้ว: layout และ page ไม่เรียก getMatchDetail และไม่มีชื่อผู้เล่นในผลลัพธ์", async () => {
    for (let i = 0; i < DOTA_PUBLIC_IP_LIMIT; i++) {
      newRequest();
      await MatchStatsLayout({ children: null, params: params() });
    }
    newRequest();
    h.detailCalls = 0;
    const layoutOut = await render(() => MatchStatsLayout({ children: null, params: params() }));
    const pageOut = await render(() => OverviewPage({ params: params() }));
    expect(layoutOut).toContain(PUBLIC_MATCH_BLOCKED_MESSAGE);
    expect(pageOut).toContain(PUBLIC_MATCH_BLOCKED_MESSAGE);
    expect(layoutOut + pageOut).not.toContain(PLAYER_NAME);
    expect(h.detailCalls).toBe(0);
  });

  it("นำทางระหว่างแท็บ (render เฉพาะ page) นับและกันตามจริง ข้าม layout ไม่ได้", async () => {
    // เปิดหน้าเต็ม 1 ครั้ง แล้วสลับแท็บอีก 29 ครั้ง = ครบ 30
    await MatchStatsLayout({ children: null, params: params() });
    await OverviewPage({ params: params() });
    for (let i = 0; i < DOTA_PUBLIC_IP_LIMIT - 1; i++) {
      newRequest();
      const tab = i % 2 === 0 ? BuildsPage : CombatPage;
      expect(await render(() => tab({ params: params() }))).not.toContain(PUBLIC_MATCH_BLOCKED_MESSAGE);
    }
    expect(recentCount()).toBe(DOTA_PUBLIC_IP_LIMIT);
    // ครั้งที่ 31 ผ่านแท็บ Overview โดยไม่ผ่าน layout = ต้องถูกกัน
    newRequest();
    h.detailCalls = 0;
    const out = await render(() => OverviewPage({ params: params() }));
    expect(out).toContain(PUBLIC_MATCH_BLOCKED_MESSAGE);
    expect(out).not.toContain(PLAYER_NAME);
    expect(h.detailCalls).toBe(0);
    // แท็บที่ยังไม่เปิดก็ถูกกันเช่นกัน
    newRequest();
    expect(await render(() => BuildsPage({ params: params() }))).toContain(PUBLIC_MATCH_BLOCKED_MESSAGE);
  });

  it("ทุก page ใต้เส้นทางเรียกยาม (ตรวจจากไฟล์จริง)", async () => {
    const { readFileSync } = await import("node:fs");
    const base = "app/[game]/stats/matches/[matchId]";
    for (const t of MATCH_TABS) {
      const file = t.slug ? `${base}/${t.slug}/page.tsx` : `${base}/page.tsx`;
      expect(readFileSync(file, "utf8"), `ขาดยามใน ${file}`).toContain("guardPublicMatchView()");
    }
    expect(readFileSync(`${base}/layout.tsx`, "utf8")).toContain("guardPublicMatchView()");
  });
});

describe("คำขอที่ถูกปฏิเสธไม่ถูกจำเป็นกำลังรอผล (ข้อ 3)", () => {
  const req = () => parsePost(new Request("http://x"), { params: Promise.resolve({ matchId: MATCH_ID }) });

  it("rememberParse ไม่บันทึกเมื่อไม่มี jobId", () => {
    const log = new Map<string, { at: number; jobId: string | null }>();
    expect(rememberParse(log, "m", null, 1000)).toBe(false);
    expect(log.has("m")).toBe(false);
    expect(rememberParse(log, "m", "9", 1000)).toBe(true);
    expect(findRecentParse(log, "m", 1000)?.jobId).toBe("9");
  });

  it("OpenDota ปฏิเสธ → 502 พร้อมข้อความจริง และกดอีกครั้งส่งใหม่ได้ ไม่ขึ้นกำลังรอผล", async () => {
    h.user = { id: "u-d31" };
    // route ใช้ getMatchDetail ที่ mock ไว้ (ยังไม่วิเคราะห์) · POST /request ตอบไม่มี jobId
    let posts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/request/") && init?.method === "POST") {
          posts += 1;
          return new Response(JSON.stringify({ error: "invalid match_id" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error("ไม่ควรมีการเรียกอื่นนอกจาก POST /request");
      }),
    );
    const r1 = await req();
    expect(r1.status).toBe(502);
    expect((await r1.json()).message).toContain("invalid match_id");
    expect(parseRequestLog.has(MATCH_ID)).toBe(false);

    const r2 = await req();
    expect(r2.status).toBe(502); // ส่งไป OpenDota ใหม่จริง ไม่ใช่ตอบ "กำลังรอผล" จากความจำ
    expect((await r2.json()).status).toBe("rejected");
    expect(posts).toBe(2);
  });

  it("ได้ jobId แล้วจึงจำกันซ้ำ: ครั้งที่สองใน 5 นาทีไม่ส่ง POST ซ้ำ", async () => {
    h.user = { id: "u-d31b" };
    let posts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/request/") && init?.method === "POST") {
          posts += 1;
          return new Response(JSON.stringify({ job: { jobId: 77 } }), { status: 200 });
        }
        throw new Error("ไม่ควรมีการเรียกอื่น");
      }),
    );
    const r1 = await req();
    expect(r1.status).toBe(202);
    expect((await r1.json()).jobId).toBe("77");
    const r2 = await req();
    expect((await r2.json()).status).toBe("pending");
    expect(posts).toBe(1);
  });
});

describe("ตัวติดตามสถานะงานวิเคราะห์ (ข้อ 2)", () => {
  it("readStatusBody: done / pending / โครงเพี้ยน = error ไม่ใช่ done", () => {
    expect(readStatusBody(true, { status: "done" })).toBe("done");
    expect(readStatusBody(true, { status: "pending" })).toBe("pending");
    expect(readStatusBody(true, { status: "weird" })).toBe("error");
    expect(readStatusBody(true, null)).toBe("error");
    expect(readStatusBody(true, "done")).toBe("error");
    expect(readStatusBody(false, { status: "done" })).toBe("error");
  });

  it("ถามทุก 10 วินาที · งานจบ = onDone ครั้งเดียว แล้วหยุดถาม", async () => {
    vi.useFakeTimers();
    const answers = ["pending", "pending", "done", "done"] as const;
    let i = 0;
    const fetchStatus = vi.fn(async () => answers[Math.min(i++, answers.length - 1)]);
    const onDone = vi.fn();
    const onTimeout = vi.fn();
    startParsePoller({ fetchStatus, onDone, onTimeout });
    expect(fetchStatus).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS * 2);
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(onDone).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS * 5);
    expect(fetchStatus).toHaveBeenCalledTimes(3); // หยุดแล้ว
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("ถามไม่สำเร็จ (error/โยน) = ถามต่อรอบหน้า ไม่ถือว่าจบ", async () => {
    vi.useFakeTimers();
    const fetchStatus = vi
      .fn<() => Promise<"pending" | "done" | "error">>()
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce("error")
      .mockResolvedValue("done");
    const onDone = vi.fn();
    startParsePoller({ fetchStatus, onDone, onTimeout: vi.fn() });
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS * 2);
    expect(onDone).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("เกิน 5 นาที = onTimeout ครั้งเดียว ไม่ใช่ onDone", async () => {
    vi.useFakeTimers();
    const fetchStatus = vi.fn(async () => "pending" as const);
    const onDone = vi.fn();
    const onTimeout = vi.fn();
    startParsePoller({ fetchStatus, onDone, onTimeout });
    await vi.advanceTimersByTimeAsync(PARSE_POLL_MAX_MS + PARSE_POLL_INTERVAL_MS);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    const calls = fetchStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS * 3);
    expect(fetchStatus.mock.calls.length).toBe(calls); // หยุดแล้ว
    expect(calls).toBe(PARSE_POLL_MAX_MS / PARSE_POLL_INTERVAL_MS); // 30 ครั้งใน 5 นาที
  });

  it("หยุดเมื่อ unmount: ไม่ถามและไม่เรียก callback อีก แม้คำตอบค้างอยู่", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((v: "done") => void) | null = null;
    const fetchStatus = vi.fn(() => new Promise<"done">((res) => (resolveFirst = res)));
    const onDone = vi.fn();
    const stop = startParsePoller({ fetchStatus, onDone, onTimeout: vi.fn() });
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    stop(); // ออกจากหน้าระหว่างรอคำตอบ
    resolveFirst!("done");
    await vi.advanceTimersByTimeAsync(PARSE_POLL_INTERVAL_MS * 3);
    expect(onDone).not.toHaveBeenCalled();
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it("หน้า UI: งานจบแต่ยังไม่พบผล · หมดเวลา · ตรวจจาก isParsed หลัง refresh (ตรวจจากไฟล์จริง)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/[game]/stats/matches/[matchId]/ParseRequestPanel.tsx", "utf8");
    expect(src).toContain("งานจบแล้ว แต่ยังไม่พบผลวิเคราะห์ ข้อมูลอาจอัปเดตภายใน 10 นาที");
    expect(src).toContain("router.refresh()");
    expect(src).toContain("isParsed ?"); // ตัดสินจาก isParsed ที่เซิร์ฟเวอร์ส่งใหม่
    expect(src).toContain("stopRef.current?.()"); // หยุดตอน unmount
    expect(src).toContain("กดขอใหม่ได้"); // หมดเวลาแล้วกดใหม่ได้
  });
});
