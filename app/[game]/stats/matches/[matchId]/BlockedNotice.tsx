import Surface from "@/components/ui/Surface";
import { PUBLIC_MATCH_BLOCKED_MESSAGE } from "@/lib/dota/match/guard";

// K-AV-D3.1: ข้อความเมื่อเกินเพดานต่อ IP — ใช้ร่วมกันทั้ง layout และทุกแท็บ ไม่มีข้อมูลแมตช์ใด ๆ
// เป็นฟังก์ชันคืน JSX (ไม่ใช่ component) เพื่อให้ผลลัพธ์ของ layout/page มีข้อความอยู่ในต้นไม้โดยตรง เทสตรวจได้
export function blockedNotice(standalone = false) {
  const body = (
    <Surface glow="cyan">
      <p className="text-base text-ink">{PUBLIC_MATCH_BLOCKED_MESSAGE}</p>
    </Surface>
  );
  return standalone ? <main className="mx-auto w-full max-w-6xl px-4 py-10">{body}</main> : body;
}
