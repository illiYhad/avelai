// K-AV-NAV.2: ลิ้นชักมือถือต้องอยู่นอก <header> (header มี backdrop-blur → fixed ภายในยึดกับ header สูง 56 ลิ้นชักจึงสูง 0 โปร่ง)
// วัดจริงในเบราว์เซอร์ 390×844: ก่อนแก้ drawer height 0 · หลังแก้ 788 (ผลใน _checks\k-av-post48)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "components", "Navbar.tsx"), "utf8");

describe("K-AV-NAV.2 drawer outside header", () => {
  it("a) ลิ้นชัก (fixed top-14) อยู่หลัง </header> ไม่ใช่ข้างใน", () => {
    const headerClose = src.indexOf("</header>");
    const drawer = src.indexOf('className="fixed inset-x-0 bottom-0 top-14');
    expect(headerClose).toBeGreaterThan(-1);
    expect(drawer).toBeGreaterThan(headerClose);
  });
  it("b) header ยังเป็น sticky + backdrop-blur เดิม · ลิ้นชักยัง md:hidden + พื้นทึบ bg-void", () => {
    expect(src).toContain('<header className="sticky top-0 z-50 bg-void/85 shadow-hud backdrop-blur-md">');
    expect(src).toContain('className="fixed inset-x-0 bottom-0 top-14 z-40 md:hidden"');
    expect(src).toContain('className="flex h-full flex-col bg-void"');
  });
});
