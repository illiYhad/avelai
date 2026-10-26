import { describe, it, expect } from "vitest";
import { metadataBaseFrom, resolveSiteOrigin } from "@/lib/auth/site-origin";

// K-AV-H8: ที่มาของ origin ลิงก์ล็อกอิน — production จริงต้องมี SITE_URL https ไม่งั้นไม่ส่งลิงก์ (fail-closed)

describe("resolveSiteOrigin", () => {
  it("SITE_URL https → ใช้เฉพาะ origin (ตัด / ท้าย · path · query)", () => {
    expect(resolveSiteOrigin({ siteUrl: "https://avelai.org/", vercelEnv: "production" })).toBe("https://avelai.org");
    expect(resolveSiteOrigin({ siteUrl: "https://avelai.org/some/path?x=1#y", vercelEnv: "production" })).toBe("https://avelai.org");
  });

  it("SITE_URL https ใช้ก่อน host ของ request เสมอ (กัน host header poisoning)", () => {
    expect(resolveSiteOrigin({ siteUrl: "https://avelai.org", vercelEnv: "preview", host: "evil.example", proto: "https" })).toBe("https://avelai.org");
  });

  it("production ไม่ตั้ง SITE_URL → null", () => {
    expect(resolveSiteOrigin({ vercelEnv: "production", host: "avelai.org", proto: "https" })).toBeNull();
    expect(resolveSiteOrigin({ siteUrl: "", vercelEnv: "production", host: "avelai.org" })).toBeNull();
  });

  it("production ตั้ง SITE_URL แต่ไม่ใช่ https → ถือว่าไม่ตั้ง → null", () => {
    expect(resolveSiteOrigin({ siteUrl: "http://avelai.org", vercelEnv: "production", host: "avelai.org" })).toBeNull();
  });

  it("production ตั้ง SITE_URL เพี้ยน (ไม่ใช่ URL) → null", () => {
    expect(resolveSiteOrigin({ siteUrl: "avelai.org", vercelEnv: "production", host: "avelai.org" })).toBeNull();
    expect(resolveSiteOrigin({ siteUrl: "not a url", vercelEnv: "production" })).toBeNull();
  });

  it("Preview ไม่ตั้ง SITE_URL → fallback host ของ request (แอนดี้ล็อกอินบน Preview ได้)", () => {
    expect(resolveSiteOrigin({ vercelEnv: "preview", host: "avelai-git-x.vercel.app", proto: "https" })).toBe("https://avelai-git-x.vercel.app");
  });

  it("dev ในเครื่อง ไม่มี VERCEL_ENV · ไม่มี header → localhost:3000 แบบ http", () => {
    expect(resolveSiteOrigin({})).toBe("http://localhost:3000");
    expect(resolveSiteOrigin({ siteUrl: "garbage", host: "localhost:3100" })).toBe("http://localhost:3100");
  });
});

describe("metadataBaseFrom", () => {
  it("SITE_URL ถูกต้อง → URL ของ origin", () => {
    expect(metadataBaseFrom("https://avelai.org/x?y=1")?.href).toBe("https://avelai.org/");
  });

  it("ไม่ตั้ง / เพี้ยน / ไม่ใช่ http(s) → undefined ไม่ throw", () => {
    expect(metadataBaseFrom(undefined)).toBeUndefined();
    expect(metadataBaseFrom("")).toBeUndefined();
    expect(metadataBaseFrom("avelai.org")).toBeUndefined();
    expect(metadataBaseFrom("javascript:alert(1)")).toBeUndefined();
  });
});
