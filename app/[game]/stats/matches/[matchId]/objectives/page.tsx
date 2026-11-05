import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { gameTime, objectiveKind, objectiveLabel, objectiveSide } from "@/lib/dota/match/c-events";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import { cLookups, NoDataNotice, SIDE_CLASS } from "../c-shared";

// K-AV-D6 · แท็บ Objectives — match.objectives ของ OpenDota (building_kill · ROSHAN_KILL · AEGIS · FIRSTBLOOD · COURIER_LOST …)
// ทีมที่ "ทำ": building_kill ใช้ player_slot/unit ของผู้ทำลาย · ชนิดอื่นใช้ team/player_slot ตามที่มี · ไม่มี = "–"
export const dynamic = "force-dynamic";

export default async function ObjectivesPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null;
  const m = r.data;
  if (m.objectives === null) return <NoDataNotice what="เหตุการณ์ป้อม/Roshan" isParsed={m.isParsed} />;
  const { bySlot, heroNpc } = await cLookups(m);
  const objs = m.objectives;

  // ฝั่งที่ได้ objective: building_kill = ตรงข้ามเจ้าของสิ่งก่อสร้าง (ครีปทำลายก็รู้) · อื่น ๆ = player_slot แล้ว team · ไม่มี = null
  const actorSide = objectiveSide;
  const count = (side: "Radiant" | "Dire", kind: ReturnType<typeof objectiveKind>) =>
    objs.filter((o) => objectiveKind(o) === kind && actorSide(o) === side).length;
  const hasTormentor = objs.some((o) => objectiveKind(o) === "tormentor");

  return (
    <div className="flex flex-col gap-6">
      <Surface glow="gold">
        <h2 className="font-display text-base font-black tracking-wide text-ink">สรุป OBJECTIVES</h2>
        <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-max min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-3">ทีม</th>
                <th scope="col" className="py-2 pr-3">ป้อมที่ทำลาย</th>
                <th scope="col" className="py-2 pr-3">บาร์แร็คที่ทำลาย</th>
                <th scope="col" className="py-2 pr-3">Roshan</th>
                <th scope="col" className="py-2">Tormentor</th>
              </tr>
            </thead>
            <tbody>
              {(["Radiant", "Dire"] as const).map((side) => (
                <tr key={side} className="border-b border-line/50">
                  <th scope="row" className={`py-2 pr-3 text-left font-mono ${SIDE_CLASS[side]}`}>{side}</th>
                  <td className="py-2 pr-3 font-mono">{count(side, "tower")}</td>
                  <td className="py-2 pr-3 font-mono">{count(side, "barracks")}</td>
                  <td className="py-2 pr-3 font-mono">{count(side, "roshan")}</td>
                  <td className="py-2 font-mono">{hasTormentor ? count(side, "tormentor") : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasTormentor ? <p className="mt-2 text-xs text-ink-muted">Tormentor: ไม่มีข้อมูลในแมตช์นี้ (OpenDota ไม่ส่งเหตุการณ์นี้มา)</p> : null}
      </Surface>

      <Surface>
        <h2 className="font-display text-base font-black tracking-wide text-ink">ไทม์ไลน์ OBJECTIVES</h2>
        <p className="mt-1 text-xs text-ink-muted">{objs.length} เหตุการณ์ · เรียงตามเวลาที่ OpenDota ให้</p>
        <div className="-mx-4 mt-3 max-h-[70vh] overflow-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-max min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-3">เวลา</th>
                <th scope="col" className="py-2 pr-3">เหตุการณ์</th>
                <th scope="col" className="py-2 pr-3">ทีม</th>
                <th scope="col" className="py-2">โดย</th>
              </tr>
            </thead>
            <tbody>
              {objs.map((o, i) => {
                const side = actorSide(o);
                const by = o.playerSlot !== null ? bySlot(o.playerSlot) : o.unit ? heroNpc(o.unit) : "–";
                return (
                  <tr key={i} className="border-b border-line/40">
                    <td className="py-1.5 pr-3 font-mono text-ink-muted">{gameTime(o.time)}</td>
                    <td className="py-1.5 pr-3 text-ink">{objectiveLabel(o)}</td>
                    <td className={`py-1.5 pr-3 font-mono ${side ? SIDE_CLASS[side] : "text-ink-muted"}`}>{side ?? "–"}</td>
                    <td className="py-1.5 font-mono">{by}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  );
}
