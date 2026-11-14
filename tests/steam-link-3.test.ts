import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fetchSteamPersona, safeSteamAvatarUrl, STEAM_PERSONA_ENDPOINT } from "@/lib/game-accounts/steam-persona";
import SteamLinkBanner, { shouldShowSteamBanner, STEAM_BANNER_TEXT } from "@/app/me/SteamLinkBanner";

vi.mock("server-only", () => ({}));

// K-AV-STEAMLOGIN.3 — ไม่ยิง Steam จริง (fetch ฉีดเข้าเองทุกข้อ)

const ID = "76561198000000001";
const ENV = { STEAM_API_KEY: "TESTKEY123" };
const AVATAR = "https://avatars.steamstatic.com/abc_full.jpg";
const okBody = (over: Record<string, unknown> = {}) => ({ response: { players: [{ steamid: ID, personaname: "  Ave Player  ", avatarfull: AVATAR, ...over }] } });
const jsonFetch = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("fetchSteamPersona", () => {
  it("สำเร็จ: คืนชื่อ (ตัดช่องว่างหัวท้าย) + รูป · เรียก endpoint ที่ถูกพร้อม steamids", async () => {
    const f = jsonFetch(okBody());
    expect(await fetchSteamPersona(ID, { env: ENV, fetchFn: f })).toEqual({ personaName: "Ave Player", avatarUrl: AVATAR });
    const url = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(url.startsWith(STEAM_PERSONA_ENDPOINT)).toBe(true);
    expect(url).toContain(`steamids=${ID}`);
  });

  it("ไม่มี key → null และไม่เรียก fetch", async () => {
    const f = jsonFetch(okBody());
    expect(await fetchSteamPersona(ID, { env: {}, fetchFn: f })).toBeNull();
    expect(await fetchSteamPersona(ID, { env: { STEAM_API_KEY: "  " }, fetchFn: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("SteamID ผิดรูป → null และไม่เรียก fetch", async () => {
    const f = jsonFetch(okBody());
    expect(await fetchSteamPersona("123&key=x", { env: ENV, fetchFn: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("Steam ตอบ 500 → null", async () => {
    expect(await fetchSteamPersona(ID, { env: ENV, fetchFn: jsonFetch({}, 500) })).toBeNull();
  });

  it("เครือข่ายล้ม (fetch throw) → null ไม่ throw", async () => {
    const f = vi.fn(async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    await expect(fetchSteamPersona(ID, { env: ENV, fetchFn: f })).resolves.toBeNull();
  });

  it("JSON เพี้ยน / ผิดรูป → null", async () => {
    const bad = vi.fn(async () => new Response("<html>oops", { status: 200 })) as unknown as typeof fetch;
    expect(await fetchSteamPersona(ID, { env: ENV, fetchFn: bad })).toBeNull();
    for (const body of [null, {}, { response: {} }, { response: { players: "x" } }, { response: { players: [] } },
      okBody({ steamid: "76561198000000002" }), okBody({ personaname: 42 }), okBody({ personaname: "   " })]) {
      expect(await fetchSteamPersona(ID, { env: ENV, fetchFn: jsonFetch(body) }), JSON.stringify(body)).toBeNull();
    }
  });

  it("หมดเวลา → null (fetch ค้างไม่ตอบ) และสั่ง abort", async () => {
    let signal: AbortSignal | undefined;
    const hang = vi.fn((_u: unknown, init?: RequestInit) => { signal = init?.signal ?? undefined; return new Promise<Response>(() => {}); }) as unknown as typeof fetch;
    expect(await fetchSteamPersona(ID, { env: ENV, fetchFn: hang, timeoutMs: 20 })).toBeNull();
    expect(signal?.aborted).toBe(true);
  });

  it("avatar โดเมนแปลก / ไม่ใช่ https → avatarUrl เป็น null แต่ชื่อยังได้", async () => {
    for (const bad of ["https://evil.example.com/a.jpg", "http://avatars.steamstatic.com/a.jpg", "https://avatars.steamstatic.com.evil.io/a.jpg",
      "https://user@avatars.steamstatic.com/a.jpg", "javascript:alert(1)", 123]) {
      expect(await fetchSteamPersona(ID, { env: ENV, fetchFn: jsonFetch(okBody({ avatarfull: bad })) }), String(bad))
        .toEqual({ personaName: "Ave Player", avatarUrl: null });
    }
    expect(safeSteamAvatarUrl("https://avatars.akamai.steamstatic.com/x.jpg")).toBe("https://avatars.akamai.steamstatic.com/x.jpg");
  });

  it("ไม่ log อะไรเลย (key ไม่หลุดออก console) แม้ตอนล้ม", async () => {
    const spies = (["log", "warn", "error", "info", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    await fetchSteamPersona(ID, { env: ENV, fetchFn: jsonFetch({}, 500) });
    await fetchSteamPersona(ID, { env: ENV, fetchFn: vi.fn(async () => { throw new Error(`boom key=${ENV.STEAM_API_KEY}`); }) as unknown as typeof fetch });
    for (const s of spies) { expect(s).not.toHaveBeenCalled(); s.mockRestore(); }
  });
});

describe("แถบชวนผูก Steam ที่ /me", () => {
  const html = (dota: { verified: boolean; viaSteam: boolean } | null, unavailable = false) =>
    renderToStaticMarkup(createElement(SteamLinkBanner, { dota, unavailable }));

  it("ยังไม่ผูก → แสดงแถบ ปุ่มชี้ /link/steam/start", () => {
    for (const dota of [null, { verified: false, viaSteam: false }, { verified: true, viaSteam: false }]) {
      expect(shouldShowSteamBanner(dota, false)).toBe(true);
      const h = html(dota);
      expect(h).toContain(STEAM_BANNER_TEXT);
      expect(h).toContain('href="/link/steam/start"');
    }
  });

  it("ผูกและยืนยันด้วย Steam แล้ว → ไม่แสดง", () => {
    expect(shouldShowSteamBanner({ verified: true, viaSteam: true }, false)).toBe(false);
    expect(html({ verified: true, viaSteam: true })).toBe("");
  });

  it("อ่าน game_accounts ไม่ได้ → ไม่แสดง", () => {
    expect(html(null, true)).toBe("");
  });

  it("หน้า /me ใส่แถบจากข้อมูล game_accounts (dotaAccount) ไม่ใช่คอลัมน์เก่า", () => {
    const src = readFileSync(join(process.cwd(), "app/me/page.tsx"), "utf8");
    expect(src).toContain("<SteamLinkBanner dota={dotaAccount} unavailable={accError} locale={await getLocale()} />"); // K-AV-R2.6: + locale
  });
});

describe("Q7 · คอลัมน์เก่า users.steam_id / users.dota2_account_id", () => {
  it("ไม่มีโค้ดแอป (app · lib · components) อ่านหรือเขียนคอลัมน์เก่า", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(name) && /\bsteam_id\b|\bdota2_account_id\b/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    for (const d of ["app", "lib", "components"]) walk(join(process.cwd(), d));
    expect(hits).toEqual([]);
  });
});
