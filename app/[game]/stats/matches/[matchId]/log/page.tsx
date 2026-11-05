import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { buildTimeline, gameTime, slotSide, type TimelineEvent } from "@/lib/dota/match/c-events";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import { cLookups, NoDataNotice, SIDE_CLASS } from "../c-shared";

// K-AV-D6 · แท็บ Log — ไทม์ไลน์รวม (ฆ่า · objective · รูน · วอร์ด) จาก kills_log · objectives · runes_log · obs/sen log
// ทุกแหล่งไม่มี (ยังไม่วิเคราะห์) = บอกว่าไม่มีข้อมูล · แชตอยู่แท็บของตัวเอง
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  kill: "ฆ่า", objective: "Objective", rune: "รูน", ward: "วอร์ด", ward_lost: "วอร์ดหาย",
};

export default async function LogPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null;
  const m = r.data;
  const { bySlot, heroNpc } = await cLookups(m);
  const events = buildTimeline({ objectives: m.objectives, chat: m.chat }, m.players.map((p) => ({ slot: p.slot, logs: p })), heroNpc);
  if (events === null) return <NoDataNotice what="ไทม์ไลน์เหตุการณ์" isParsed={m.isParsed} />;

  return (
    <Surface>
      <h2 className="font-display text-base font-black tracking-wide text-ink">LOG</h2>
      <p className="mt-1 text-xs text-ink-muted">{events.length} เหตุการณ์ เรียงตามเวลา · ฆ่า · objective · รูน · วอร์ด</p>
      <div className="-mx-4 mt-3 max-h-[75vh] overflow-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-max min-w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted">
              <th scope="col" className="py-2 pr-3">เวลา</th>
              <th scope="col" className="py-2 pr-3">ชนิด</th>
              <th scope="col" className="py-2 pr-3">ผู้เล่น</th>
              <th scope="col" className="py-2">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const side = slotSide(e.playerSlot);
              return (
                <tr key={i} className="border-b border-line/40">
                  <td className="py-1.5 pr-3 font-mono text-ink-muted">{gameTime(e.time)}</td>
                  <td className="py-1.5 pr-3 font-mono text-ink-muted">{KIND_LABEL[e.kind]}</td>
                  <td className={`py-1.5 pr-3 font-mono ${side ? SIDE_CLASS[side] : "text-ink-muted"}`}>{bySlot(e.playerSlot)}</td>
                  <td className="py-1.5 text-ink">{e.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}
