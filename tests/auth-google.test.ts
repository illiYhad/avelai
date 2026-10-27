import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// K-AV-AUTH-G: signInWithGoogle — provider · redirectTo (SITE_URL ก่อน) · next ผ่าน safeNext · error เป็นข้อความไทย

const h = vi.hoisted(() => ({
  db: null as null | { auth: { signInWithOAuth: ReturnType<typeof vi.fn> } },
  headers: new Map<string, string>(),
  redirected: null as string | null,
}));

vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => h.headers.get(k) ?? null }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    h.redirected = url;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/lib/db/server", () => ({ getServerDb: async () => h.db }));

import { signInWithGoogle } from "@/app/login/actions";

const fd = (next?: string) => {
  const f = new FormData();
  if (next !== undefined) f.set("next", next);
  return f;
};
const prev = { ok: false, message: "" };
const makeDb = (result: { data: { url: string | null } | null; error: unknown }) => ({ auth: { signInWithOAuth: vi.fn(async () => result) } });
const ORIGINAL_SITE_URL = process.env.SITE_URL;

beforeEach(() => {
  h.db = makeDb({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" }, error: null });
  h.headers = new Map();
  h.redirected = null;
  process.env.SITE_URL = "https://avelai.org/";
});
afterEach(() => {
  if (ORIGINAL_SITE_URL === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = ORIGINAL_SITE_URL;
});

describe("signInWithGoogle", () => {
  it("เรียก signInWithOAuth ด้วย provider google · redirectTo ใช้ SITE_URL + next · แล้ว redirect ไป url ที่ได้", async () => {
    await expect(signInWithGoogle(prev, fd("/mlbb/tournaments"))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.db!.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://avelai.org/auth/callback?next=%2Fmlbb%2Ftournaments" },
    });
    expect(h.redirected).toBe("https://accounts.google.com/o/oauth2/v2/auth?x=1");
  });

  it("SITE_URL ชนะ host header เสมอ (กัน host header poisoning)", async () => {
    h.headers.set("host", "evil.example");
    h.headers.set("x-forwarded-host", "evil.example");
    await expect(signInWithGoogle(prev, fd("/me"))).rejects.toThrow("NEXT_REDIRECT");
    const arg = h.db!.auth.signInWithOAuth.mock.calls[0][0] as { options: { redirectTo: string } };
    expect(arg.options.redirectTo.startsWith("https://avelai.org/")).toBe(true);
    expect(arg.options.redirectTo).not.toContain("evil.example");
  });

  it("next ที่ไม่ปลอดภัยถูก safeNext ตกเป็น /me", async () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", ""]) {
      h.db = makeDb({ data: { url: "https://accounts.google.com/x" }, error: null });
      await expect(signInWithGoogle(prev, fd(bad))).rejects.toThrow("NEXT_REDIRECT");
      const arg = h.db.auth.signInWithOAuth.mock.calls[0][0] as { options: { redirectTo: string } };
      expect(arg.options.redirectTo).toBe("https://avelai.org/auth/callback?next=%2Fme");
    }
  });

  it("ไม่มี next เลย → /me", async () => {
    await expect(signInWithGoogle(prev, fd())).rejects.toThrow("NEXT_REDIRECT");
    const arg = h.db!.auth.signInWithOAuth.mock.calls[0][0] as { options: { redirectTo: string } };
    expect(arg.options.redirectTo).toContain("next=%2Fme");
  });

  it("ไม่มี SITE_URL → fallback จาก header (dev)", async () => {
    delete process.env.SITE_URL;
    h.headers.set("host", "localhost:3000");
    await expect(signInWithGoogle(prev, fd("/me"))).rejects.toThrow("NEXT_REDIRECT");
    const arg = h.db!.auth.signInWithOAuth.mock.calls[0][0] as { options: { redirectTo: string } };
    expect(arg.options.redirectTo).toBe("http://localhost:3000/auth/callback?next=%2Fme");
  });

  it("provider ยังไม่เปิด (error) → ข้อความไทย ไม่สะท้อน error ดิบ · ไม่ redirect", async () => {
    h.db = makeDb({ data: null, error: { message: "Unsupported provider: provider is not enabled", status: 400 } });
    const r = await signInWithGoogle(prev, fd("/me"));
    expect(r.ok).toBe(false);
    expect(r.message).toBe("ล็อกอินด้วย Google ยังไม่เปิดใช้งาน ใช้อีเมลแทนได้");
    expect(r.message).not.toMatch(/provider|Unsupported|400/i);
    expect(h.redirected).toBeNull();
  });

  it("ไม่ได้ url กลับมา → ข้อความไทยเดียวกัน", async () => {
    h.db = makeDb({ data: { url: null }, error: null });
    const r = await signInWithGoogle(prev, fd("/me"));
    expect(r.message).toContain("ยังไม่เปิดใช้งาน");
    expect(h.redirected).toBeNull();
  });

  it("ไม่ต่อ DB → ระบบล็อกอินยังไม่เปิด", async () => {
    h.db = null;
    const r = await signInWithGoogle(prev, fd("/me"));
    expect(r).toEqual({ ok: false, message: "ระบบล็อกอินยังไม่เปิด" });
  });
});
