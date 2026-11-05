import type { ChatLine } from "@/lib/dota/match/c-events";
import { gameTime } from "@/lib/dota/match/c-events";

// K-AV-D6: รายการแชต — ข้อความผู้เล่นเป็นข้อความธรรมดาเท่านั้น (React escape ทุกตัว · ไม่มี HTML จากข้อมูล)
// chatwheel มีแค่รหัส → แสดง "ชาตวีล #รหัส" ไม่เดาข้อความ
export default function ChatList({ lines, bySlot }: { lines: ChatLine[]; bySlot: (slot: number | null) => string }) {
  if (lines.length === 0) return <p className="text-sm text-ink">แมตช์นี้ไม่มีข้อความแชต</p>;
  return (
    <ol className="flex flex-col gap-1 text-xs sm:text-sm">
      {lines.map((c, i) => (
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
      ))}
    </ol>
  );
}
