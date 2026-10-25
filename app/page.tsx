import { redirect } from "next/navigation";
import { getServerDb } from "@/lib/db/server";

// K-AV-H5: หน้าแรก = ทางเข้าเดียว (server redirect · ไม่มี client flash)
// ยังไม่ล็อกอิน (หรือยังไม่ต่อ DB) → /login · ล็อกอินแล้ว → /me (ปลายทางเดียวกับ next ใน /auth/callback)
// หน้าเก่า (ฟอร์มรหัสผ่านที่ยังไม่ได้ต่อระบบ + ลิงก์ /forgot-password /register ที่ 404) ถูกแทนที่ — ดูได้จาก git history
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getServerDb();
  if (!db) redirect("/login");
  const { data } = await db.auth.getUser();
  redirect(data.user ? "/me" : "/login");
}
