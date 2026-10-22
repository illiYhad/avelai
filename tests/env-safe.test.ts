import { describe, expect, it } from "vitest";
import { readAdminConfig, readClientConfig } from "@/lib/db/config";

// เทสเคสจากกับดักหมวด 7 ของ SYSTEM_CORE: env-safe — ไม่มีค่าต้องคืน null ไม่ล้ม

describe("readAdminConfig (env-safe)", () => {
  it("คืน null เมื่อไม่มี env — แอปต้องไม่ล้ม", () => {
    expect(readAdminConfig({})).toBeNull();
    expect(readAdminConfig({ SUPABASE_URL: "https://x.supabase.co" })).toBeNull();
    expect(readAdminConfig({ SUPABASE_SERVICE_ROLE_KEY: "k" })).toBeNull();
  });

  it("คืนค่าถูกและตัด / ท้าย URL เมื่อ env ครบ", () => {
    expect(
      readAdminConfig({
        SUPABASE_URL: "https://x.supabase.co/",
        SUPABASE_SERVICE_ROLE_KEY: "k",
      }),
    ).toEqual({ url: "https://x.supabase.co", key: "k" });
  });
});

describe("readClientConfig (env-safe)", () => {
  it("คืน null เมื่อไม่มี env และไม่อ่าน service role key", () => {
    expect(readClientConfig({})).toBeNull();
    // มีแต่ service role key — ฝั่ง client ต้องไม่หยิบมาใช้
    expect(
      readClientConfig({
        SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "k",
      }),
    ).toBeNull();
  });

  it("คืน anon key เมื่อ env ครบ", () => {
    expect(
      readClientConfig({
        SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_ANON_KEY: "anon",
      }),
    ).toEqual({ url: "https://x.supabase.co", key: "anon" });
  });
});
