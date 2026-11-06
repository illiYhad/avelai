import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// K-AV-STEAMLOGIN.4: buildPersonaDeps — ไม่ยิง Steam/DB จริง

const h = vi.hoisted(() => ({ fetched: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/suspension", () => ({ isUserSuspended: async () => false }));
vi.mock("@/lib/game-accounts/steam-persona", () => ({
  fetchSteamPersona: async (id: string) => { h.fetched.push(id); return { personaName: "From Steam", avatarUrl: null }; },
}));

import { buildPersonaDeps } from "@/lib/game-accounts/steam-deps";

type Call = { table: string; patch: Record<string, unknown>; col: string; val: string };
function fakeAdmin(calls: Call[]) {
  return {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async (col: string, val: string) => { calls.push({ table, patch, col, val }); return { error: null }; },
      }),
    }),
  } as unknown as SupabaseClient;
}

beforeEach(() => { h.fetched = []; });

describe("buildPersonaDeps", () => {
  it("admin null → null", () => {
    expect(buildPersonaDeps(null)).toBeNull();
  });

  it("fetchPersona เรียก fetchSteamPersona ด้วย Steam ID", async () => {
    const d = buildPersonaDeps(fakeAdmin([]))!;
    expect(await d.fetchPersona("76561197960287930")).toEqual({ personaName: "From Steam", avatarUrl: null });
    expect(h.fetched).toEqual(["76561197960287930"]);
  });

  it("setProfile: มีรูป → เขียน display_name + avatar_url ที่ users แถวของ userId · ไม่แตะ username", async () => {
    const calls: Call[] = [];
    await buildPersonaDeps(fakeAdmin(calls))!.setProfile("u-1", { personaName: "Ave", avatarUrl: "https://avatars.steamstatic.com/a.jpg" });
    expect(calls).toEqual([{ table: "users", patch: { display_name: "Ave", avatar_url: "https://avatars.steamstatic.com/a.jpg" }, col: "id", val: "u-1" }]);
    expect(Object.keys(calls[0].patch)).not.toContain("username");
  });

  it("setProfile: avatarUrl null → payload ไม่มีคีย์ avatar_url", async () => {
    const calls: Call[] = [];
    await buildPersonaDeps(fakeAdmin(calls))!.setProfile("u-2", { personaName: "Ave", avatarUrl: null });
    expect(calls[0].patch).toEqual({ display_name: "Ave" });
    expect("avatar_url" in calls[0].patch).toBe(false);
  });
});
