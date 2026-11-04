import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// K-AV-POLISH เฟส 1 ข้อ 3: POST /api/v1/rewards/redeem ต้องเอา user_id จาก session เท่านั้น
// - ไม่มี session → 401 และห้ามแตะ DB (service-role) เลย
// - มี session → ทุก query/insert ผูกกับ user ของ session ไม่ใช่ค่าคงที่ และไม่รับ user_id จาก body
// รันในเครื่อง ไม่ต่อ DB/เน็ต · เปิด flag payments เฉพาะในเทสนี้

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  serviceCreated: 0,
  eqs: [] as [table: string, column: string, value: unknown][],
  inserts: [] as [table: string, row: Record<string, unknown>][],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/featureFlags", () => ({
  FEATURES: { payments: true, dotaApi: false, legacyApi: false },
  FEATURE_DISABLED_MESSAGE: "ฟีเจอร์นี้ยังไม่เปิดใช้งาน (feature disabled)",
}));
// client ของผู้ใช้ (ssr): session ตาม state.user
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  }),
}));

type Result = { data: unknown; error: null };
interface Builder {
  select: () => Builder;
  update: (row: Record<string, unknown>) => Builder;
  eq: (column: string, value: unknown) => Builder;
  insert: (row: Record<string, unknown>) => Promise<Result>;
  maybeSingle: () => Promise<Result>;
  single: () => Promise<Result>;
  then: (resolve: (r: Result) => void) => void;
}
function builder(table: string): Builder {
  const b: Builder = {
    select: () => b,
    update: () => b,
    eq: (column, value) => {
      state.eqs.push([table, column, value]);
      return b;
    },
    insert: async (row) => {
      state.inserts.push([table, row]);
      return { data: null, error: null };
    },
    maybeSingle: async () => ({ data: null, error: null }), // ยังไม่มี tx ซ้ำ
    single: async () => ({ data: { wallet_id: "w1", balance: 100 }, error: null }),
    then: (resolve) => resolve({ data: null, error: null }), // await update().eq()
  };
  return b;
}
// service-role client จาก supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    state.serviceCreated++;
    return { from: (table: string) => builder(table) };
  },
}));

async function post(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/v1/rewards/redeem/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost/api/v1/rewards/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

const PAYLOAD = { itemId: "item-1", costPoints: 30, idempotencyKey: "idem-1" };

describe("POST /api/v1/rewards/redeem ใช้ user จาก session", () => {
  beforeAll(() => {
    vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  });
  beforeEach(() => {
    state.user = null;
    state.serviceCreated = 0;
    state.eqs = [];
    state.inserts = [];
  });

  it("ไม่มี session → 401 และไม่แตะ DB", async () => {
    const res = await post(PAYLOAD);
    expect(res.status).toBe(401);
    expect(state.eqs).toEqual([]);
    expect(state.inserts).toEqual([]);
    expect(state.serviceCreated, "สร้าง service-role client ก่อนเช็ก session").toBe(0);
  });

  it("มี session → ทุกแถวผูกกับ user ของ session · user_id ใน body ถูกเมิน", async () => {
    state.user = { id: "11111111-1111-1111-1111-111111111111" };
    const res = await post({ ...PAYLOAD, user_id: "22222222-2222-2222-2222-222222222222", userId: "someone-else" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; new_balance: number };
    expect(json.success).toBe(true);
    expect(json.new_balance).toBe(70);

    const walletEqs = state.eqs.filter(([table, column]) => table === "user_token_wallets" && column === "user_id");
    expect(walletEqs.length).toBeGreaterThanOrEqual(2); // อ่านยอด + อัปเดตยอด
    for (const [, , value] of walletEqs) expect(value).toBe(state.user.id);

    const byTable = Object.fromEntries(state.inserts.map(([t, row]) => [t, row]));
    expect(byTable.token_transactions?.user_id).toBe(state.user.id);
    expect(byTable.user_inventory?.user_id).toBe(state.user.id);
    for (const [, row] of state.inserts) expect(row.user_id).not.toBe("22222222-2222-2222-2222-222222222222");
  });
});
