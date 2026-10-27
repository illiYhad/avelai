import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// K-AV-UX2B: ด่านกันข้อมูลปนเกม — อ่านไฟล์จริง (ไม่ยิง DB)

const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
const rel = (p: string) => relative(root, p).split(sep).join("/");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("(a) หน้ารายการใต้ /[game]/ กรองด้วยเกมเสมอ", () => {
  const LIST_PAGES: [file: string, filter: RegExp][] = [
    ["app/[game]/tournaments/page.tsx", /\.eq\(["']game["'], code\)/],
    ["app/[game]/teams/page.tsx", /\.eq\(["']teams\.game["'], code\)/], // team_members join teams!inner
    ["app/[game]/pass/page.tsx", /\.eq\(["']game["'], code\)/],
    ["app/[game]/organizer/tournaments/page.tsx", /\.eq\(["']game["'], code\)/],
  ];
  it.each(LIST_PAGES)("%s", (file, filter) => {
    expect(read(file)).toMatch(filter);
  });
  it("pass: สลิปก็กรองเกม · organizer: ทัวร์ที่เป็น staff ก็กรองเกม", () => {
    expect(read("app/[game]/pass/page.tsx")).toContain('.eq("pass_game", code)');
    expect(read("app/[game]/organizer/tournaments/page.tsx")).toContain('.eq("tournaments.game", code)');
  });
  it("หน้ารายละเอียด: แถวของอีกเกม = notFound()", () => {
    expect(read("app/[game]/tournaments/[id]/page.tsx")).toContain("if (!t || t.game !== code) notFound();");
    expect(read("app/[game]/teams/[teamId]/page.tsx")).toContain("if (!team || teamGame(team.game) !== code) notFound();");
    expect(read("app/[game]/matches/[id]/page.tsx")).toContain("if (!t || t.game !== code) notFound();");
    expect(read("app/[game]/passport/[username]/page.tsx").match(/\.eq\("game", code\)/g)?.length).toBe(2);
  });
});

describe("(b) ไม่มีเส้นทางเก่าเป็นตัวอักษรตรง ๆ", () => {
  // lib/routes.ts = ที่สร้างลิงก์ · lib/nav.ts = ของตัวเขียว (K-AV-UX2A) · lib/dota/opendota.ts = path ของ API ภายนอก
  const ALLOWED = new Set(["lib/routes.ts", "lib/nav.ts", "lib/dota/opendota.ts"]);
  const files = [...walk(join(root, "app", "[game]")), ...walk(join(root, "lib"))].map(rel).filter((f) => !ALLOWED.has(f));
  it("app/[game]/** + lib/**", () => {
    const bad = files.filter((f) => /["'`]\/(tournaments|teams|team\/|passport|pass\b|matches\/|organizer)/.test(read(f)));
    expect(bad).toEqual([]);
  });
});

describe("app/[game]/layout", () => {
  vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
  it("slug แปลก → notFound (404) · slug ถูก → render ลูก", async () => {
    const { default: GameLayout, generateStaticParams } = await import("@/app/[game]/layout");
    await expect(GameLayout({ children: "x", params: Promise.resolve({ game: "lol" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(GameLayout({ children: "x", params: Promise.resolve({ game: "MLBB" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(GameLayout({ children: "x", params: Promise.resolve({ game: "dota2" }) })).resolves.toBe("x");
    expect(generateStaticParams()).toEqual([{ game: "mlbb" }, { game: "dota2" }]);
  });
});
