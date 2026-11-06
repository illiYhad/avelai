import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import ChatList from "../ChatList";
import { cLookups, NoDataNotice } from "../c-shared";
import { buildTimeline } from "@/lib/dota/match/c-events";

// K-AV-D6 · แท็บ Chat — match.chat ของ OpenDota · ข้อความเป็น plain text (escape โดย React) · ไม่มีฟิลด์ = บอกว่าไม่มีข้อมูล
// K-AV-DOTABUFF.1 ข้อ 28: แทรก objective และการฆ่าจาก buildTimeline เป็นเหตุการณ์ประกอบ แยกสีจากข้อความแชต
export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null;
  const m = r.data;
  if (m.chat === null) return <NoDataNotice what="แชต" isParsed={m.isParsed} />;
  const { bySlot, heroNpc } = await cLookups(m);
  const events = (buildTimeline({ objectives: m.objectives, chat: m.chat }, m.players.map((p) => ({ slot: p.slot, logs: p })), heroNpc) ?? [])
    .filter((e) => e.kind === "kill" || e.kind === "objective");
  return (
    <Surface>
      <h2 className="font-display text-base font-black tracking-wide text-ink">CHAT</h2>
      <p className="mt-1 text-xs text-ink-muted">ข้อความ {m.chat.length} รายการ · แสดงตามที่ผู้เล่นพิมพ์ ไม่แปลง HTML · ชาตวีลแสดงเป็นรหัส · แถวสีเทาตัวเอียง = เหตุการณ์ประกอบ (ฆ่า · objective) {events.length} รายการ</p>
      <div className="mt-3 max-h-[70vh] overflow-y-auto">
        <ChatList lines={m.chat} bySlot={bySlot} events={events} />
      </div>
    </Surface>
  );
}
