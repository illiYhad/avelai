import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// K-AV-H2: ทุก app/api/**/route.ts ต้องปฏิเสธคนไม่ล็อกอิน (401/403) หรือถูกปิดด้วย flag (503)
// ยกเว้น GET /api/health (200) · รันในเครื่อง ไม่ต่อ DB/เน็ต · อ่านรายชื่อ route จากโฟลเดอร์จริง
// → route ใหม่ที่ไม่ล็อกจะทำให้เทสตก

const touches = vi.hoisted(() => ({ serviceCreated: 0, serviceUsed: 0, userDbUsed: 0, groq: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
// service-role / anon client ทุกตัวจาก supabase-js: แตะอะไรก็นับ
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    touches.serviceCreated++;
    return new Proxy({}, { get: () => { touches.serviceUsed++; return () => { throw new Error("DB touched"); }; } });
  },
}));
// client ของผู้ใช้ (ssr): ไม่มี session · auth.* ได้ · แตะตาราง/rpc = นับ
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => { touches.userDbUsed++; throw new Error("DB touched"); },
    rpc: () => { touches.userDbUsed++; throw new Error("DB touched"); },
  }),
}));
vi.mock("groq-sdk", () => ({
  default: class { constructor() { touches.groq++; } },
}));

const API_ROOT = path.resolve(__dirname, "../app/api");

function findRoutes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return findRoutes(full);
    return e.name === "route.ts" ? [full] : [];
  });
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const routes = findRoutes(API_ROOT).sort();
const routePath = (f: string) => "/" + path.relative(path.resolve(__dirname, ".."), path.dirname(f)).split(path.sep).join("/");

describe("API auth gate (ไม่มี session)", () => {
  beforeAll(() => {
    vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
    vi.stubEnv("GROQ_API_KEY", "test");
  });

  it("พบ route อย่างน้อย 25 ไฟล์ (กันเทสว่างเปล่า)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(25);
  });

  for (const file of routes) {
    const rel = routePath(file);
    it(`${rel}`, async () => {
      const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
      const exported = METHODS.filter((m) => typeof mod[m] === "function");
      expect(exported.length, `${rel} ไม่ export handler ใดเลย`).toBeGreaterThan(0);

      for (const method of exported) {
        touches.serviceCreated = touches.serviceUsed = touches.userDbUsed = touches.groq = 0;
        const body = method === "GET" ? undefined : "{}";
        const req = new Request(`http://localhost${rel}`, {
          method,
          body,
          headers: { "content-type": "application/json" },
        });
        const ctx = { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) };
        const handler = mod[method] as (r: Request, c: typeof ctx) => Promise<Response>;
        const res = await handler(req, ctx);

        if (rel === "/app/api/health") {
          expect(res.status, `${method} ${rel}`).toBe(200);
          continue;
        }
        expect([401, 403, 503], `${method} ${rel} ตอบ ${res.status}`).toContain(res.status);
        expect(touches.serviceCreated, `${method} ${rel} สร้าง service-role client ก่อนเช็ก auth`).toBe(0);
        expect(touches.serviceUsed, `${method} ${rel} แตะ DB (service) ก่อนเช็ก auth`).toBe(0);
        expect(touches.userDbUsed, `${method} ${rel} แตะ DB (user) ก่อนเช็ก auth`).toBe(0);
        expect(touches.groq, `${method} ${rel} เรียก Groq โดยไม่ล็อกอิน`).toBe(0);
      }
    });
  }
});
