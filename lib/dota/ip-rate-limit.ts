import { createHash } from "node:crypto";

// K-AV-D3: เพดานต่อ IP สำหรับหน้าแมตช์สาธารณะ (ไม่ต้องล็อกอิน)
// ⚠ ห้ามเก็บ IP ลงฐานข้อมูลหรือ log — เก็บเฉพาะค่าแฮชไว้ในหน่วยความจำของอินสแตนซ์
//   แฮชมีเกลือต่อการรันหนึ่งครั้ง จึงย้อนกลับเป็น IP ไม่ได้ และหายไปเมื่ออินสแตนซ์จบ
// ⚠ ตัวนับอยู่ในหน่วยความจำ → ไม่เข้มงวดข้ามอินสแตนซ์ (เหมือน lib/dota/user-rate-limit.ts)
//
// K-AV-D3 (แก้ตามผลตรวจความปลอดภัยอัตโนมัติ 2026-11-02):
//  1) ห้ามเชื่อค่าซ้ายสุดของ x-forwarded-for เพราะผู้เรียกใส่เองได้ → ปลอมคีย์ไม่จำกัดเพื่อข้ามเพดาน
//     ใช้ค่าที่แพลตฟอร์มเป็นคนใส่ก่อน (x-vercel-forwarded-for · x-real-ip) แล้วค่อยถอยไป
//     ค่า "ขวาสุด" ของ x-forwarded-for ซึ่งเป็นช่วงที่ proxy ที่เราเชื่อถือเติมเข้ามา
//  2) จำกัดจำนวนคีย์และกวาดคีย์หมดอายุแบบเดียวกับ lib/obs/rate-limit.ts กัน map โตไม่หยุด

export const DOTA_PUBLIC_IP_LIMIT = 30;
export const IP_WINDOW_MS = 60 * 1000;
export const IP_LOG_MAX_KEYS = 5000;

/** เกลือสุ่มต่อการรันหนึ่งครั้ง — ทำให้ค่าแฮชเทียบข้ามการรันไม่ได้ */
const SALT = createHash("sha256").update(String(Math.random()) + String(process.pid)).digest("hex");

/** คีย์ที่ใช้นับ = แฮชของ IP ไม่ใช่ IP · คืน 16 ตัวอักษรพอให้ชนกันยาก */
export function ipKey(ip: string | null | undefined): string {
  return createHash("sha256").update(SALT).update(ip ?? "unknown").digest("hex").slice(0, 16);
}

/**
 * IP ของผู้เรียก โดยเอาค่าที่ปลอมยากที่สุดก่อน
 * - `x-vercel-forwarded-for` / `x-real-ip` แพลตฟอร์มเป็นคนเขียนทับให้ ผู้เรียกปลอมไม่ได้
 * - ถ้าเหลือแค่ `x-forwarded-for` ให้ใช้ **ค่าขวาสุด** (ช่วงที่ proxy ที่เราเชื่อถือเติมล่าสุด)
 *   ไม่ใช่ค่าซ้ายสุดซึ่งผู้เรียกใส่มาเองได้
 * ใช้เพื่อคิดคีย์แฮชทันที ไม่เก็บค่าดิบไว้ที่ไหน
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const platform = headers.get("x-vercel-forwarded-for")?.trim() || headers.get("x-real-ip")?.trim();
  if (platform) return platform.slice(0, 64);
  const hops = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const lastHop = hops[hops.length - 1];
  return lastHop ? lastHop.slice(0, 64) : null;
}

export const publicMatchIpLog = new Map<string, number[]>();

/** ตัดคีย์ที่ไม่มีคำขอในหน้าต่างแล้ว (กัน map โตไม่หยุดจากคีย์ที่ถูกสร้างรัว ๆ) */
export function pruneIpLog(log: Map<string, number[]>, nowMs: number, windowMs: number = IP_WINDOW_MS): void {
  for (const [k, ts] of log) {
    if (!ts.some((t) => t > nowMs - windowMs && t <= nowMs)) log.delete(k);
  }
}

/** true = ให้ผ่าน (และนับครั้งนี้) · false = เกิน 30 ครั้งในหน้าต่าง 1 นาที */
export function allowIp(
  log: Map<string, number[]>,
  key: string,
  nowMs: number,
  limit: number = DOTA_PUBLIC_IP_LIMIT,
  windowMs: number = IP_WINDOW_MS,
): boolean {
  if (log.size >= IP_LOG_MAX_KEYS && !log.has(key)) pruneIpLog(log, nowMs, windowMs);
  const recent = (log.get(key) ?? []).filter((t) => t > nowMs - windowMs && t <= nowMs);
  if (recent.length >= limit) {
    log.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  log.set(key, recent);
  return true;
}

/** ตรวจเพดานของคำขอหนึ่งครั้ง — รวม "อ่าน IP → แฮช → นับเวลา" ไว้ในฟังก์ชันเดียว
 *  แยกออกมาจาก component เพื่อไม่ให้เรียก Date.now() ในช่วง render (กฎ lint ของ Next) */
export function allowPublicMatchView(headers: { get(name: string): string | null }): boolean {
  return allowIp(publicMatchIpLog, ipKey(clientIpFrom(headers)), Date.now());
}
