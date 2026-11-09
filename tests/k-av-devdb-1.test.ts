import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// K-AV-DEVDB.1: local Docker Supabase (avelai-sandbox) — static checks only (no Docker / no DB)
const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const config = read("supabase/config.toml");
const reset = read("scripts/dev-db/reset.ps1");
const dev = read("scripts/dev-db/dev.ps1");
const seed = read("supabase/dev/seed_dev.sql");

describe("K-AV-DEVDB.1 local dev database", () => {
  it("a) config.toml: project_id avelai-sandbox · no 5432x ports · db on 56322", () => {
    expect(config).toMatch(/^project_id = "avelai-sandbox"$/m);
    expect(config).not.toMatch(/\b5432\d\b/);
    expect(config).toMatch(/^\[db\][\s\S]*?^port = 56322$/m);
    expect(config).toMatch(/^\[api\][\s\S]*?^port = 56321$/m);
    expect(config).toMatch(/^site_url = "http:\/\/localhost:3120"$/m);
    // CLI must not apply repo migrations (3-digit names) on its own
    expect(config).toMatch(/^\[db\.migrations\][\s\S]*?^enabled = false$/m);
  });

  it("b) reset.ps1 runs 001 + every migration on disk in ascending order", () => {
    const listBlock = reset.match(/\$MigrationFiles = @\(([\s\S]*?)\)/);
    expect(listBlock).not.toBeNull();
    const listed = [...listBlock![1].matchAll(/'([^']+\.sql)'/g)].map((m) => m[1]);
    const onDisk = [
      "supabase/001_core_auth_roles_audit.sql",
      ...fs
        .readdirSync(path.join(root, "supabase/migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort((x, y) => parseInt(x, 10) - parseInt(y, 10))
        .map((f) => `supabase/migrations/${f}`),
    ];
    expect(listed).toEqual(onDisk);
    expect(reset).toContain("supabase/dev/seed_dev.sql");
  });

  it("c) scripts refuse any target other than avelai-sandbox / 56322 (and never touch remote)", () => {
    expect(reset).toContain("$ExpectedProjectId = 'avelai-sandbox'");
    expect(reset).toContain("$ExpectedDbPort    = 56322");
    expect(reset).toContain("$Container         = 'supabase_db_avelai-sandbox'");
    expect(reset).toMatch(/Fail "supabase\/config\.toml project_id/);
    expect(reset).toMatch(/Fail "container \$Container is not published/);
    expect(dev).toContain("$ExpectedApiUrl = 'http://127.0.0.1:56321'");
    for (const s of [reset, dev]) {
      expect(s).not.toMatch(/\b(link|db push|db pull|--db-url|--linked|stop --all|system prune)\b/);
      // never writes files (no .env / .env.local) — only process-scoped $env:
      expect(s).not.toMatch(/Set-Content|Add-Content|Out-File|New-Item|>\s*\S*\.env/i);
    }
  });

  it("d) seed has no passwords and every tournament name starts with [TEST]", () => {
    expect(seed).not.toMatch(/password|encrypted_password|รหัสผ่าน\s*=/i);
    const tourInsert = seed.match(/INSERT INTO public\.tournaments[\s\S]*?;\n/);
    expect(tourInsert).not.toBeNull();
    const names = [...tourInsert![0].matchAll(/'DOTA2'/g)];
    expect(names).toHaveLength(3);
    const quoted = [...tourInsert![0].matchAll(/'a1000000-[^']+', '([^']+)'/g)].map((m) => m[1]);
    expect(quoted).toHaveLength(3);
    for (const n of quoted) expect(n.startsWith("[TEST]")).toBe(true);
    expect(seed).toMatch(/@avelai\.local/);
  });

  it("e) no .env* file is tracked or added", () => {
    let files: string[] = [];
    try {
      files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
        .split("\n")
        .filter(Boolean);
    } catch {
      return; // not a git checkout (e.g. packaged build) — nothing to check
    }
    const envFiles = files.filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith(".env.example"));
    expect(envFiles).toEqual([]);
  });
});
