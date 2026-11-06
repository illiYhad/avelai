import type { ChatLine, TimelineEvent } from "@/lib/dota/match/c-events";
import { gameTime } from "@/lib/dota/match/c-events";

// K-AV-D6: รายการแชต — ข้อความผู้เล่นเป็นข้อความธรรมดาเท่านั้น (React escape ทุกตัว · ไม่มี HTML จากข้อมูล)
// chatwheel มีแค่รหัส → แสดง "ชาตวีล #รหัส" ไม่เดาข้อความ
// K-AV-DOTABUFF.1 ข้อ 28: events = เหตุการณ์ประกอบ (ฆ่า · objective) แทรกตามเวลา แยกสีจากแชต · ไม่ส่ง = แชตอย่างเดียวเหมือนเดิม
export default function ChatList({
  lines,
  bySlot,
  events = [],
}: {
  lines: ChatLine[];
  bySlot: (slot: number | null) => string;
  events?: TimelineEvent[];
}) {
  if (lines.length === 0 && events.length === 0) return <p className="text-sm text-ink">แมตช์นี้ไม่มีข้อความแชต</p>;
  const rows = [
    ...lines.map((c, i) => ({ t: c.time, i, c, e: null as TimelineEvent | null })),
    ...events.map((e, i) => ({ t: e.time, i: lines.length + i, c: null as ChatLine | null, e })),
  ].sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || a.i - b.i);
  return (
    <ol className="flex flex-col gap-1 text-xs sm:text-sm">
      {rows.map(({ c, e }, i) => e ? (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line/40 bg-line/20 py-1 italic">
          <span className="w-12 shrink-0 font-mono text-ink-muted">{gameTime(e.time)}</span>
          <span className="font-mono text-ink-muted">{bySlot(e.playerSlot)}</span>
          <span className="text-ink-muted">{e.detail}</span>
        </li>
      ) : c ? (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line/40 py-1">
          <span className="w-12 shrink-0 font-mono text-ink-muted">{gameTime(c.time)}</span>
          <span className="font-mono text-cyan">{bySlot(c.playerSlot)}</span>
          {c.type === "chat" ? (
            <span className="break-all text-ink">{c.key ?? "–"}</span>
          ) : c.type === "chatwheel" ? (
            <span className="text-ink-muted">ชาตวีล #{c.key ?? "–"}</span>
          ) : (
            <span className="text-ink-muted">{c.type}: {c.key ?? "–"}</span>
          )}
        </li>
      ) : null)}
    </ol>
  );
}
