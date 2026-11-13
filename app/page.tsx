import { getServerDb } from "@/lib/db/server";
import HomeView from "@/components/home/HomeView";
import PublicHome from "@/components/home/PublicHome";
import { loadMyActivities, loadMyTeams, loadRequestTime, loadTournamentsForYou } from "@/lib/home/load";
import { getLocale } from "@/lib/i18n/server";

// K-AV-H5: หน้าแรก = ทางเข้าเดียว (server · ไม่มี client flash)
// K-AV-HOME.1: ล็อกอินแล้ว → แสดงหน้า Home (เดิม redirect /me) · อ่านอย่างเดียว · อ่านพลาดแต่ละก้อน = ก้อนนั้นว่าง
// K-AV-HOME.0: ยังไม่ล็อกอิน (หรือยังไม่ต่อ DB) → หน้าแรกแบบจำกัด (แบนเนอร์ + ช่อง Match ID + ปุ่มล็อกอิน) แทน redirect /login
// หน้าเก่า (ฟอร์มรหัสผ่านที่ยังไม่ได้ต่อระบบ + ลิงก์ /forgot-password /register ที่ 404) ถูกแทนที่ — ดูได้จาก git history
export const metadata = { title: "AVELAi" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale(); // K-AV-I18N.0b: /en = อังกฤษ (header จาก middleware)
  const db = await getServerDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return <PublicHome locale={locale} />;
  const userId = user.id;

  const [tournaments, activities, teams, now] = await Promise.all([
    loadTournamentsForYou(db),
    loadMyActivities(db, userId),
    loadMyTeams(db, userId),
    loadRequestTime(),
  ]);

  return <HomeView tournaments={tournaments} activities={activities} teams={teams} now={now} locale={locale} />;
}
