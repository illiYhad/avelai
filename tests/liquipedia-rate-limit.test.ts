import { describe, expect, it } from "vitest";
import {
  canFetch,
  countInWindow,
  HOUR_MS,
  LIQUIPEDIA_HOURLY_LIMIT,
  LIQUIPEDIA_USER_AGENT,
} from "@/lib/liquipedia/rateLimit";

describe("Liquipedia rate limit (60/ชม. ตามใบงาน)", () => {
  it("เพดานคือ 60 ครั้ง/ชั่วโมง", () => {
    expect(LIQUIPEDIA_HOURLY_LIMIT).toBe(60);
    expect(canFetch(0)).toBe(true);
    expect(canFetch(59)).toBe(true);
    expect(canFetch(60)).toBe(false);
    expect(canFetch(61)).toBe(false);
  });

  it("countInWindow นับเฉพาะคำขอในชั่วโมงล่าสุด", () => {
    const now = 10 * HOUR_MS;
    const timestamps = [
      now - HOUR_MS - 1, // นอกหน้าต่าง
      now - HOUR_MS + 1, // ในหน้าต่าง
      now - 30 * 60 * 1000, // ในหน้าต่าง
      now, // ขอบบน — นับ
      now + 1, // อนาคต — ไม่นับ
    ];
    expect(countInWindow(timestamps, now)).toBe(3);
  });

  it("User-Agent ระบุตัวตนตามกติกา Liquipedia", () => {
    expect(LIQUIPEDIA_USER_AGENT).toMatch(/AVELAi/);
    expect(LIQUIPEDIA_USER_AGENT).toMatch(/https?:\/\//);
  });
});
