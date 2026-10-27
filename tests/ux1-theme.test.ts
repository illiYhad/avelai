import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// K-AV-UX1: กันธีมแบรนด์หาย — ทุกชื่อสี/ฟอนต์ที่หน้าเว็บเรียกใช้ต้องมีนิยามใน globals.css
const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(root, dir))) {
    const rel = path.join(dir, name);
    if (rel.split(path.sep).join("/").startsWith("app/obs")) continue; // จอ OBS มีธีมของตัวเอง
    if (statSync(path.join(root, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

const files = [...sourceFiles("app"), ...sourceFiles("components")];
const source = files.map(read).join("\n");
const css = read("app/globals.css");

describe("K-AV-UX1 theme", () => {
  it("defines every brand color and font the pages use", () => {
    for (const color of ["gold", "void", "cyan"]) {
      if (new RegExp(`\\b(bg|text|border|from|to)-${color}\\b`).test(source)) {
        expect(css).toMatch(new RegExp(`--color-${color}:`));
      }
    }
    expect(source).toMatch(/\bfont-display\b/);
    expect(css).toMatch(/--font-display:/);
    expect(source).toMatch(/\bfont-numeric\b/);
    expect(css).toMatch(/@utility font-numeric\s*\{[^}]*tabular-nums/);
  });

  it("locks the dark theme (no light-mode media query)", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).toMatch(/color-scheme:\s*dark/);
  });

  it("sets lang=th on <html>", () => {
    expect(read("app/layout.tsx")).toMatch(/<html lang="th"/);
  });

  it("has no text smaller than 12px", () => {
    const tiny = files.filter((f) => /text-\[([0-9]|1[01])px\]/.test(read(f)));
    expect(tiny).toEqual([]);
  });

  it("button classes transition only specific properties", () => {
    const block = css.slice(css.indexOf(".btn-primary"));
    expect(block).not.toMatch(/transition:\s*all|transition-property:\s*all/);
    expect(block).toMatch(/transition-property: background-color, border-color, opacity/);
    expect(source).not.toMatch(/btn-(primary|ghost)[^"]*transition-all/);
  });
});
