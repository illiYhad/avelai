import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENTRY_LABEL, ENTRY_TYPES } from "@/lib/tournament/state";
import { PASS_PRICE_THB, PASS_PERIOD_LABEL } from "@/lib/passes";

// K-AV-PASS.1: ชื่อที่ผู้ใช้เห็น "Weekly Pass" → "Arena Pass" · ค่าในฐาน/enum/ราคา/อายุ ไม่เปลี่ยน

const root = join(__dirname, "..");
const FILES = [
  "app/[game]/pass/page.tsx",
  "app/[game]/pass/receipt/[paymentId]/page.tsx",
  "app/admin/payments/page.tsx",
  "app/admin/payments/actions.ts",
  "app/[game]/tournaments/[id]/register/actions.ts",
  "lib/tournament/state.ts",
  "components/tournament/TournamentHub.tsx",
];

/** ตัดคอมเมนต์ (// … ท้ายบรรทัด และ /* … *\/) ออก เหลือโค้ด + ข้อความที่แสดง */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

describe("K-AV-PASS.1", () => {
  it('a) ENTRY_LABEL.WEEKLY_PASS = "ใช้ Arena Pass" · key ยังเป็น WEEKLY_PASS', () => {
    expect(ENTRY_LABEL.WEEKLY_PASS).toBe("ใช้ Arena Pass");
    expect(ENTRY_TYPES).toContain("WEEKLY_PASS");
    expect(Object.keys(ENTRY_LABEL)).toEqual(["FREE", "WEEKLY_PASS", "PAID"]);
  });

  it("b) ราคาไม่เปลี่ยน 380 บาท · รอบเป็นเดือนปฏิทิน (K-AV-PASS.2 แทน 28 วัน)", () => {
    expect(PASS_PRICE_THB).toBe(380);
    expect(PASS_PERIOD_LABEL).toBe("ใช้ได้ 1–สิ้นเดือน (เวลาไทย)");
  });

  it('c) 7 ไฟล์ไม่มี "Weekly Pass" ในข้อความที่แสดง (ยกเว้นคอมเมนต์) · และมี "Arena Pass"', () => {
    for (const f of FILES) {
      const src = readFileSync(join(root, f), "utf8");
      expect(stripComments(src), f).not.toContain("Weekly Pass");
      expect(src, f).toMatch(/Arena Pass|ARENA PASS/);
    }
  });

  it("d) หน้า pass: 380 บาท / เดือน + รอบ 1–สิ้นเดือน (K-AV-PASS.2) · ไม่มี 28 วัน · มีสัดส่วนกองรางวัล", () => {
    const page = readFileSync(join(root, "app/[game]/pass/page.tsx"), "utf8");
    expect(page).not.toMatch(/28 ?วัน|4 สัปดาห์|PASS_DAYS/);
    expect(page).toContain("{PASS_PRICE_THB} บาท / เดือน · {PASS_PERIOD_LABEL}");
    expect(page).toContain("75% ของยอด Pass เข้ากองรางวัล (รายวัน 40% · Weekend 35% · Season/รายเดือน 25%)");
    expect(page).toContain('title: "Arena Pass — AVELAi"');
    expect(page).toContain(">ARENA PASS</h1>");
  });
});
