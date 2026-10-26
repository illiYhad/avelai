import type { SupabaseClient } from "@supabase/supabase-js";
import { isSuspended } from "@/lib/auth/roles";

// K-AV-H2: ผู้ใช้ที่ถูกระงับ (users.suspended_until > now) ต้องเขียนข้อมูลไม่ได้
// ใช้ db ของผู้ใช้เอง — อ่านแถวของตัวเองได้ (K-AV-FIX2: users_select_own_or_admin)
// อ่านไม่ได้ (error) = ถือว่าไม่ปลอดภัย → ปฏิเสธ (fail closed)

export const SUSPENDED_RESULT = {
  error: { code: "SUSPENDED", message: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถทำรายการนี้ได้" },
} as const;

export async function isUserSuspended(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("users")
    .select("suspended_until")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return true;
  return isSuspended(data as { suspended_until: string | null });
}
