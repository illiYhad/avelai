import { notFound } from "next/navigation";
import Link from "next/link";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { buildTimeline, gameTime, slotSide, type TimelineEvent } from "@/lib/dota/match/c-events";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import { cLookups, NoDataNotice, SIDE_CLASS } from "../c-shared";

// K-AV-D6 · แท็บ Log — ไทม์ไลน์รวม (ฆ่า · objective · รูน · วอร์ด) จาก kills_log · objectives · runes_log · obs/sen log
// ทุกแหล่งไม่มี (ยังไม่วิเคราะห์) = บอกว่าไม่มีข้อมูล · แชตอยู่แท็บของตัวเอง
// ใบ 28 รายการ (2026-11-06) ข้อ 27: ตัวกรองตาม kind ผ่าน ?kind= (ลิงก์ธรรมดา ไม่มี client JS) · ค่าที่ไม่รู้จัก = ทั้งหมด
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  kill: "ฆ่า", objective: "Objective", rune: "รูน", ward: "วอร์ด", ward_lost: "วอร์ดหาย",
};

const KINDS = Object.keys(KIND_LABEL) as TimelineEvent["kind"][];
const isKind = (v: unknown): v is TimelineEvent["kind"] => typeof v === "string" && (KINDS as string[]).includes(v);

export default async function LogPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string; matchId: string }>;
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const { game, matchId } = await params;
  const sp = await searchParams;
  const kind = isKind(sp.kind) ? sp.kind : null;
  const base = `/${game}/stats/matches/${matchId}/log`;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null;
  const m = r.data;
  const { bySlot, heroNpc } = await cLookups(m);
  const events = buildTimeline({ objectives: m.objectives, chat: m.chat }, m.players.map((p) => ({ slot: p.slot, logs: p })), heroNpc);
  if (events === null) return <NoDataNotice what="ไทม์ไลน์เหตุการณ์" isParsed={m.isParsed} />;
  const shown = kind ? events.filter((e) => e.kind === kind) : events;

  return (
    <Surface>
      <h2 className="font-display text-base font-black tracking-wide text-ink">LOG</h2>
      <p className="mt-1 text-xs text-ink-muted">{shown.length} จาก {events.length} เหตุการณ์ เรียงตามเวลา · ฆ่า · objective · รูน · วอร์ด</p>
      <nav aria-label="กรองชนิดเหตุการณ์" className="mt-3 flex flex-wrap gap-2">
        {[null, ...KINDS].map((k) => (
          <Link
            key={k ?? "all"}
            href={k ? `${base}?kind=${k}` : base}
            scroll={false}
            prefetch={false}
            className={`rounded border px-2 py-1 font-mono text-xs ${k === kind ? "border-cyan text-cyan" : "border-line text-ink-muted"}`}
          >
            {k ? KIND_LABEL[k] : "ทั้งหมด"} ({k ? events.filter((e) => e.kind === k).length : events.length})
          </Link>
        ))}
      </nav>
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
            {shown.map((e, i) => {
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
