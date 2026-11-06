import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { ERR, fetchMatchRaw, fetchOpenDota, isValidMatchId, type DotaResult } from "@/lib/dota/opendota";
import { mapMatchDetail, type DotaMatchDetail } from "@/lib/dota/match/map";

// K-AV-D3: ชั้นข้อมูลแมตช์ Dota 2 — ใช้ client ของ lib/dota/opendota.ts ตัวเดิม
// ไม่เขียนการจัดการ error ใหม่ · ห้ามส่ง JSON ดิบออกไป client component
// ห้ามมี fallback: ดึงไม่ได้ = คืน DotaError ไม่ใช่ข้อมูลแต่ง

export const PARSED_TTL_MS = 7 * 24 * 60 * 60 * 1000; // K-AV-QUOTA.1: แมตช์ที่วิเคราะห์แล้วไม่เปลี่ยนอีก → 7 วัน (เดิม 24 ชม.)
/** K-AV-QUOTA.1: แคชข้อมูลของ Next สำหรับแมตช์ที่วิเคราะห์แล้ว · อยู่ข้ามอินสแตนซ์และข้าม deploy */
export const PARSED_REVALIDATE_SEC = 604800; // 7 วัน
/** เลขรุ่นอยู่ในคีย์ เพราะแคชนี้อยู่ข้าม deploy — โครง DotaMatchDetail เปลี่ยนเมื่อไร ต้องเปลี่ยนเลข */
export const PARSED_CACHE_KEY = "dota-match-parsed-v1";
export const UNPARSED_REVALIDATE_SEC = 600; // ยังไม่วิเคราะห์ → 10 นาที (ผ่านแคชข้อมูลของ Next)
const PARSED_CACHE_MAX = 200; // กันหน่วยความจำบวมในอินสแตนซ์เดียว

/**
 * วิธีแคชที่เลือก (อธิบายไว้ในใบตอบ K-AV-D3):
 * ตัวตอบของ /matches/{id} หนักราว 240 KB ต่อแมตช์ และเราไม่รู้ว่า "วิเคราะห์แล้วหรือยัง"
 * จนกว่าจะอ่านคำตอบ จึงตั้ง revalidate ของ fetch ล่วงหน้าตามสถานะไม่ได้
 * ทางที่ใช้: ให้ fetch ใช้ 10 นาทีเสมอ (ชั้นแคชข้อมูลของ Next · เล็กกว่าเพดาน 2 MB ต่อรายการ)
 * K-AV-QUOTA.1a: fetch นี้ต้องอยู่นอก callback ของ unstable_cache — ข้างในนั้น Next บังคับ force-no-store
 * (next/dist/server/lib/patch-fetch.js) เลข 10 นาทีจะไม่มีผล
 * แล้วเก็บ "ผลที่ map แล้ว" ของแมตช์ที่วิเคราะห์แล้วไว้ในหน่วยความจำอีกชั้น (เดิม 24 ชม. · K-AV-QUOTA.1 เป็น 7 วัน)
 * ผลที่ map แล้วมีขนาดไม่กี่ KB จึงไม่ชนเพดานขนาดแคช
 * ข้อจำกัด: ชั้นหน่วยความจำอยู่ในแต่ละอินสแตนซ์ serverless (ไม่ข้ามอินสแตนซ์)
 * K-AV-QUOTA.1: เพิ่มชั้น unstable_cache 7 วันที่อยู่ข้ามอินสแตนซ์ (ดู cachedParsedMatch) · หน่วยความจำเปลี่ยนเป็น 7 วันด้วย
 */
type Entry = { at: number; data: DotaMatchDetail };
const parsedCache = new Map<string, Entry>();

/** export ไว้ให้เทสล้างสถานะ — ไม่ได้ใช้ในโค้ดหน้าเว็บ */
export function clearParsedCache() {
  parsedCache.clear();
}

function readParsedCache(matchId: string, nowMs: number): DotaMatchDetail | null {
  const hit = parsedCache.get(matchId);
  if (!hit) return null;
  if (nowMs - hit.at > PARSED_TTL_MS) {
    parsedCache.delete(matchId);
    return null;
  }
  return hit.data;
}

function writeParsedCache(matchId: string, data: DotaMatchDetail, nowMs: number) {
  if (parsedCache.size >= PARSED_CACHE_MAX) {
    const oldest = parsedCache.keys().next();
    if (!oldest.done) parsedCache.delete(oldest.value);
  }
  parsedCache.set(matchId, { at: nowMs, data });
}

/** ผลที่ห้ามเก็บในแคช 7 วัน (ยังไม่วิเคราะห์ · ดึงไม่ได้ · โหมดประหยัด) — คืนค่าเดิมโดยไม่ผ่าน unstable_cache */
class NotCacheable extends Error {
  constructor(readonly result: DotaResult<DotaMatchDetail>) {
    super("not-cacheable");
  }
}

/** callback ของ unstable_cache ไม่มีของให้เก็บ → throw (unstable_cache ไม่เก็บผลเมื่อ callback throw) */
class CacheMiss extends Error {
  constructor() {
    super("cache-miss");
  }
}

/** K-AV-QUOTA.1a: ผลที่ map แล้วซึ่งรอส่งเข้า unstable_cache · มีอยู่แค่ช่วงสั้น ๆ ระหว่าง storeParsed */
const pendingStore = new Map<string, DotaMatchDetail>();

/** callback อ่านอย่างเดียว ห้ามยิงเครือข่าย — ใน callback นี้ Next ตั้ง fetch เป็น force-no-store
 *  มีของรอเก็บ (มาจาก storeParsed) = คืนเพื่อให้ unstable_cache เก็บ · ไม่มี = CacheMiss */
async function parsedFromPending(matchId: string): Promise<DotaMatchDetail> {
  const data = pendingStore.get(matchId);
  if (!data) throw new CacheMiss();
  return data;
}

/** K-AV-QUOTA.1: แมตช์ที่วิเคราะห์แล้วเก็บ 7 วัน · โหมดประหยัด: อยู่ในแคช = เปิดได้โดยไม่ยิง OpenDota */
const cachedParsedMatch = unstable_cache(parsedFromPending, [PARSED_CACHE_KEY], { revalidate: PARSED_REVALIDATE_SEC });

/** อ่านแคช 7 วัน · ไม่มี = null (ไม่ยิงเครือข่าย) */
async function readParsedStore(matchId: string): Promise<DotaMatchDetail | null> {
  try {
    return await cachedParsedMatch(matchId);
  } catch (e) {
    if (e instanceof CacheMiss) return null;
    throw e;
  }
}

/** ส่งผลที่ map แล้วเข้า unstable_cache ตัวเดิม (คีย์เดียวกับตอนอ่าน) */
async function storeParsed(matchId: string, data: DotaMatchDetail): Promise<void> {
  pendingStore.set(matchId, data);
  try {
    await cachedParsedMatch(matchId);
  } finally {
    pendingStore.delete(matchId);
  }
}

/** ยิง OpenDota นอก unstable_cache → revalidate 10 นาทีของ fetch มีผลจริง (แมตช์ยังไม่วิเคราะห์เปิดซ้ำไม่ยิง) */
async function fetchAndMap(matchId: string): Promise<DotaMatchDetail> {
  const r = await fetchMatchRaw(matchId, UNPARSED_REVALIDATE_SEC);
  if (!r.ok) throw new NotCacheable(r);
  // ตอบ 200 แต่ไม่มี players = ไม่ใช่แมตช์ที่ใช้ได้
  const raw = r.data as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.players)) throw new NotCacheable(ERR.notFound);
  return mapMatchDetail(matchId, raw);
}

async function loadMatchDetail(matchId: string): Promise<DotaResult<DotaMatchDetail>> {
  if (!isValidMatchId(matchId)) return ERR.notFound;

  const cached = readParsedCache(matchId, Date.now());
  if (cached) return { ok: true, data: cached };

  try {
    const stored = await readParsedStore(matchId);
    if (stored) {
      writeParsedCache(matchId, stored, Date.now());
      return { ok: true, data: stored };
    }
    const data = await fetchAndMap(matchId);
    if (!data.isParsed) return { ok: true, data }; // ยังไม่วิเคราะห์ → ไม่เข้าแคช 7 วัน · อายุ 10 นาทีอยู่ที่แคชของ fetch
    await storeParsed(matchId, data);
    writeParsedCache(matchId, data, Date.now());
    return { ok: true, data };
  } catch (e) {
    if (e instanceof NotCacheable) return e.result;
    // ห้ามมี fallback: ผิดพลาดอื่น = ดึงไม่ได้ · log แค่ชื่อ error + matchId (ห้าม log ข้อมูลแมตช์หรือ key)
    console.error(`[dota/match] ${e instanceof Error ? e.name : typeof e} matchId=${matchId}`);
    return ERR.upstream;
  }
}

/** รายละเอียดแมตช์ที่ map แล้ว · cache() ของ React ทำให้ layout กับ page ใน request เดียวกันยิงครั้งเดียว */
export const getMatchDetail = cache(loadMatchDetail);

// ---------- ค่าคงที่ ----------

/** allowlist เท่านั้น — ห้ามรับชื่อ resource จากผู้ใช้ */
export const DOTA_CONSTANTS = ["heroes", "items", "abilities", "hero_abilities", "ability_ids", "permanent_buffs"] as const; // ใบ 28 รายการ (2026-11-06) เพิ่ม 2 ตัวท้าย
export type DotaConstantName = (typeof DOTA_CONSTANTS)[number];

export function isDotaConstant(v: unknown): v is DotaConstantName {
  return typeof v === "string" && (DOTA_CONSTANTS as readonly string[]).includes(v);
}

const CONSTANT_REVALIDATE_SEC = 86400; // 24 ชม.

export async function getDotaConstant(resource: DotaConstantName): Promise<DotaResult<unknown>> {
  if (!isDotaConstant(resource)) return ERR.notFound;
  return fetchOpenDota(`/constants/${resource}`, CONSTANT_REVALIDATE_SEC);
}

export type { DotaMatchDetail, DotaMatchDetailPlayer } from "@/lib/dota/match/map";
export { regionLabel } from "@/lib/dota/match/map";
