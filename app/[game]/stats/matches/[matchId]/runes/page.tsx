import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { gameTime, runeName, slotSide } from "@/lib/dota/match/c-events";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import { cLookups, NoDataNotice, SIDE_CLASS } from "../c-shared";
import { RunesD } from "../d-tabs"; // ใบ 28 รายการ (2026-11-06) ข้อ 21-22

// K-AV-D6 · แท็บ Runes — players[].runes_log {time,key} ของ OpenDota · ไม่มีฟิลด์ (ยังไม่วิเคราะห์) = บอกว่าไม่มีข้อมูล
// OpenDota ให้เฉพาะ "รูนที่เก็บ" ไม่ให้รูนที่เกิด/ตำแหน่ง → ไม่แสดงสิ่งที่ไม่มี
export const dynamic = "force-dynamic";

export default async function RunesPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null;
  const m = r.data;
  if (!m.players.some((p) => p.runesLog !== null)) return <NoDataNotice what="รูน" isParsed={m.isParsed} />;
  const { bySlot } = await cLookups(m);

  const rows = m.players
    .flatMap((p) => (p.runesLog ?? []).map((e) => ({ time: e.time, key: e.key, slot: p.slot })))
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
  const perPlayer = m.players.map((p) => ({ slot: p.slot, side: p.isRadiant, n: p.runesLog === null ? null : p.runesLog.length }));

  return (
    <div className="flex flex-col gap-6">
      <Surface glow="gold">
        <h2 className="font-display text-base font-black tracking-wide text-ink">รูนที่เก็บ รายผู้เล่น</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 sm:text-sm">
          {perPlayer.map((p, i) => (
            <li key={`${p.slot ?? i}`} className="flex justify-between gap-3 border-b border-line/40 py-1">
              <span className={`font-mono ${p.side === true ? SIDE_CLASS.Radiant : p.side === false ? SIDE_CLASS.Dire : "text-ink"}`}>{bySlot(p.slot)}</span>
              <span className="font-mono text-ink">{p.n === null ? "–" : p.n}</span>
            </li>
          ))}
        </ul>
      </Surface>
      <Surface>
        <h2 className="font-display text-base font-black tracking-wide text-ink">ประวัติการเก็บรูน</h2>
        <p className="mt-1 text-xs text-ink-muted">{rows.length} ครั้ง · ตำแหน่งรูนไม่มีในข้อมูล OpenDota จึงไม่แสดง</p>
        <div className="-mx-4 mt-3 max-h-[70vh] overflow-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-max min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-3">เวลา</th>
                <th scope="col" className="py-2 pr-3">ผู้เล่น</th>
                <th scope="col" className="py-2 pr-3">ฝั่ง</th>
                <th scope="col" className="py-2">รูน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const side = slotSide(e.slot);
                return (
                  <tr key={i} className="border-b border-line/40">
                    <td className="py-1.5 pr-3 font-mono text-ink-muted">{gameTime(e.time)}</td>
                    <td className="py-1.5 pr-3 font-mono">{bySlot(e.slot)}</td>
                    <td className={`py-1.5 pr-3 font-mono ${side ? SIDE_CLASS[side] : "text-ink-muted"}`}>{side ?? "–"}</td>
                    <td className="py-1.5 text-ink">{runeName(e.key)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>
      <RunesD m={m} />
    </div>
  );
}
