import { describe, it, expect, afterEach } from "vitest";
import { parseBangkokLocal, formatBangkokDateTime, formatBangkokTime } from "@/lib/team/time";

// K-AV-H4: กรอก 20:00 (เวลาไทย) → เก็บ 13:00Z → แสดง 20:00 · ผลต้องเท่ากันไม่ว่า TZ ของเครื่อง

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe.each(["UTC", "Asia/Bangkok", "America/New_York", "Pacific/Auckland"])("TZ=%s", (tz) => {
  it("20:00 เวลาไทย → 13:00Z", () => {
    process.env.TZ = tz;
    expect(parseBangkokLocal("2026-10-25T20:00")?.toISOString()).toBe("2026-10-25T13:00:00.000Z");
  });
  it("แสดงกลับเป็น 20:00 / 22:00 (Asia/Bangkok)", () => {
    process.env.TZ = tz;
    const start = parseBangkokLocal("2026-10-25T20:00")!.toISOString();
    const end = parseBangkokLocal("2026-10-25T22:00")!.toISOString();
    expect(formatBangkokDateTime(start)).toContain("20:00:00");
    expect(formatBangkokDateTime(start)).toContain("25/10/2569");
    expect(formatBangkokTime(end)).toBe("22:00");
  });
});

describe("parseBangkokLocal", () => {
  it("ข้ามเที่ยงคืน: 00:30 ไทย = 17:30Z วันก่อน", () => {
    expect(parseBangkokLocal("2026-10-26T00:30")?.toISOString()).toBe("2026-10-25T17:30:00.000Z");
  });
  it("มีวินาทีได้", () => {
    expect(parseBangkokLocal("2026-10-25T20:00:30")?.toISOString()).toBe("2026-10-25T13:00:30.000Z");
  });
  it("สตริงที่มีโซนอยู่แล้ว (Z / +07:00) เชื่อตามโซนนั้น", () => {
    expect(parseBangkokLocal("2026-10-25T13:00:00Z")?.toISOString()).toBe("2026-10-25T13:00:00.000Z");
    expect(parseBangkokLocal("2026-10-25T20:00:00+07:00")?.toISOString()).toBe("2026-10-25T13:00:00.000Z");
  });
  it.each(["", "abc", "2026-10-25", "2026-13-01T10:00", "25/10/2026 20:00"])("ไม่ถูกรูปแบบ %j → null", (v) => {
    expect(parseBangkokLocal(v)).toBeNull();
  });
});
