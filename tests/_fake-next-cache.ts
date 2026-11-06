// K-AV-QUOTA.1: unstable_cache ปลอมสำหรับเทส (ของจริงต้องมี incrementalCache ของ Next จึงรันใน vitest ไม่ได้)
// พฤติกรรมที่เลียน: เก็บผลแบบ JSON ตามคีย์ (keyParts + อาร์กิวเมนต์) · อายุตาม revalidate · ฟังก์ชันข้างใน throw = ไม่เก็บ
// ใช้: vi.mock("next/cache", async () => (await import("./_fake-next-cache")).fakeNextCache)

type Fn = (...args: never[]) => Promise<unknown>;

export const fakeCacheStore = new Map<string, { at: number; json: string }>();
/** ทุกครั้งที่โมดูลเรียก unstable_cache (ตอนโหลด) — ใช้ตรวจคีย์และอายุที่ตั้ง */
export const fakeCacheDefs: { keyParts: string[]; revalidate: unknown }[] = [];

// K-AV-QUOTA.1a: Next จริงตั้ง fetch ใน callback ของ unstable_cache เป็น force-no-store (patch-fetch.js 354–358)
// จึงต้องรู้ว่า fetch ถูกเรียกขณะอยู่ใน callback หรือไม่ · นับซ้อนได้
let callbackDepth = 0;
/** true = ตอนนี้อยู่ใน callback ของ unstable_cache ปลอม */
export function fakeInCacheCallback(): boolean {
  return callbackDepth > 0;
}

function unstable_cache<T extends Fn>(cb: T, keyParts: string[] = [], opts: { revalidate?: number | false } = {}): T {
  fakeCacheDefs.push({ keyParts, revalidate: opts.revalidate });
  return (async (...args: never[]) => {
    const key = JSON.stringify([keyParts, args]);
    const hit = fakeCacheStore.get(key);
    const ttlMs = typeof opts.revalidate === "number" ? opts.revalidate * 1000 : Infinity;
    if (hit && Date.now() - hit.at < ttlMs) return JSON.parse(hit.json);
    callbackDepth++;
    let value: unknown;
    try {
      value = await cb(...args);
    } finally {
      callbackDepth--;
    }
    fakeCacheStore.set(key, { at: Date.now(), json: JSON.stringify(value) });
    return value;
  }) as T;
}

export const fakeNextCache = { unstable_cache, revalidatePath: () => {}, revalidateTag: () => {} };
