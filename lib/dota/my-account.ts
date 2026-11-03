import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// K-AV-D2: บัญชี Dota 2 ที่ผู้ใช้ผูกไว้เอง (game_accounts จาก D1) — อ่านด้วย client ของผู้ใช้ (RLS: เห็นแค่แถวตัวเอง)
// ไม่รับ account_id จาก client ใด ๆ — ทุกหน้า/route ดึงข้อมูลเฉพาะ ID ที่ได้จากที่นี่
// K-AV-LINK.1: คืน ID เฉพาะแถว VERIFIED (ยืนยันผ่าน Steam) · แถวเก่าที่กรอกมือ (UNVERIFIED) ไม่คืน ID
// → ไม่มีหน้าไหนเอาเลขที่ใครก็กรอกได้ไปแสดงสถิติเป็นของผู้ใช้คนนี้

export type MyDotaAccount = { externalId: string };

/** null = ยังไม่ผูก · "unverified" = มีแถวแต่ยังไม่ยืนยัน (ให้ผูก Steam) · "unavailable" = อ่านตารางไม่ได้ (เช่น SQL 130 ยังไม่รัน) */
export async function getMyDotaAccount(
  db: SupabaseClient,
  userId: string,
): Promise<MyDotaAccount | null | "unverified" | "unavailable"> {
  const { data, error } = await db
    .from("game_accounts")
    .select("external_id, status")
    .eq("user_id", userId)
    .eq("game", "DOTA2")
    .maybeSingle();
  if (error) return "unavailable";
  if (!data) return null;
  const row = data as { external_id: string; status: string };
  if (row.status !== "VERIFIED") return "unverified";
  return { externalId: row.external_id };
}
