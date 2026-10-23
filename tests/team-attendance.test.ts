import { describe, expect, it } from "vitest";
import { computeAttendanceStats } from "@/lib/team/attendance";

describe("computeAttendanceStats", () => {
  it("คำนวณ % จากเฉพาะนัดที่ถูกเช็กชื่อแล้ว", () => {
    const stats = computeAttendanceStats([
      { session_id: "s1", user_id: "a", attended: true },
      { session_id: "s2", user_id: "a", attended: false },
      { session_id: "s3", user_id: "a", attended: true },
      { session_id: "s4", user_id: "a", attended: null }, // ยังไม่เช็ก — ไม่นับฐาน
    ]);
    const a = stats.find((s) => s.userId === "a")!;
    expect(a.checkedCount).toBe(3);
    expect(a.attendedCount).toBe(2);
    expect(a.percent).toBe(67);
  });

  it("คนที่ยังไม่ถูกเช็กชื่อเลย = 0% ฐาน 0", () => {
    const stats = computeAttendanceStats([{ session_id: "s1", user_id: "b", attended: null }]);
    expect(stats).toEqual([{ userId: "b", attendedCount: 0, checkedCount: 0, percent: 0 }]);
  });

  it("มาครบทุกนัด = 100%", () => {
    const stats = computeAttendanceStats([
      { session_id: "s1", user_id: "c", attended: true },
      { session_id: "s2", user_id: "c", attended: true },
    ]);
    expect(stats[0].percent).toBe(100);
  });

  it("แยกสถิติรายคนไม่ปนกัน", () => {
    const stats = computeAttendanceStats([
      { session_id: "s1", user_id: "a", attended: true },
      { session_id: "s1", user_id: "b", attended: false },
    ]);
    expect(stats.find((s) => s.userId === "a")!.percent).toBe(100);
    expect(stats.find((s) => s.userId === "b")!.percent).toBe(0);
  });
});
