import { permanentRedirect, notFound } from "next/navigation";
import { isValidMatchId } from "@/lib/dota/opendota";

// K-AV-D3: รวมหน้าแมตช์ไว้ที่เดียว — ย้ายถาวรไป /dota2/stats/matches/[matchId] (เปิดสาธารณะ)
export default async function LegacyMyMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!isValidMatchId(matchId)) notFound();
  permanentRedirect(`/dota2/stats/matches/${matchId}`);
}
