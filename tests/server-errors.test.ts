import { describe, it, expect, vi } from "vitest";
import { failWith, GENERIC_FAIL_MESSAGE } from "@/lib/server-errors";

describe("failWith (K-AV-H2)", () => {
  it("ไม่ส่งข้อความ error ดิบถึงผู้ใช้ · ลง console.error ฝั่ง server", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = new Error('new row violates row-level security policy for table "teams"');
    const res = failWith("CREATE_FAILED", raw);
    expect(res.error.message).toBe(GENERIC_FAIL_MESSAGE);
    expect(JSON.stringify(res)).not.toContain("row-level security");
    expect(spy).toHaveBeenCalledWith("[CREATE_FAILED]", raw);
    spy.mockRestore();
  });
  it("ใช้ข้อความไทยที่ส่งมาแทนได้", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(failWith("X", "boom", "เพิ่มรายการไม่สำเร็จ").error.message).toBe("เพิ่มรายการไม่สำเร็จ");
  });
});
