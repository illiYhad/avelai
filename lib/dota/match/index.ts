import "server-only";
import { cache } from "react";
import { ERR, fetchMatchRaw, fetchOpenDota, isValidMatchId, type DotaResult } from "@/lib/dota/opendota";
import { mapMatchDetail, type DotaMatchDetail } from "@/lib/dota/match/map";

// K-AV-D3: ชั้นข้อมูลแมตช์ Dota 2 — ใช้ client ของ lib/dota/opendota.ts ตัวเดิม
// ไม่เขียนการจัดการ error ใหม่ · ห้ามส่ง JSON ดิบออกไป client component
// ห้ามมี fallback: ดึงไม่ได้ = คืน DotaError ไม่ใช่ข้อมูลแต่ง

export const PARSED_TTL_MS = 24 * 60 * 60 * 1000; // แมตช์ที่วิเคราะห์แล้วไม่เปลี่ยนอีก → 24 ชม.
export const UNPARSED_REVALIDATE_SEC = 600; // ยังไม่วิเคราะห์ → 10 นาที (ผ่านแคชข้อมูลของ Next)
const PARSED_CACHE_MAX = 200; // กันหน่วยความจำบวมในอินสแตนซ์เดียว

/**
 * วิธีแคชที่เลือก (อธิบายไว้ในใบตอบ K-AV-D3):
 * ตัวตอบของ /matches/{id} หนักราว 240 KB ต่อแมตช์ และเราไม่รู้ว่า "วิเคราะห์แล้วหรือยัง"
 * จนกว่าจะอ่านคำตอบ จึงตั้ง revalidate ของ fetch ล่วงหน้าตามสถานะไม่ได้
 * ทางที่ใช้: ให้ fetch ใช้ 10 นาทีเสมอ (ชั้นแคชข้อมูลของ Next · เล็กกว่าเพดาน 2 MB ต่อรายการ)
 * แล้วเก็บ "ผลที่ map แล้ว" ของแมตช์ที่วิเคราะห์แล้วไว้ในหน่วยความจำ 24 ชม. อีกชั้น
 * ผลที่ map แล้วมีขนาดไม่กี่ KB จึงไม่ชนเพดานขนาดแคช
 * ข้อจำกัด: ชั้น 24 ชม. อยู่ในหน่วยความจำของแต่ละอินสแตนซ์ serverless (ไม่ข้ามอินสแตนซ์)
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

async function loadMatchDetail(matchId: string): Promise<DotaResult<DotaMatchDetail>> {
  if (!isValidMatchId(matchId)) return ERR.notFound;

  const now = Date.now();
  const cached = readParsedCache(matchId, now);
  if (cached) return { ok: true, data: cached };

  const r = await fetchMatchRaw(matchId, UNPARSED_REVALIDATE_SEC);
  if (!r.ok) return r;
  // ตอบ 200 แต่ไม่มี players = ไม่ใช่แมตช์ที่ใช้ได้
  const raw = r.data as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.players)) return ERR.notFound;

  const data = mapMatchDetail(matchId, raw);
  if (data.isParsed) writeParsedCache(matchId, data, now);
  return { ok: true, data };
}

/** รายละเอียดแมตช์ที่ map แล้ว · cache() ของ React ทำให้ layout กับ page ใน request เดียวกันยิงครั้งเดียว */
export const getMatchDetail = cache(loadMatchDetail);

// ---------- ค่าคงที่ ----------

/** allowlist เท่านั้น — ห้ามรับชื่อ resource จากผู้ใช้ */
export const DOTA_CONSTANTS = ["heroes", "items", "abilities", "hero_abilities"] as const;
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
