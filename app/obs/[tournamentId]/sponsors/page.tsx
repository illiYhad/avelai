import { ObsScreen } from "../../_components/ObsScreen";
import { loadObs } from "../../_components/load";

// K-AV-8: จอ OBS (sponsors) — สาธารณะโดยตั้งใจ (Browser Source) · โหลดครั้งแรกฝั่ง server แล้ว poll ทุก 5 วิ
export const dynamic = "force-dynamic";

export default async function ObsSponsorsPage({ params, searchParams }: { params: Promise<{ tournamentId: string }>; searchParams: Promise<{ theme?: string | string[] }> }) {
  const { tournamentId } = await params;
  const { theme } = await searchParams;
  const r = await loadObs("sponsors", tournamentId, theme);
  if (!r.ok) return <p style={{ color: "#fff", padding: 24 }}>ยังไม่ต่อฐานข้อมูล</p>;
  return <ObsScreen kind="sponsors" tournamentId={tournamentId} theme={r.theme} tournament={r.tournament} initialRows={r.rows} />;
}
