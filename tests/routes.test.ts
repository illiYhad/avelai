import { describe, it, expect } from "vitest";
import { routes } from "@/lib/routes";
import { gameFromSlug, slugOf, GAME_SLUGS, type GameSlug } from "@/lib/games";

// K-AV-UX2B: builder ทุกตัวขึ้นต้น /${slug}/ · slug แปลก/ตัวใหญ่ = null (ไม่เดา)

describe("routes", () => {
  for (const slug of Object.keys(GAME_SLUGS) as GameSlug[]) {
    it(`ทุก builder ขึ้นต้น /${slug}/`, () => {
      for (const [name, fn] of Object.entries(routes)) {
        const path = (fn as (...a: string[]) => string)(slug, "x1", "x2");
        expect(path.startsWith(`/${slug}/`), name).toBe(true);
      }
    });
  }
  it("passport encode ชื่อ", () => {
    expect(routes.passport("mlbb", "a b")).toBe("/mlbb/passport/a%20b");
  });
});

describe("gameFromSlug / slugOf", () => {
  it("รู้จักเฉพาะตัวพิมพ์เล็ก", () => {
    expect(gameFromSlug("mlbb")).toBe("MLBB");
    expect(gameFromSlug("dota2")).toBe("DOTA2");
    expect(gameFromSlug("MLBB")).toBeNull();
    expect(gameFromSlug("lol")).toBeNull();
    expect(gameFromSlug(undefined)).toBeNull();
    expect(gameFromSlug("toString")).toBeNull();
  });
  it("slugOf กลับด้าน", () => {
    expect(slugOf("MLBB")).toBe("mlbb");
    expect(slugOf("DOTA2")).toBe("dota2");
  });
});
