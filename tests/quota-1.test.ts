import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// K-AV-QUOTA.1: กันโควตา OpenDota + แคชแมตช์ที่วิเคราะห์แล้ว 7 วัน — ห้ามยิงเครือข่ายจริง (fetch mock · next/cache ปลอม)

vi.mock("server-only", () => ({}));
vi.mock("next/cache", async () => (await import("./_fake-next-cache")).fakeNextCache);

import { dayReserve, noteQuotaExceeded, noteQuotaHeaders, quotaLow, resetQuotaState, DEFAULT_DAY_RESERVE, SAVER_MS } from "@/lib/dota/quota";
import { ERR, fetchOpenDota, postOpenDota } from "@/lib/dota/opendota";
import { clearParsedCache, getDotaConstant, getMatchDetail, PARSED_CACHE_KEY, PARSED_REVALIDATE_SEC } from "@/lib/dota/match";
import { mapMatchDetail } from "@/lib/dota/match/map";
import { fakeCacheDefs, fakeCacheStore } from "./_fake-next-cache";

const T0 = Date.parse("2026-11-06T12:00:00Z");
const MATCH = "8214277203";
const QUOTA_MSG = "ข้อมูลแมตช์ใหม่จะอัปเดตอีกครั้งพรุ่งนี้";

const hdrs = (remaining: number | null, dateMs: number | null = T0) => {
  const h = new Headers();
  if (remaining !== null) h.set("X-Rate-Limit-Remaining-Day", String(remaining));
  if (dateMs !== null) h.set("Date", new Date(dateMs).toUTCString());
  return h;
};

const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures-k-av-dotabuff-1.json"), "utf8")) as Record<string, unknown>;
const parsedRaw = { ...fixture, match_id: Number(MATCH), od_data: { has_parsed: true } };
const unparsedRaw = { ...fixture, match_id: Number(MATCH), od_data: { has_parsed: false } };

function mockFetch(body: unknown, opts: { status?: number; headers?: Headers } = {}) {
  return vi.fn(async () => ({
    ok: (opts.status ?? 200) < 300,
    status: opts.status ?? 200,
    headers: opts.headers ?? new Headers(),
    json: async () => body,
  }) as unknown as Response);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  resetQuotaState();
  clearParsedCache();
  fakeCacheStore.clear();
  delete process.env.OPENDOTA_DAY_RESERVE;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("quota.ts (ไม่เรียกเครือข่าย)", () => {
  it("ค่าเผื่อ: ไม่มีหรืออ่านไม่ได้ = 600 · ตั้งเป็นจำนวนเต็มได้", () => {
    expect(DEFAULT_DAY_RESERVE).toBe(600);
    expect(dayReserve({})).toBe(600);
    for (const bad of ["", "abc", "-5", "1.5", " "]) expect(dayReserve({ OPENDOTA_DAY_RESERVE: bad }), bad).toBe(600);
    expect(dayReserve({ OPENDOTA_DAY_RESERVE: "100000" })).toBe(100000);
  });

  it("เหลือ 601 ไม่เข้าโหมด · 600 และ 0 เข้าโหมด", () => {
    noteQuotaHeaders(hdrs(601), T0);
    expect(quotaLow(T0)).toBe(false);
    noteQuotaHeaders(hdrs(600), T0);
    expect(quotaLow(T0)).toBe(true);
    resetQuotaState();
    noteQuotaHeaders(hdrs(0), T0);
    expect(quotaLow(T0)).toBe(true);
  });

  it("header เหลือมากแล้วออกจากโหมด · โหมดหมดเวลาหลัง 15 นาที", () => {
    noteQuotaHeaders(hdrs(10), T0);
    expect(quotaLow(T0 + SAVER_MS - 1)).toBe(true);
    expect(quotaLow(T0 + SAVER_MS)).toBe(false);
    noteQuotaHeaders(hdrs(10), T0);
    noteQuotaHeaders(hdrs(2000), T0 + 1000);
    expect(quotaLow(T0 + 1000)).toBe(false);
  });

  it("Date เก่าเกิน 120 วินาที ไม่เปลี่ยนสถานะ · ไม่มี header ไม่เปลี่ยนสถานะ", () => {
    noteQuotaHeaders(hdrs(0, T0 - 121_000), T0);
    expect(quotaLow(T0)).toBe(false);
    noteQuotaHeaders(hdrs(0, T0 - 120_000), T0); // ห่าง 120 วินาทีพอดี = ยังใช้ได้
    expect(quotaLow(T0)).toBe(true);
    // อยู่ในโหมดแล้ว: header เก่า / ไม่มีตัวนับ / ไม่มี Date / ไม่มี headers เลย ต้องไม่ดึงออกจากโหมด
    noteQuotaHeaders(hdrs(2000, T0 - 600_000), T0);
    noteQuotaHeaders(hdrs(null), T0);
    noteQuotaHeaders(hdrs(2000, null), T0);
    noteQuotaHeaders(undefined, T0);
    expect(quotaLow(T0)).toBe(true);
  });

  it("noteQuotaExceeded เข้าโหมด 15 นาที", () => {
    noteQuotaExceeded(T0);
    expect(quotaLow(T0)).toBe(true);
    expect(quotaLow(T0 + SAVER_MS)).toBe(false);
  });
});

describe("opendota.ts ต่อกับโควตา", () => {
  it("ERR.quotaLow ข้อความตรงตามใบอลิส", () => {
    expect(ERR.quotaLow).toEqual({ ok: false, status: 429, message: QUOTA_MSG });
  });

  it("โควตาเหลือ 600 จากคำตอบจริง → คำขอถัดไปไม่เรียก fetch และคืน ERR.quotaLow", async () => {
    const f = mockFetch({ ok: 1 }, { headers: hdrs(600) });
    vi.stubGlobal("fetch", f);
    expect((await fetchOpenDota("/players/1")).ok).toBe(true);
    expect(await fetchOpenDota("/players/2")).toEqual(ERR.quotaLow);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("โควตาเหลือ 601 → ยังยิงได้", async () => {
    const f = mockFetch({ ok: 1 }, { headers: hdrs(601) });
    vi.stubGlobal("fetch", f);
    await fetchOpenDota("/players/1");
    expect((await fetchOpenDota("/players/2")).ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("โหมดประหยัด: /constants/heroes ยังยิงได้ · POST /request ถูกบล็อก", async () => {
    noteQuotaExceeded(Date.now());
    const f = mockFetch({ "1": { id: 1 } });
    vi.stubGlobal("fetch", f);
    expect((await getDotaConstant("heroes")).ok).toBe(true);
    expect(await postOpenDota(`/request/${MATCH}`)).toEqual(ERR.quotaLow);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/constants/heroes");
  });

  it("เจอ 429 → เข้าโหมด · หลัง 15 นาทีกลับมายิงได้", async () => {
    vi.stubGlobal("fetch", mockFetch(null, { status: 429 }));
    expect(await fetchOpenDota("/players/1")).toEqual(ERR.quotaLow);
    const g = mockFetch({ ok: 1 });
    vi.stubGlobal("fetch", g);
    expect(await fetchOpenDota("/players/1")).toEqual(ERR.quotaLow);
    expect(g).not.toHaveBeenCalled();
    vi.setSystemTime(T0 + SAVER_MS);
    expect((await fetchOpenDota("/players/1")).ok).toBe(true);
    expect(g).toHaveBeenCalledTimes(1);
  });

  it("POST /request ที่ได้ 429 ก็เข้าโหมด", async () => {
    vi.stubGlobal("fetch", mockFetch(null, { status: 429 }));
    expect(await postOpenDota(`/request/${MATCH}`)).toEqual(ERR.quotaLow);
    expect(quotaLow(Date.now())).toBe(true);
  });
});

describe("แคชแมตช์ที่วิเคราะห์แล้ว 7 วัน", () => {
  it("ตั้ง unstable_cache: คีย์มีเลขรุ่น · อายุ 604800 วินาที", () => {
    expect(PARSED_CACHE_KEY).toBe("dota-match-parsed-v1");
    expect(PARSED_REVALIDATE_SEC).toBe(604800);
    expect(fakeCacheDefs).toContainEqual({ keyParts: ["dota-match-parsed-v1"], revalidate: 604800 });
  });

  it("วิเคราะห์แล้ว: เปิดซ้ำที่ 6 วัน 23 ชม. ไม่เรียก fetch (แม้หน่วยความจำว่าง)", async () => {
    const f = mockFetch(parsedRaw);
    vi.stubGlobal("fetch", f);
    const first = await getMatchDetail(MATCH);
    expect(first.ok).toBe(true);
    vi.setSystemTime(T0 + (6 * 24 + 23) * 3600 * 1000);
    clearParsedCache(); // ตัดชั้นหน่วยความจำออก ให้เหลือชั้น unstable_cache
    const again = await getMatchDetail(MATCH);
    expect(again).toEqual(first);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("ยังไม่วิเคราะห์: ไม่ถูกเก็บ ยิงใหม่ทุกครั้ง", async () => {
    const f = mockFetch(unparsedRaw);
    vi.stubGlobal("fetch", f);
    const r = await getMatchDetail(MATCH);
    expect(r.ok && r.data.isParsed).toBe(false);
    await getMatchDetail(MATCH);
    expect(f).toHaveBeenCalledTimes(2);
    expect(fakeCacheStore.size).toBe(0);
  });

  it("ดึงไม่ได้ (502 / 404) ไม่ถูกเก็บ", async () => {
    vi.stubGlobal("fetch", mockFetch(null, { status: 500 }));
    expect(await getMatchDetail(MATCH)).toEqual(ERR.upstream);
    vi.stubGlobal("fetch", mockFetch({ players: "x" }));
    expect(await getMatchDetail(MATCH)).toEqual(ERR.notFound);
    expect(fakeCacheStore.size).toBe(0);
  });

  it("โหมดประหยัด: แมตช์ในแคชเปิดได้โดยไม่ยิง · แมตช์ที่ไม่อยู่ในแคชขึ้น ERR.quotaLow", async () => {
    vi.stubGlobal("fetch", mockFetch(parsedRaw));
    await getMatchDetail(MATCH);
    clearParsedCache();
    noteQuotaExceeded(Date.now());
    const f = mockFetch(parsedRaw);
    vi.stubGlobal("fetch", f);
    expect((await getMatchDetail(MATCH)).ok).toBe(true);
    expect(await getMatchDetail("8214277299")).toEqual(ERR.quotaLow);
    expect(f).not.toHaveBeenCalled();
  });

  it("DotaMatchDetail ผ่าน JSON.parse(JSON.stringify()) แล้วเท่าเดิม และเล็กกว่า 2 MB", () => {
    const d = mapMatchDetail(MATCH, parsedRaw);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    const bytes = Buffer.byteLength(JSON.stringify(d), "utf8");
    console.info(`[K-AV-QUOTA.1] mapped DotaMatchDetail = ${(bytes / 1024).toFixed(1)} KB`);
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });
});
