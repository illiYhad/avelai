import { createHash } from "node:crypto";

// K-AV-D3: เพดานต่อ IP สำหรับหน้าแมตช์สาธารณะ (ไม่ต้องล็อกอิน)
// ⚠ ห้ามเก็บ IP ลงฐานข้อมูลหรือ log — เก็บเฉพาะค่าแฮชไว้ในหน่วยความจำของอินสแตนซ์
//   แฮชมีเกลือต่อการรันหนึ่งครั้ง จึงย้อนกลับเป็น IP ไม่ได้ และหายไปเมื่ออินสแตนซ์จบ
// ⚠ ตัวนับอยู่ในหน่วยความจำ → ไม่เข้มงวดข้ามอินสแตนซ์ (เหมือน lib/dota/user-rate-limit.ts)

export const DOTA_PUBLIC_IP_LIMIT = 30;
export const IP_WINDOW_MS = 60 * 1000;

/** เกลือสุ่มต่อการรันหนึ่งครั้ง — ทำให้ค่าแฮชเทียบข้ามการรันไม่ได้ */
const SALT = createHash("sha256").update(String(Math.random()) + String(process.pid)).digest("hex");

/** คีย์ที่ใช้นับ = แฮชของ IP ไม่ใช่ IP · คืน 16 ตัวอักษรพอให้ชนกันยาก */
export function ipKey(ip: string | null | undefined): string {
  return createHash("sha256").update(SALT).update(ip ?? "unknown").digest("hex").slice(0, 16);
}

/** อ่าน IP จาก header ของ proxy · ใช้เพื่อคิดคีย์แฮชทันที ไม่เก็บค่าดิบไว้ที่ไหน */
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

export const publicMatchIpLog = new Map<string, number[]>();

/** true = ให้ผ่าน (และนับครั้งนี้) · false = เกิน 30 ครั้งในหน้าต่าง 1 นาที */
export function allowIp(
  log: Map<string, number[]>,
  key: string,
  nowMs: number,
  limit: number = DOTA_PUBLIC_IP_LIMIT,
  windowMs: number = IP_WINDOW_MS,
): boolean {
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
