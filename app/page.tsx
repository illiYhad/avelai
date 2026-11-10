import { redirect } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import HomeView from "@/components/home/HomeView";
import { loadMyActivities, loadMyTeams, loadRequestTime, loadTournamentsForYou } from "@/lib/home/load";

// K-AV-H5: หน้าแรก = ทางเข้าเดียว (server redirect · ไม่มี client flash)
// ยังไม่ล็อกอิน (หรือยังไม่ต่อ DB) → /login
// K-AV-HOME.1: ล็อกอินแล้ว → แสดงหน้า Home (เดิม redirect /me) · อ่านอย่างเดียว · อ่านพลาดแต่ละก้อน = ก้อนนั้นว่าง
// หน้าเก่า (ฟอร์มรหัสผ่านที่ยังไม่ได้ต่อระบบ + ลิงก์ /forgot-password /register ที่ 404) ถูกแทนที่ — ดูได้จาก git history
export const metadata = { title: "AVELAi" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getServerDb();
  if (!db) redirect("/login");
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  const userId = data.user.id;

  const [tournaments, activities, teams, now] = await Promise.all([
    loadTournamentsForYou(db),
    loadMyActivities(db, userId),
    loadMyTeams(db, userId),
    loadRequestTime(),
  ]);

  return <HomeView tournaments={tournaments} activities={activities} teams={teams} now={now} />;
}
