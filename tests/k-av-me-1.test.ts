import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// K-AV-ME.1: /me Phase 1 = Dota 2 เท่านั้น · MLBB "เร็ว ๆ นี้" ไม่มีฟอร์ม · ไม่ใช้ env/เน็ต

vi.mock("server-only", () => ({}));
vi.mock("@/app/me/dota-actions", () => ({ unlinkDotaAccountAction: async () => ({ ok: true, message: "" }) }));

import GameAccountsCard, { type DotaAccount, type MlbbAccount } from "@/app/me/GameAccountsCard";

const root = join(__dirname, "..");
const dotaOk: DotaAccount = { external_id: "123456789", verified: true, viaSteam: true };
const render = (mlbb: MlbbAccount, dota: DotaAccount = dotaOk) =>
  renderToStaticMarkup(createElement(GameAccountsCard, { dota, mlbb, linked: null, linkError: null, unavailable: false }));

describe("K-AV-ME.1 การ์ดบัญชีเกม", () => {
  const a = render(null);
  const b = render({ external_id: "987654321", zone_id: "2001" });

  it("a) dota VERIFIED · mlbb null → ไม่มีฟอร์ม/ช่อง/ปุ่มบันทึก MLBB · มี 'เร็ว ๆ นี้'", () => {
    expect(a).not.toContain('name="mlbb_id"');
    expect(a).not.toContain('name="zone_id"');
    expect(a).not.toMatch(/>(บันทึก|เปลี่ยน ID)</);
    expect(a).not.toContain("Moonton");
    const seg = a.split('data-game="mlbb"')[1];
    expect(seg).toContain("Mobile Legends (MLBB)");
    expect(seg).toContain("เร็ว ๆ นี้");
  });

  it("b) mlbb มีค่าเดิม → เห็น ID อ่านอย่างเดียว ไม่มีฟอร์ม", () => {
    expect(b).toContain("987654321 (2001)");
    expect(b).not.toContain('name="mlbb_id"');
    expect(b.split('data-game="mlbb"')[1]).not.toContain("<form");
  });

  it("c) ส่วน Dota ยังอยู่ครบ (ID · ยืนยันแล้ว · ลิงก์การ์ดผู้เล่น · ปุ่มยกเลิกการผูก)", () => {
    expect(a).toContain("Dota 2 · ยืนยันกับ Steam");
    expect(a).toContain("123456789");
    expect(a).toContain("ยืนยันแล้ว (Steam)");
    expect(a).toContain('href="/me/dota"');
    expect(a).toContain("ยกเลิกการผูก");
    const none = render(null, null);
    expect(none).toContain("ยังไม่ผูกบัญชี");
  });

  it("d) page.tsx ไม่มีลิงก์ Passport MLBB · เหลือ Dota 2 · mlbb-actions.ts ยังอยู่", () => {
    const page = readFileSync(join(root, "app", "me", "page.tsx"), "utf8");
    expect(page).not.toContain('routes.passport("mlbb"');
    expect(page).toContain('routes.passport("dota2"');
    expect(existsSync(join(root, "app", "me", "mlbb-actions.ts"))).toBe(true);
    expect(readFileSync(join(root, "app", "me", "mlbb-actions.ts"), "utf8")).toContain("export async function linkMlbb");
  });

  it("บันทึกผลเรนเดอร์ a/b ลง _checks (ถ้ามีโฟลเดอร์กล่อง)", () => {
    const base = "D:\\Balehm_Studio\\03_Mailbox\\04_ACTIVE_THREAD\\_checks";
    if (!existsSync(base)) return;
    const dir = join(base, "k-av-me-1");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "me-card-render.html"), `<!doctype html><meta charset="utf-8"><title>K-AV-ME.1 render</title>\n<h3>a) mlbb null</h3>\n${a}\n<h3>b) mlbb มี ID เดิม</h3>\n${b}\n`);
    expect(existsSync(join(dir, "me-card-render.html"))).toBe(true);
  });
});
