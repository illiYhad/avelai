import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import TournamentHub from "@/components/tournament/TournamentHub";
import { GAME_REDIRECTS, HUB_REDIRECTS } from "../next.config";

// K-AV-HUB1: หน้า Hub ของแต่ละเกม — ไม่มีชื่อ/เงินปลอมติดตัวผู้ใช้ · ส่วนตัวอย่างมีชิป · Mercenary ปิด · redirect /tournament ตรงตัว

const root = join(__dirname, "..");
const html = (viewer: { username: string; avatarUrl: string | null } | null, showLinkGame = false) =>
  renderToStaticMarkup(createElement(TournamentHub, { viewer, showLinkGame }));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(n) ? [p] : [];
  });
}

describe("Hub: ไม่มีข้อมูลผู้ใช้ปลอม", () => {
  it("ไม่มี ShadowKaiser / usr_99812 / Elite Form Striker ใน app · components · lib", () => {
    for (const f of [...walk(join(root, "app")), ...walk(join(root, "components")), ...walk(join(root, "lib"))]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/ShadowKaiser|usr_99812|Elite Form Striker/);
    }
  });

  it("ล็อกอินแล้ว → เห็นชื่อตัวเอง · ค่าติดตัวที่ยังไม่มีข้อมูล = —", () => {
    const out = html({ username: "test_a1", avatarUrl: null });
    expect(out).toContain("test_a1");
    expect(out).not.toContain("เข้าสู่ระบบเพื่อดูโปรไฟล์");
    expect((out.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(5); // CP · อันดับ · Token · Cash · Weekly Pass
  });

  it("ไม่ล็อกอิน → การ์ดโปรไฟล์เป็นปุ่มเข้าสู่ระบบ", () => {
    const out = html(null);
    expect(out).toContain('href="/login"');
    expect(out).toContain("เข้าสู่ระบบ");
    expect(out).not.toContain("CIRCUIT POINTS");
  });

  it("Dota 2 + ล็อกอิน → ปุ่มผูกบัญชีเกมไป /me", () => {
    expect(html({ username: "u", avatarUrl: null }, true)).toMatch(/href="\/me"[^>]*>ผูกบัญชีเกม/);
    expect(html({ username: "u", avatarUrl: null }, false)).not.toContain("ผูกบัญชีเกม");
  });
});

describe("Hub: ข้อมูลตัวอย่างมีชิปครบ · Mercenary ปิด", () => {
  it("ฮีโร่ซีซัน + Mercenary + การ์ด 4 ระดับ มีชิป 'ข้อมูลตัวอย่าง' (รวม 6)", () => {
    const out = html(null);
    expect((out.match(/data-sample="[^"]*"[^>]*>ข้อมูลตัวอย่าง</g) ?? []).length).toBe(6);
    for (const sec of ["season", "mercenary"]) {
      const seg = out.split(`data-section="${sec}"`)[1].split("data-section=")[0];
      expect(seg, sec).toContain("ข้อมูลตัวอย่าง");
    }
  });

  it("ปุ่มเข้า Mercenary disabled + 'ยังไม่เปิด'", () => {
    expect(html({ username: "u", avatarUrl: null })).toMatch(/<button[^>]*disabled=""[^>]*data-mercenary-join[^>]*>ยังไม่เปิด<\/button>/);
  });

  it("ไม่มีข้อความนักพัฒนา FEATURE-4160 / Coming Phase ในหน้า Hub", () => {
    expect(html(null)).not.toMatch(/FEATURE-41|Coming Phase|PHASE 4\.3/);
  });
});

describe("redirect /tournament", () => {
  it("/tournament (ตรงตัว) → /mlbb/tournaments · ไม่มีแถวไหนจับ /tournament/daily|weekly|monthly", () => {
    expect(HUB_REDIRECTS).toEqual([{ source: "/tournament", destination: "/mlbb/tournaments", permanent: false }]);
    for (const r of [...GAME_REDIRECTS, ...HUB_REDIRECTS]) expect(r.source.startsWith("/tournament/")).toBe(false);
    expect(existsSync(join(root, "app/tournament/page.tsx"))).toBe(false);
    for (const p of ["daily", "weekly", "monthly"]) expect(existsSync(join(root, `app/tournament/${p}/page.tsx`))).toBe(true);
  });
});
