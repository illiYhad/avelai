import { createHash } from "node:crypto";
import { isIP } from "node:net";

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
//
// K-AV-D3 (แก้ตามผลตรวจความปลอดภัยอัตโนมัติรอบสอง):
//  3) เพดานคีย์เดิม "กวาดแล้วแต่ยังเต็ม" ก็ยังใส่คีย์ใหม่ลงไปอยู่ดี → ทะลุเพดานได้
//     ตอนนี้ไล่ทิ้งคีย์เก่าสุดจนต่ำกว่าเพดานก่อนเสมอ หน่วยความจำจึงมีขอบเขตแน่นอน
//  4) เดิมกวาดทุกครั้งที่มีคีย์ใหม่ตอน map เต็ม = ไล่ทั้ง 5000 รายการต่อหนึ่งคำขอ
//     ตอนนี้กวาดอย่างมากหนึ่งครั้งต่อหน้าต่างเวลา
//  5) IPv6 หนึ่งเครื่องมักถือทั้งช่วง /64 → นับรายที่อยู่เลี่ยงเพดานได้ง่าย จึงยุบเหลือ /64 ก่อนแฮช

export const DOTA_PUBLIC_IP_LIMIT = 30;
export const IP_WINDOW_MS = 60 * 1000;
export const IP_LOG_MAX_KEYS = 5000;

/** เกลือสุ่มต่อการรันหนึ่งครั้ง — ทำให้ค่าแฮชเทียบข้ามการรันไม่ได้ */
const SALT = createHash("sha256").update(String(Math.random()) + String(process.pid)).digest("hex");

/** ยุบที่อยู่ให้เป็นหน่วยที่ควรนับร่วมกัน
 *  IPv6: เครื่องเดียวมักได้ทั้งช่วง /64 ถ้านับรายที่อยู่จะเลี่ยงเพดานได้ง่าย → เหลือ 4 กลุ่มแรก
 *  IPv4: นับรายที่อยู่ตามเดิม
 *
 *  K-AV-D3 (แก้ตามผลตรวจความปลอดภัยอัตโนมัติรอบสาม):
 *  ของเดิมแยกสายด้วย regex อย่างเดียว ทำให้ `::ffff:203.0.113.9` (IPv4 ที่ห่อมาในรูป IPv6
 *  ซึ่ง socket แบบ dual-stack ของ Node ส่งมาแบบนี้เป็นปกติ) ตกเข้าสาย IPv6 แล้วถูกยุบเป็น
 *  `0:0:0:0::/64` **ทุกที่อยู่** → ผู้ชม IPv4 ทุกคนใช้ถังเดียวกัน คนเดียวยิงครบ 30 ครั้ง
 *  ก็ล็อกคนอื่นทั้งหมด ตอนนี้ใช้ `net.isIP` ตัดสินชนิดจริง และดึง IPv4 ที่ฝังมาออกก่อนยุบ */
export function ipBucket(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  let v = ip.trim().replace(/%.*$/, ""); // ตัด zone id ของ IPv6
  const bracketed = v.match(/^\[(.+)\](?::\d+)?$/); // [2001:db8::1]:443
  if (bracketed) v = bracketed[1];

  // IPv4 (ตัดพอร์ตถ้ามี) — ต้องเช็กก่อน เพราะมี ":" ได้
  const withPort = v.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (withPort && isIP(withPort[1]) === 4) return withPort[1];
  if (isIP(v) === 4) return v;

  // อ่านไม่ออกว่าเป็นที่อยู่อะไร = นับตามตัวอักษรไปเลย ไม่เดาและไม่ยุบรวมกับใคร
  if (isIP(v) !== 6) return v.slice(0, 64) || "unknown";

  // IPv4 ที่ฝังมาในรูป IPv6 (`::ffff:1.2.3.4` · `::1.2.3.4`) = เครื่อง IPv4 จริง ๆ
  // ต้องนับรายที่อยู่ ห้ามยุบเป็น /64 ไม่งั้นทุกคนชนถังเดียวกัน
  const embedded = v.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded && isIP(embedded[1]) === 4) return embedded[1];

  const [head, tail = ""] = v.split("::");
  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean) : [];
  const fill = v.includes("::") ? Array(Math.max(0, 8 - headParts.length - tailParts.length)).fill("0") : [];
  const groups = [...headParts, ...fill, ...tailParts].slice(0, 4);
  while (groups.length < 4) groups.push("0");
  return `${groups.map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** คีย์ที่ใช้นับ = แฮชของช่วงที่อยู่ ไม่ใช่ IP · คืน 16 ตัวอักษรพอให้ชนกันยาก */
export function ipKey(ip: string | null | undefined): string {
  return createHash("sha256").update(SALT).update(ipBucket(ip)).digest("hex").slice(0, 16);
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

/** เวลาที่กวาดครั้งล่าสุด — กวาดอย่างมากหนึ่งครั้งต่อหน้าต่าง ไม่ใช่ทุกคำขอ */
let lastPruneAt = Number.NEGATIVE_INFINITY;

/** export ไว้ให้เทสรีเซ็ต */
export function resetPruneClock() {
  lastPruneAt = Number.NEGATIVE_INFINITY;
}

/** บังคับเพดานให้ได้จริง: กวาดของหมดอายุก่อน ถ้ายังเต็มให้ทิ้งคีย์เก่าสุดตามลำดับที่ใส่เข้ามา
 *  เลือก "ทิ้งของเก่า" แทน "ปฏิเสธคีย์ใหม่" เพราะหน้านี้เปิดสาธารณะ — ถ้าปฏิเสธ
 *  ผู้ชมหน้าใหม่จะเข้าไม่ได้ทันทีที่มีคนใช้งานพร้อมกันครบเพดาน กลายเป็นปฏิเสธบริการเสียเอง
 *  ผลเสียของการทิ้ง: ช่วงที่คนใช้พร้อมกันเกิน 5000 กลุ่ม ตัวนับของกลุ่มเก่าสุดจะถูกรีเซ็ต
 *  แต่หน่วยความจำมีขอบเขตแน่นอน ซึ่งสำคัญกว่าในเคสนี้ */
function enforceCap(log: Map<string, number[]>, nowMs: number, windowMs: number): void {
  if (nowMs - lastPruneAt >= windowMs) {
    pruneIpLog(log, nowMs, windowMs);
    lastPruneAt = nowMs;
  }
  while (log.size >= IP_LOG_MAX_KEYS) {
    const oldest = log.keys().next();
    if (oldest.done) break;
    log.delete(oldest.value);
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
  if (!log.has(key)) enforceCap(log, nowMs, windowMs);
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
