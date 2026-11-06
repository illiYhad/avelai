import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { gameTime, slotSide } from "@/lib/dota/match/c-events";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import { cLookups, NoDataNotice, SIDE_CLASS } from "../c-shared";
import { VisionD } from "../d-tabs"; // K-AV-DOTABUFF.1 ข้อ 23-26

// K-AV-D6 · แท็บ Vision — obs_log / sen_log (วาง · มีพิกัด x,y) และ obs_left_log / sen_left_log (ถูกทำลาย/หมดอายุ · มี attackername ถ้าถูกทำลาย)
// ไม่มีฟิลด์ (ยังไม่วิเคราะห์) = บอกว่าไม่มีข้อมูล · ดัสต์/สโมก/เจม ไม่มีใน log นี้ จึงไม่แสดง
export const dynamic = "force-dynamic";

type Row = { time: number | null; slot: number | null; kind: string; pos: string; by: string | null };

export default async function VisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string; matchId: string }>;
  searchParams: Promise<{ w?: string | string[] }>;
}) {
  const { game, matchId } = await params;
  const sp = await searchParams;
  const w = typeof sp.w === "string" ? sp.w : undefined; // ช่วงนาทีของแผนที่วอร์ด (ข้อ 26) · ค่าที่ไม่รู้จัก = ทั้งเกม
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null;
  const m = r.data;
  const has = m.players.some((p) => p.obsLog !== null || p.senLog !== null || p.obsLeftLog !== null || p.senLeftLog !== null);
  if (!has) return <NoDataNotice what="วอร์ด" isParsed={m.isParsed} />;
  const { bySlot, heroNpc } = await cLookups(m);

  const pos = (x: number | null, y: number | null, key: string | null) => (x !== null && y !== null ? `(${Math.round(x)}, ${Math.round(y)})` : key ?? "–");
  const rows: Row[] = m.players.flatMap((p) => [
    ...(p.obsLog ?? []).map((w) => ({ time: w.time, slot: p.slot, kind: "วาง Observer", pos: pos(w.x, w.y, w.key), by: null })),
    ...(p.senLog ?? []).map((w) => ({ time: w.time, slot: p.slot, kind: "วาง Sentry", pos: pos(w.x, w.y, w.key), by: null })),
    ...(p.obsLeftLog ?? []).map((w) => ({ time: w.time, slot: p.slot, kind: w.attacker ? "Observer ถูกทำลาย" : "Observer หมดอายุ", pos: w.key ?? "–", by: w.attacker ? heroNpc(w.attacker) : null })),
    ...(p.senLeftLog ?? []).map((w) => ({ time: w.time, slot: p.slot, kind: w.attacker ? "Sentry ถูกทำลาย" : "Sentry หมดอายุ", pos: w.key ?? "–", by: w.attacker ? heroNpc(w.attacker) : null })),
  ]).sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));

  const summary = m.players.map((p) => ({
    slot: p.slot, side: p.isRadiant,
    obs: p.obsLog === null ? null : p.obsLog.length,
    sen: p.senLog === null ? null : p.senLog.length,
    obsLost: p.obsLeftLog === null ? null : p.obsLeftLog.filter((w) => w.attacker).length,
    senLost: p.senLeftLog === null ? null : p.senLeftLog.filter((w) => w.attacker).length,
  }));
  const d = (v: number | null) => (v === null ? "–" : v);

  return (
    <div className="flex flex-col gap-6">
      <Surface glow="gold">
        <h2 className="font-display text-base font-black tracking-wide text-ink">วอร์ด รายผู้เล่น</h2>
        <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-max min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-3">ผู้เล่น</th>
                <th scope="col" className="py-2 pr-3">Obs วาง</th>
                <th scope="col" className="py-2 pr-3">Sen วาง</th>
                <th scope="col" className="py-2 pr-3">Obs ถูกทำลาย</th>
                <th scope="col" className="py-2">Sen ถูกทำลาย</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((p, i) => (
                <tr key={`${p.slot ?? i}`} className="border-b border-line/40">
                  <th scope="row" className={`py-1.5 pr-3 text-left font-mono font-normal ${p.side === true ? SIDE_CLASS.Radiant : p.side === false ? SIDE_CLASS.Dire : ""}`}>{bySlot(p.slot)}</th>
                  <td className="py-1.5 pr-3 font-mono">{d(p.obs)}</td>
                  <td className="py-1.5 pr-3 font-mono">{d(p.sen)}</td>
                  <td className="py-1.5 pr-3 font-mono">{d(p.obsLost)}</td>
                  <td className="py-1.5 font-mono">{d(p.senLost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
      <Surface>
        <h2 className="font-display text-base font-black tracking-wide text-ink">ประวัติวอร์ด</h2>
        <p className="mt-1 text-xs text-ink-muted">{rows.length} เหตุการณ์ · พิกัดเป็นค่าตารางของ OpenDota (x, y) · ยังไม่มีแผนที่</p>
        <div className="-mx-4 mt-3 max-h-[70vh] overflow-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-max min-w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-3">เวลา</th>
                <th scope="col" className="py-2 pr-3">ผู้เล่น</th>
                <th scope="col" className="py-2 pr-3">เหตุการณ์</th>
                <th scope="col" className="py-2 pr-3">ตำแหน่ง</th>
                <th scope="col" className="py-2">โดย</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const side = slotSide(e.slot);
                return (
                  <tr key={i} className="border-b border-line/40">
                    <td className="py-1.5 pr-3 font-mono text-ink-muted">{gameTime(e.time)}</td>
                    <td className={`py-1.5 pr-3 font-mono ${side ? SIDE_CLASS[side] : ""}`}>{bySlot(e.slot)}</td>
                    <td className="py-1.5 pr-3 text-ink">{e.kind}</td>
                    <td className="py-1.5 pr-3 font-mono">{e.pos}</td>
                    <td className="py-1.5 font-mono">{e.by ?? "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>
      <VisionD m={m} range={w} basePath={`/${game}/stats/matches/${matchId}/vision`} />
    </div>
  );
}
