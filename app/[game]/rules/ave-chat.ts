// K-AV-RULES.3: ตรรกะส่งข้อความแชท AVE (ฟังก์ชันบริสุทธิ์ · ไม่เรียกเครือข่ายเอง)
// ตัวส่งจริง (POST /api/ave/chat) ส่งเข้ามาจาก AveBox.tsx · สัญญา route: {message, history≤6} → 200 {reply} · 401 · 400 {error} · 502/503
import { AVE_MAX_CHARS, AVE_MAX_HISTORY, type AveChatMessage } from "@/lib/ave/chat-input";

export const AVE_CHAT_URL = "/api/ave/chat";
export const AVE_LOGIN_HREF = "/login?next=%2Fdota2%2Frules%23ai-oracle";
export const AVE_LOGIN_TEXT = "เข้าสู่ระบบเพื่อคุยกับ AVE";
export const AVE_SORRY = "ขออภัยค่ะ AVE ตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง";
export const AVE_TOO_LONG = `ข้อความยาวเกิน ${AVE_MAX_CHARS} ตัวอักษร`;
export const AVE_TYPING = "AVE กำลังพิมพ์…";

/** บรรทัดในกล่องแชท · system = ข้อความระบบ (ไม่ส่งเป็น history) */
export type AveLine =
  | { role: "user" | "assistant"; content: string }
  | { role: "system"; kind: "login" | "error"; content: string };

export type AveResult = { kind: "reply"; text: string } | { kind: "login" } | { kind: "error"; text: string };

/** ตัวส่งที่ AveBox ส่งเข้ามา: รับ body (JSON string) คืน response แบบย่อ */
export type AvePost = (body: string) => Promise<{ status: number; json: () => Promise<unknown> }>;

/** ตรวจข้อความก่อนส่ง · ว่าง = ไม่ส่งเงียบ ๆ (error null) · ยาวเกิน = ไม่ส่ง + ข้อความเตือน */
export function checkDraft(text: string): { ok: true; message: string } | { ok: false; error: string | null } {
  const message = text.trim();
  if (!message) return { ok: false, error: null };
  if (message.length > AVE_MAX_CHARS) return { ok: false, error: AVE_TOO_LONG };
  return { ok: true, message };
}

/** history = 6 ข้อความท้ายของบทสนทนา (user/assistant เท่านั้น · ไม่รวมข้อความทักทายแรก ไม่รวมข้อความระบบ) */
export function buildHistory(lines: AveLine[]): AveChatMessage[] {
  const convo: AveChatMessage[] = [];
  for (const l of lines) if (l.role === "user" || l.role === "assistant") convo.push({ role: l.role, content: l.content });
  return convo.slice(-AVE_MAX_HISTORY);
}

export function buildBody(message: string, history: AveChatMessage[]): string {
  return JSON.stringify({ message, history: history.slice(-AVE_MAX_HISTORY) });
}

const errorOf = (v: unknown): string | null =>
  typeof v === "object" && v !== null && typeof (v as { error?: unknown }).error === "string" ? (v as { error: string }).error : null;

/** ส่งข้อความ 1 ครั้ง · ไม่ throw (เน็ตหลุด/อ่าน JSON ไม่ได้ = ข้อความขออภัย) */
export async function askAve(post: AvePost, message: string, history: AveChatMessage[]): Promise<AveResult> {
  try {
    const res = await post(buildBody(message, history));
    if (res.status === 401) return { kind: "login" };
    const data: unknown = await res.json().catch(() => null);
    if (res.status === 200) {
      const reply = typeof data === "object" && data !== null ? (data as { reply?: unknown }).reply : null;
      return typeof reply === "string" && reply.trim() ? { kind: "reply", text: reply } : { kind: "error", text: AVE_SORRY };
    }
    if (res.status === 400) return { kind: "error", text: errorOf(data) ?? AVE_SORRY };
    return { kind: "error", text: AVE_SORRY };
  } catch {
    return { kind: "error", text: AVE_SORRY };
  }
}

/** ผลที่ได้ → บรรทัดที่ต่อท้ายกล่องแชท */
export function resultToLine(r: AveResult): AveLine {
  if (r.kind === "reply") return { role: "assistant", content: r.text };
  if (r.kind === "login") return { role: "system", kind: "login", content: AVE_LOGIN_TEXT };
  return { role: "system", kind: "error", content: r.text };
}
