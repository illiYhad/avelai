// K-AV-I18N.0d: ป้ายสถานะเข้าพจนานุกรม · ไม่ส่ง locale = ไทยเดิม · en = อังกฤษ ไม่มีอักษรไทย
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StatusBadge, { STATUS_BADGES, type BadgeStatus } from "@/components/ui/StatusBadge";
import TournamentsForYou from "@/components/home/TournamentsForYou";
import { th } from "@/lib/i18n/th";
import { en } from "@/lib/i18n/en";

const ALL = Object.keys(STATUS_BADGES) as BadgeStatus[];
const OLD_TH: Record<BadgeStatus, string> = {
  OPEN: "เปิดรับสมัคร",
  SCHEDULED: "กำหนดการแล้ว",
  LIVE: "กำลังแข่ง",
  COMPLETED: "จบแล้ว",
  PENDING_PAYMENT: "รอตรวจสลิป",
  READY_CHECK: "รอยืนยันพร้อม",
  AWAITING_RESULT: "รอผลแข่ง",
  DISPUTED: "มีข้อโต้แย้ง",
  LOCKED: "ล็อกแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

describe("K-AV-I18N.0d StatusBadge", () => {
  it("a) คีย์ status ใน th/en ตรงกับ STATUS_BADGES ครบ", () => {
    expect(Object.keys(th.status).sort()).toEqual([...ALL].sort());
    expect(Object.keys(en.status).sort()).toEqual([...ALL].sort());
  });
  it("b) th = ข้อความเดิมตรงตัว · ไม่ส่ง locale กับส่ง th ได้ HTML เดียวกัน", () => {
    for (const s of ALL) {
      expect(th.status[s]).toBe(OLD_TH[s]);
      const a = renderToStaticMarkup(createElement(StatusBadge, { status: s }));
      const b = renderToStaticMarkup(createElement(StatusBadge, { status: s, locale: "th" }));
      expect(a).toBe(b);
      expect(a).toContain(OLD_TH[s]);
    }
  });
  it("c) en ไม่มีอักษรไทย และไม่ใช่ชื่อคีย์ดิบ", () => {
    for (const s of ALL) {
      const html = renderToStaticMarkup(createElement(StatusBadge, { status: s, locale: "en" }));
      expect(html).not.toMatch(/[฀-๿]/);
      expect(html).not.toContain(`>${s}<`);
      expect(html).toContain(en.status[s]);
    }
  });
  it("d) การ์ดทัวร์หน้า Home ภาษาอังกฤษ ป้ายเป็นอังกฤษ", () => {
    const html = renderToStaticMarkup(
      createElement(TournamentsForYou, {
        locale: "en",
        now: Date.parse("2026-11-13T00:00:00Z"),
        items: [{ id: "t1", name: "Test Cup", status: "RUNNING", start_at: "2026-11-13T00:00:00Z", format: "SWISS", best_of: 1, team_size: 5, max_teams: 16 }],
      }),
    );
    expect(html).toContain(en.status.LIVE);
    expect(html).not.toContain(th.status.LIVE);
  });
});
