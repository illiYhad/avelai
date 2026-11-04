import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// K-AV-POLISH.2 A1: POST /api/v1/tournament/swiss/finalize-top8 ต้องแปลงแถว DB → PlayerHistory ก่อนเข้าเอนจิน
// และ bracket_slots.player_id ต้องเป็น player_id จริง (ไม่ใช่ undefined) เรียงตามอันดับ Swiss
// รันในเครื่อง ไม่ต่อ DB · เปิด flag legacyApi เฉพาะเทสนี้

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  inserted: null as Record<string, unknown>[] | null,
}));

vi.mock("@/lib/featureFlags", () => ({
  FEATURES: { payments: false, dotaApi: false, legacyApi: true },
  FEATURE_DISABLED_MESSAGE: "ฟีเจอร์นี้ยังไม่เปิดใช้งาน (feature disabled)",
}));

type Result = { data: unknown; error: null };
interface Builder {
  select: () => Builder;
  eq: () => Builder;
  insert: (rows: Record<string, unknown>[]) => Promise<Result>;
  then: (resolve: (r: Result) => void) => void;
}
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string): Builder => {
      const b: Builder = {
        select: () => b,
        eq: () => b,
        insert: async (rows) => {
          if (table === "bracket_slots") state.inserted = rows;
          return { data: null, error: null };
        },
        then: (resolve) => resolve({ data: table === "tournament_participants" ? state.rows : null, error: null }),
      };
      return b;
    },
  }),
}));

async function post() {
  const { POST } = await import("@/app/api/v1/tournament/swiss/finalize-top8/route");
  const req = new Request("http://localhost/api/v1/tournament/swiss/finalize-top8", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weeklyTournamentId: "t-weekly-1" }),
  });
  return POST(req);
}

describe("POST /api/v1/tournament/swiss/finalize-top8", () => {
  beforeAll(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  });
  beforeEach(() => {
    state.inserted = null;
    // แถวจริงจาก DB: snake_case · ไม่มี userId/opponentsFaced
    state.rows = [
      { player_id: "u-b", score: 1, has_received_bye: false, previous_opponent_ids: ["u-a"] },
      { player_id: "u-a", score: 3, has_received_bye: false, previous_opponent_ids: ["u-b", "u-c"] },
      { player_id: "u-c", score: 2, has_received_bye: true, previous_opponent_ids: ["u-a"] },
    ];
  });

  it("แถว DB เข้าเอนจินได้ → 200 และ player_id เรียงตามคะแนน (ไม่มี undefined)", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(state.inserted).not.toBeNull();
    const ids = (state.inserted ?? []).map((r) => r.player_id);
    expect(ids).toEqual(["u-a", "u-c", "u-b"]);
    for (const row of state.inserted ?? []) {
      expect(row.tournament_id).toBe("t-weekly-1");
      expect(typeof row.player_id).toBe("string");
    }
    expect((state.inserted ?? []).map((r) => r.seed_rank)).toEqual([1, 2, 3]);
  });
});
