// K-AV-AVE.1: ตรวจคำขอแชท AVE (รูปเดียวกับที่ components/AVEChatbot.tsx ส่ง) · ฟังก์ชันบริสุทธิ์ ไม่แตะเครือข่าย/DB

export const AVE_MAX_CHARS = 1000;
export const AVE_MAX_HISTORY = 6;

export type AveChatMessage = { role: "user" | "assistant"; content: string };
export type ParsedChatInput = { ok: true; messages: AveChatMessage[] } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** รับ { message, history? } · history เก็บ 6 รายการท้าย · role จากเครื่องผู้ใช้รับแค่ user/assistant (ทิ้ง system) */
export function parseChatInput(body: unknown): ParsedChatInput {
  if (!isRecord(body)) return { ok: false, error: "รูปแบบคำขอไม่ถูกต้อง" };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return { ok: false, error: "กรุณาพิมพ์ข้อความ" };
  if (message.length > AVE_MAX_CHARS) return { ok: false, error: `ข้อความยาวเกิน ${AVE_MAX_CHARS} ตัวอักษร` };

  const rawHistory = Array.isArray(body.history) ? body.history.slice(-AVE_MAX_HISTORY) : [];
  const history: AveChatMessage[] = [];
  for (const h of rawHistory) {
    if (!isRecord(h)) continue;
    if (h.role !== "user" && h.role !== "assistant") continue;
    if (typeof h.content !== "string") continue;
    history.push({ role: h.role, content: h.content.slice(0, AVE_MAX_CHARS) });
  }
  return { ok: true, messages: [...history, { role: "user", content: message }] };
}
