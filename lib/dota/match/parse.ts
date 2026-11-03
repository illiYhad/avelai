// K-AV-D3: ขอให้ OpenDota วิเคราะห์แมตช์ (POST /request/{match_id}) — ส่วน pure อยู่ไฟล์นี้ เทสได้
// ⚠ POST /request นับเป็น 10 ครั้งในเพดานอัตราของ OpenDota จึงต้องกันซ้ำให้แน่น

import { postOpenDota, fetchOpenDota, ERR, type DotaResult } from "@/lib/dota/opendota";

/** เพดานคำขอวิเคราะห์ แยกจากเพดานอ่านข้อมูลทั่วไป (DOTA_USER_LIMIT = 20) */
export const DOTA_PARSE_LIMIT = 3;
/** แมตช์เดียวกันห้ามส่งซ้ำภายใน 5 นาที */
export const PARSE_DEDUPE_MS = 5 * 60 * 1000;

/** ⚠ อยู่ในหน่วยความจำของแต่ละอินสแตนซ์ serverless → กันซ้ำได้เฉพาะในอินสแตนซ์เดียวกัน
 *  ข้ามอินสแตนซ์ยังอาจส่งซ้ำได้ (จดไว้ในใบตอบ · แก้จริงต้องใช้ที่เก็บส่วนกลาง) */
export const parseRequestLog = new Map<string, { at: number; jobId: string | null }>();

/** ถ้าแมตช์นี้เพิ่งถูกขอไปภายใน 5 นาที คืนรายการเดิม · ไม่งั้นคืน null */
export function findRecentParse(
  log: Map<string, { at: number; jobId: string | null }>,
  matchId: string,
  nowMs: number,
  windowMs: number = PARSE_DEDUPE_MS,
): { at: number; jobId: string | null } | null {
  const hit = log.get(matchId);
  if (!hit) return null;
  if (nowMs - hit.at > windowMs) {
    log.delete(matchId);
    return null;
  }
  return hit;
}

/** K-AV-D3.1: บันทึกกันซ้ำเฉพาะคำขอที่ OpenDota รับแล้ว (มี jobId) · ไม่มี jobId = ไม่บันทึก คืน false */
export function rememberParse(
  log: Map<string, { at: number; jobId: string | null }>,
  matchId: string,
  jobId: string | null,
  nowMs: number,
): boolean {
  if (!jobId) return false;
  log.set(matchId, { at: nowMs, jobId });
  return true;
}

/** jobId จากคำตอบของ POST /request — โครงที่ OpenDota ใช้คือ { job: { jobId: number } } */
export function readJobId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const job = (raw as Record<string, unknown>).job;
  const id = job && typeof job === "object" ? (job as Record<string, unknown>).jobId : undefined;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  if (typeof id === "string" && /^\d+$/.test(id)) return id;
  return null;
}

/** OpenDota ตอบ 200 แต่ไม่มี jobId = วิเคราะห์ไม่ได้ · ข้อความต้องตรงตามที่ได้รับจริง
 *  ห้ามเดาว่า "รีเพลย์หมดอายุ" เว้นแต่คำตอบบอกชัด */
export function parseRejectMessage(raw: unknown): string {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = typeof o.error === "string" ? o.error : typeof o.err === "string" ? o.err : null;
  return text
    ? `OpenDota ไม่รับคำขอวิเคราะห์: ${text}`
    : "OpenDota ไม่ได้ให้หมายเลขงานกลับมา จึงยังวิเคราะห์แมตช์นี้ไม่ได้ (ไม่ทราบเหตุผลจากคำตอบ)";
}

export const jobIdPattern = /^\d{1,15}$/;
export const isValidJobId = (v: unknown): v is string => typeof v === "string" && jobIdPattern.test(v);

/** ส่งคำขอวิเคราะห์จริง */
export async function submitParse(matchId: string): Promise<DotaResult<{ jobId: string | null; raw: unknown }>> {
  const r = await postOpenDota(`/request/${matchId}`);
  if (!r.ok) return r;
  return { ok: true, data: { jobId: readJobId(r.data), raw: r.data } };
}

/** ดูสถานะงาน · OpenDota ตอบว่าง/null เมื่องานเสร็จหรือไม่มีงานนั้นแล้ว */
export async function readParseStatus(jobId: string): Promise<DotaResult<{ finished: boolean }>> {
  if (!isValidJobId(jobId)) return ERR.notFound;
  const r = await fetchOpenDota(`/request/${jobId}`, 0);
  if (!r.ok) return r;
  const d = r.data;
  const stillRunning = !!d && typeof d === "object" && Object.keys(d as object).length > 0;
  return { ok: true, data: { finished: !stillRunning } };
}
