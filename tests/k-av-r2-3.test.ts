import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// K-AV-R2.3: loading.tsx for 5 routes · skeleton like tournaments/loading.tsx · aria-busy + role=status
const FILES = ["app/me", "app/me/dota", "app/[game]/pass", "app/[game]/matches/[id]", "app/[game]/stats/matches/[matchId]"].map((d) => `${d}/loading.tsx`);

describe("K-AV-R2.3 · loading states", () => {
  for (const f of FILES) {
    it(`${f}: exists · default export · aria-busy · role=status · skeleton`, () => {
      const p = join(__dirname, "..", f);
      expect(existsSync(p)).toBe(true);
      const s = readFileSync(p, "utf8");
      expect(s).toMatch(/export default function/);
      expect(s).toMatch(/aria-busy="true"/);
      expect(s).toMatch(/role="status"/);
      expect(s).toMatch(/@\/components\/ui\/Skeleton/);
    });
  }
});
