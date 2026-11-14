import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// K-AV-PULSE.1: user-visible "Karma" renamed to "Honor Pulse" (display text only · DB/identifiers unchanged)
const FILES = ["lib/i18n/th.ts", "lib/i18n/en.ts", "app/[game]/rules/rules-content.ts"];
const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
// drop comment lines (// ... and /* ... */ blocks) · remaining text = code + string values
const textOnly = (src: string) =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("/*") || t.startsWith("*"));
    })
    .join("\n");

describe("K-AV-PULSE.1 · Honor Pulse display name", () => {
  for (const f of FILES) {
    it(`${f}: no standalone "Karma" in text values`, () => {
      expect(textOnly(read(f))).not.toMatch(/\bKarma\b/);
    });
    it(`${f}: contains "Honor Pulse"`, () => {
      expect(read(f)).toContain("Honor Pulse");
    });
  }
});
