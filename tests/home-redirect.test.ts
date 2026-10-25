import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// K-AV-H5: "/" เป็นทางเข้าเดียว — ไม่ล็อกอิน → /login · ล็อกอินแล้ว → /me · ไม่เหลือลิงก์ตาย

const h = vi.hoisted(() => ({ user: null as { id: string } | null, dbOff: false }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
}));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => (h.dbOff ? null : { auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));

import HomePage from "@/app/page";

async function target(): Promise<string> {
  try {
    await HomePage();
  } catch (e) {
    const m = /^REDIRECT:(.+)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
  throw new Error("ไม่ได้ redirect");
}

beforeEach(() => { h.user = null; h.dbOff = false; });

describe("หน้าแรก /", () => {
  it("ยังไม่ล็อกอิน → /login", async () => { expect(await target()).toBe("/login"); });
  it("ล็อกอินแล้ว → /me", async () => { h.user = { id: "u1" }; expect(await target()).toBe("/me"); });
  it("ยังไม่ต่อ DB (env ไม่ครบ) → /login ไม่ล้ม", async () => { h.dbOff = true; expect(await target()).toBe("/login"); });
});

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === ".next" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

describe("ลิงก์ตาย", () => {
  it("ไม่มี /forgot-password หรือ /register (หน้าแรกเก่า) เหลือใน source", () => {
    const root = path.resolve(__dirname, "..");
    const self = path.resolve(__filename);
    const hits: string[] = [];
    for (const dir of ["app", "components", "lib", "hooks"]) {
      const full = path.join(root, dir);
      if (!fs.existsSync(full)) continue;
      for (const f of sourceFiles(full)) {
        if (path.resolve(f) === self) continue;
        const text = fs.readFileSync(f, "utf8");
        // "/register" ที่เป็นส่วนท้ายของ /tournament/[id]/register เป็นหน้าจริง — ไม่นับ
        if (/["'`]\/forgot-password|href=["']\/register["']|["'`]\/register["'`]/.test(text)) hits.push(path.relative(root, f));
      }
    }
    expect(hits).toEqual([]);
  });
});
