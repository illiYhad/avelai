import { notFound } from "next/navigation";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import NotReadyTab from "../NotReadyTab";

// K-AV-D3.1: ทุก page ใต้เส้นทางแมตช์ผ่านยามเดียวกัน — นับเพดานต่อ IP ตามจริงเมื่อสลับแท็บ
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  return <NotReadyTab label="Objectives" />;
}
