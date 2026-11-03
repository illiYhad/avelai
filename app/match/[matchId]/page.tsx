import { permanentRedirect, notFound } from "next/navigation";
import { isValidMatchId } from "@/lib/dota/opendota";

// K-AV-D3: หน้าแมตช์เก่าปิดแล้ว — ย้ายถาวรไปหน้าใหม่ /dota2/stats/matches/[matchId]
// ลบ FALLBACK_MATCH · สูตร KP · ตำแหน่งที่เดาจากช่องผู้เล่น · isRegisteredUser ออกทั้งหมด
// หน้าใหม่เปิดสาธารณะ ไม่ต้องล็อกอิน · เลขแมตช์ไม่ถูกต้อง = 404 (ไม่ redirect มั่ว)
export default async function LegacyMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!isValidMatchId(matchId)) notFound();
  permanentRedirect(`/dota2/stats/matches/${matchId}`);
}
