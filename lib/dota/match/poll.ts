// K-AV-D3.1: ตัวติดตามสถานะงานวิเคราะห์ — ส่วน pure (ไม่แตะ React/DOM) เทสด้วย fake timers ได้
// ถามสถานะทุก 10 วินาที สูงสุด 5 นาที · หยุดได้ทันทีเมื่อออกจากหน้า

export const PARSE_POLL_INTERVAL_MS = 10 * 1000;
export const PARSE_POLL_MAX_MS = 5 * 60 * 1000;

export type ParseStatus = "pending" | "done" | "error";

export type ParsePollerOptions = {
  /** ถามสถานะหนึ่งครั้ง · คืน "pending" / "done" / "error" (error = ถามไม่สำเร็จ ให้ถามต่อรอบหน้า) */
  fetchStatus: () => Promise<ParseStatus>;
  /** OpenDota บอกว่างานหมดแล้ว (ยังไม่รู้ว่าวิเคราะห์สำเร็จหรือไม่ — ผู้เรียกต้องตรวจ isParsed เอง) */
  onDone: () => void;
  /** เกิน 5 นาทียังไม่จบ */
  onTimeout: () => void;
  intervalMs?: number;
  maxMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
};

/** เริ่มติดตาม · คืนฟังก์ชันหยุด (เรียกตอน unmount) — หยุดแล้วจะไม่เรียก callback ใดอีก */
export function startParsePoller(o: ParsePollerOptions): () => void {
  const intervalMs = o.intervalMs ?? PARSE_POLL_INTERVAL_MS;
  const maxMs = o.maxMs ?? PARSE_POLL_MAX_MS;
  const now = o.now ?? Date.now;
  const setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const startedAt = now();
  let stopped = false;
  let timer: unknown = null;

  const schedule = () => {
    if (stopped) return;
    timer = setTimer(tick, intervalMs);
  };

  const tick = async () => {
    if (stopped) return;
    let status: ParseStatus = "error";
    try {
      status = await o.fetchStatus();
    } catch {
      status = "error";
    }
    if (stopped) return;
    if (status === "done") {
      stopped = true;
      o.onDone();
      return;
    }
    if (now() - startedAt >= maxMs) {
      stopped = true;
      o.onTimeout();
      return;
    }
    schedule();
  };

  schedule();
  return () => {
    stopped = true;
    if (timer !== null) clearTimer(timer);
  };
}

/** แปลงคำตอบ GET /api/games/dota2/parse/status/[jobId] เป็นสถานะ · โครงเพี้ยน = error ไม่ใช่ done */
export function readStatusBody(httpOk: boolean, body: unknown): ParseStatus {
  if (!httpOk || !body || typeof body !== "object") return "error";
  const s = (body as Record<string, unknown>).status;
  return s === "done" ? "done" : s === "pending" ? "pending" : "error";
}
