"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Surface from "@/components/ui/Surface";
import { readStatusBody, startParsePoller } from "@/lib/dota/match/poll";

// K-AV-D3: ปุ่มขอวิเคราะห์แมตช์ — ไม่ส่งคำขออัตโนมัติ ผู้ใช้ต้องกดเอง
// ไม่ล็อกอิน = พาไปหน้าล็อกอินพร้อมพากลับมาหน้าเดิม
// K-AV-D3.1: ได้ jobId แล้วถามสถานะทุก 10 วิ สูงสุด 5 นาที · งานจบ = refresh แล้วตรวจ isParsed จากเซิร์ฟเวอร์
//   ห้ามถือว่าสำเร็จเพียงเพราะงานหายไปจากคิวของ OpenDota
type Kind = "idle" | "sending" | "pending" | "checking" | "finished-unparsed" | "timeout" | "done" | "error";
type State = { kind: Kind; message?: string };

const MSG_FINISHED_UNPARSED = "งานจบแล้ว แต่ยังไม่พบผลวิเคราะห์ ข้อมูลอาจอัปเดตภายใน 10 นาที";
const MSG_TIMEOUT = "รอครบ 5 นาทีแล้วยังไม่พบผลวิเคราะห์ กดขอใหม่ได้";
const MSG_PARSED = "วิเคราะห์แมตช์สำเร็จแล้ว";

export default function ParseRequestPanel({ matchId, isParsed }: { matchId: string; isParsed: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [refreshing, startRefresh] = useTransition();
  const stopRef = useRef<(() => void) | null>(null);

  // หยุดติดตามเมื่อออกจากหน้า
  useEffect(() => () => stopRef.current?.(), []);

  // หลัง refresh เสร็จ (refreshing=false): ตัดสินจาก isParsed ที่เซิร์ฟเวอร์ส่งมาใหม่เท่านั้น — คำนวณตอน render ไม่ใช้ setState ใน effect
  const view: State =
    state.kind === "checking" && !refreshing
      ? isParsed
        ? { kind: "done", message: MSG_PARSED }
        : { kind: "finished-unparsed", message: MSG_FINISHED_UNPARSED }
      : state;

  function follow(jobId: string) {
    stopRef.current?.();
    stopRef.current = startParsePoller({
      fetchStatus: async () => {
        const res = await fetch(`/api/games/dota2/parse/status/${encodeURIComponent(jobId)}`);
        const body: unknown = await res.json().catch(() => null);
        return readStatusBody(res.ok, body);
      },
      onDone: () => {
        setState({ kind: "checking", message: "งานวิเคราะห์จบแล้ว กำลังตรวจผล" });
        startRefresh(() => router.refresh());
      },
      onTimeout: () => setState({ kind: "timeout", message: MSG_TIMEOUT }),
    });
  }

  async function onClick() {
    setState({ kind: "sending" });
    try {
      const res = await fetch(`/api/games/dota2/parse/${matchId}`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; status?: string; jobId?: string | null };
      if (res.status === 401) {
        const back = `/dota2/stats/matches/${matchId}`;
        router.push(`/login?next=${encodeURIComponent(back)}`);
        return;
      }
      if (res.status === 409) {
        setState({ kind: "done", message: body.message ?? "แมตช์นี้วิเคราะห์แล้ว" });
        router.refresh();
        return;
      }
      if (!res.ok) {
        // รวมกรณี 502 "rejected" — ข้อความปฏิเสธจริงจาก OpenDota · กดใหม่ได้
        setState({ kind: "error", message: body.error ?? body.message ?? "ส่งคำขอไม่สำเร็จ" });
        return;
      }
      if (typeof body.jobId === "string" && body.jobId) {
        setState({ kind: "pending", message: body.message ?? "ส่งคำขอวิเคราะห์แล้ว กำลังรอผล" });
        follow(body.jobId);
      } else {
        setState({ kind: "error", message: "ส่งคำขอแล้วแต่ไม่ได้หมายเลขงาน กดขอใหม่ได้" });
      }
    } catch {
      setState({ kind: "error", message: "ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ" });
    }
  }

  // วิเคราะห์แล้วและไม่ได้อยู่ระหว่างรายงานผล = ไม่ต้องแสดงอะไร
  if (isParsed && view.kind !== "done") return null;

  const busy = view.kind === "sending" || view.kind === "pending" || view.kind === "checking" || view.kind === "done";
  const label =
    view.kind === "sending" ? "กำลังส่ง…" : view.kind === "pending" ? "กำลังรอผล" : view.kind === "checking" ? "กำลังตรวจผล" : view.kind === "done" ? "เสร็จแล้ว" : "ขอวิเคราะห์แมตช์นี้";

  return (
    <Surface glow="cyan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink">
            {isParsed ? "แมตช์นี้วิเคราะห์แล้ว" : "แมตช์นี้ยังไม่ถูกวิเคราะห์ ข้อมูลเชิงลึกจึงยังไม่ครบ"}
          </p>
          {view.message ? (
            <p className={`text-xs ${view.kind === "error" || view.kind === "timeout" ? "text-red-400" : "text-cyan"}`}>{view.message}</p>
          ) : null}
        </div>
        {isParsed ? null : (
          <button type="button" onClick={onClick} disabled={busy} className="btn-primary min-h-11 px-4 text-sm disabled:opacity-60">
            {label}
          </button>
        )}
      </div>
    </Surface>
  );
}
