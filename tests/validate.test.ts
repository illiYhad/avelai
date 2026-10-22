import { describe, expect, it } from "vitest";
import { safeNext, validateUsername, validateAvatarUrl } from "@/lib/auth/validate";

describe("validateUsername", () => {
  it("ผ่าน: a-z 0-9 _ ยาว 3–20", () => {
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("hero_99")).toBeNull();
    expect(validateUsername("a".repeat(20))).toBeNull();
  });

  it("ไม่ผ่าน: สั้นไป", () => {
    expect(validateUsername("ab")).not.toBeNull();
  });

  it("ไม่ผ่าน: ยาวไป", () => {
    expect(validateUsername("a".repeat(21))).not.toBeNull();
  });

  it("ไม่ผ่าน: ตัวพิมพ์ใหญ่", () => {
    expect(validateUsername("Hero")).not.toBeNull();
  });

  it("ไม่ผ่าน: ภาษาไทย", () => {
    expect(validateUsername("ฮีโร่")).not.toBeNull();
  });

  it("ไม่ผ่าน: ขึ้นต้น player_ (สงวนให้ระบบ)", () => {
    expect(validateUsername("player_abc")).not.toBeNull();
  });
});

describe("validateAvatarUrl", () => {
  it("ว่าง = ผ่าน", () => {
    expect(validateAvatarUrl("")).toBeNull();
  });

  it("https = ผ่าน", () => {
    expect(validateAvatarUrl("https://cdn.example.com/a.png")).toBeNull();
  });

  it("http = ไม่ผ่าน", () => {
    expect(validateAvatarUrl("http://cdn.example.com/a.png")).not.toBeNull();
  });

  it("ไม่ใช่ URL = ไม่ผ่าน", () => {
    expect(validateAvatarUrl("javascript:alert(1)")).not.toBeNull();
  });
});

describe("safeNext (กัน open redirect)", () => {
  it("/me ผ่าน", () => {
    expect(safeNext("/me")).toBe("/me");
  });

  it("//evil.com → fallback", () => {
    expect(safeNext("//evil.com")).toBe("/me");
  });

  it("https://evil.com → fallback", () => {
    expect(safeNext("https://evil.com")).toBe("/me");
  });

  it("/\\evil.com → fallback", () => {
    expect(safeNext("/\\evil.com")).toBe("/me");
  });

  it("control char ที่เบราว์เซอร์ตัดเอง: /\\t/evil.com → fallback (กลายเป็น //)", () => {
    expect(safeNext("/\t/evil.com")).toBe("/me");
    expect(safeNext("\t/me")).toBe("/me");
  });

  it("ว่าง/ไม่ใช่ string → fallback", () => {
    expect(safeNext("")).toBe("/me");
    expect(safeNext(null)).toBe("/me");
    expect(safeNext(undefined)).toBe("/me");
  });
});
