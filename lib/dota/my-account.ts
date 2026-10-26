import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// K-AV-D2: บัญชี Dota 2 ที่ผู้ใช้ผูกไว้เอง (game_accounts จาก D1) — อ่านด้วย client ของผู้ใช้ (RLS: เห็นแค่แถวตัวเอง)
// ไม่รับ account_id จาก client ใด ๆ — ทุกหน้า/route ดึงข้อมูลเฉพาะ ID ที่ได้จากที่นี่

export type MyDotaAccount = { externalId: string; verified: boolean };

/** null = ยังไม่ผูก · "unavailable" = อ่านตารางไม่ได้ (เช่น SQL 130 ยังไม่รัน) */
export async function getMyDotaAccount(db: SupabaseClient, userId: string): Promise<MyDotaAccount | null | "unavailable"> {
  const { data, error } = await db
    .from("game_accounts")
    .select("external_id, status")
    .eq("user_id", userId)
    .eq("game", "DOTA2")
    .maybeSingle();
  if (error) return "unavailable";
  if (!data) return null;
  const row = data as { external_id: string; status: string };
  return { externalId: row.external_id, verified: row.status === "VERIFIED" };
}
