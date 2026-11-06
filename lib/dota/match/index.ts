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
 * แล้วเก็บ "ผลที่ map แล้ว" ของแมตช์ที่วิเคราะห์แล้วไว้ในหน่วยความจำ 24 ชม. อีกชั้น
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

/** ผลที่ห้ามเก็บในแคช 7 วัน (ยังไม่วิเคราะห์ · ดึงไม่ได้ · โหมดประหยัด) — โยนออกจาก unstable_cache แล้วคืนค่าเดิมนอกแคช
 *  unstable_cache ไม่เก็บผลเมื่อฟังก์ชันข้างใน throw */
class NotCacheable extends Error {
  constructor(readonly result: DotaResult<DotaMatchDetail>) {
    super("not-cacheable");
  }
}

async function fetchParsedOrThrow(matchId: string): Promise<DotaMatchDetail> {
  const r = await fetchMatchRaw(matchId, UNPARSED_REVALIDATE_SEC);
  if (!r.ok) throw new NotCacheable(r);
  // ตอบ 200 แต่ไม่มี players = ไม่ใช่แมตช์ที่ใช้ได้
  const raw = r.data as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.players)) throw new NotCacheable(ERR.notFound);
  const data = mapMatchDetail(matchId, raw);
  if (!data.isParsed) throw new NotCacheable({ ok: true, data }); // ยังไม่วิเคราะห์ → อายุ 10 นาทีตามเดิม (แคชของ fetch)
  return data;
}

/** K-AV-QUOTA.1: แมตช์ที่วิเคราะห์แล้วเก็บ 7 วัน · โหมดประหยัด: อยู่ในแคช = เปิดได้โดยไม่ยิง OpenDota */
const cachedParsedMatch = unstable_cache(fetchParsedOrThrow, [PARSED_CACHE_KEY], { revalidate: PARSED_REVALIDATE_SEC });

async function loadMatchDetail(matchId: string): Promise<DotaResult<DotaMatchDetail>> {
  if (!isValidMatchId(matchId)) return ERR.notFound;

  const cached = readParsedCache(matchId, Date.now());
  if (cached) return { ok: true, data: cached };

  try {
    const data = await cachedParsedMatch(matchId);
    writeParsedCache(matchId, data, Date.now());
    return { ok: true, data };
  } catch (e) {
    if (e instanceof NotCacheable) return e.result;
    return ERR.upstream; // ห้ามมี fallback: ผิดพลาดอื่น = ดึงไม่ได้
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
