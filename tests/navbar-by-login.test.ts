import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// K-AV-H6: เมนูบนสุด + แชทบอทตามสถานะล็อกอิน

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  dbOff: false,
  getUserCalls: 0,
  pathname: "/me",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/globals.css", () => ({}));  // postcss/tailwind ไม่เกี่ยวกับเทสนี้
vi.mock("next/navigation", () => ({ usePathname: () => h.pathname }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () =>
    h.dbOff
      ? null
      : { auth: { getUser: async () => { h.getUserCalls++; return { data: { user: h.user } }; } } },
}));
vi.mock("@/components/AVEChatbot", () => ({ default: () => createElement("div", { "data-testid": "ave-chatbot" }) }));

import { navFor } from "@/lib/nav";
import Navbar from "@/components/Navbar";
import RootLayout from "@/app/layout";

const LEGACY = ["/dashboard", "/leaderboard", "/profile"];

beforeEach(() => { h.user = null; h.dbOff = false; h.getUserCalls = 0; h.pathname = "/login"; });

describe("navFor (pure)", () => {
  it("ยังไม่ล็อกอิน → โลโก้ /login · ไม่มีเมนู · ไม่มีแชทบอท", () => {
    expect(navFor(false)).toEqual({ home: "/login", links: [], showChatbot: false });
  });
  it("ล็อกอินแล้ว → โลโก้ /me · มีแต่ /me และ /teams · มีแชทบอท", () => {
    const m = navFor(true);
    expect(m.home).toBe("/me");
    expect(m.links.map((l) => l.href)).toEqual(["/me", "/teams", "/tournaments"]);
    expect(m.showChatbot).toBe(true);
  });
  it("ล็อกอินแล้วก็ไม่มีลิงก์ legacy", () => {
    const hrefs = navFor(true).links.map((l) => l.href);
    for (const p of LEGACY) expect(hrefs).not.toContain(p);
  });
});

describe("Navbar (render)", () => {
  it("ยังไม่ล็อกอิน: โลโก้ชี้ /login · ไม่มี /dashboard /leaderboard /profile", () => {
    const html = renderToStaticMarkup(createElement(Navbar, { signedIn: false }));
    expect(html).toContain('href="/login"');
    for (const p of LEGACY) expect(html).not.toContain(`href="${p}"`);
  });
  it("ล็อกอินแล้ว: โลโก้ชี้ /me · ไม่มีลิงก์ legacy", () => {
    h.pathname = "/me";
    const html = renderToStaticMarkup(createElement(Navbar, { signedIn: true }));
    expect(html).toContain('href="/me"');
    expect(html).toContain('href="/teams"');
    for (const p of LEGACY) expect(html).not.toContain(`href="${p}"`);
  });
});

describe("RootLayout", () => {
  const render = async () =>
    renderToStaticMarkup(await RootLayout({ children: createElement("main", null, "x") }));

  it("ไม่ล็อกอิน → ไม่เรนเดอร์แชทบอท", async () => {
    expect(await render()).not.toContain("ave-chatbot");
  });
  it("ยังไม่ต่อ DB → เหมือนไม่ล็อกอิน ไม่ล้ม", async () => {
    h.dbOff = true;
    const html = await render();
    expect(html).not.toContain("ave-chatbot");
    expect(html).toContain('href="/login"');
  });
  it("ล็อกอินแล้ว → เรนเดอร์แชทบอท", async () => {
    h.user = { id: "u1" };
    expect(await render()).toContain("ave-chatbot");
  });
  it("อ่าน session ครั้งเดียวต่อ request (ไม่เพิ่ม DB call)", async () => {
    h.user = { id: "u1" };
    await render();
    expect(h.getUserCalls).toBe(1);
  });
});
