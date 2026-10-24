import "server-only";
import { getAdminDb } from "@/lib/db/admin";

// เขียน audit log ลงตาราง audit_logs ของ 001 (append-only · เขียนได้เฉพาะ service role)
// ยกแนวทางจาก Zodiac (actions/team.ts · dispute/resolve) แต่ map คอลัมน์ตามสคีมา 001:
//   action TEXT · table_name · record_id · payload JSONB · performed_by
export async function logAudit(entry: {
  action: string;
  table_name: string;
  record_id?: string | null;
  payload?: Record<string, unknown>;
  performed_by?: string | null;
}): Promise<void> {
  const admin = getAdminDb();
  if (!admin) return; // env-safe: ไม่มี env = ข้ามเงียบ ๆ (ฟีเจอร์ DB ปิดอยู่แล้ว)
  const { error } = await admin.from("audit_logs").insert({
    action: entry.action,
    table_name: entry.table_name,
    record_id: entry.record_id ?? null,
    payload: entry.payload ?? null,
    performed_by: entry.performed_by ?? null,
  });
  if (error) {
    // audit พลาดต้องไม่ล้มงานหลัก แต่ต้องเห็นใน log ฝั่ง server
    console.error("[audit] insert failed:", error.message);
  }
}
