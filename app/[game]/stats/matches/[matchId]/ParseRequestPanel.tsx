"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Surface from "@/components/ui/Surface";

// K-AV-D3: ปุ่มขอวิเคราะห์แมตช์ — ไม่ส่งคำขออัตโนมัติ ผู้ใช้ต้องกดเอง
// ไม่ล็อกอิน = พาไปหน้าล็อกอินพร้อมพากลับมาหน้าเดิม
type State = { kind: "idle" | "sending" | "pending" | "done" | "error"; message?: string };

export default function ParseRequestPanel({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onClick() {
    setState({ kind: "sending" });
    try {
      const res = await fetch(`/api/games/dota2/parse/${matchId}`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; status?: string };
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
        setState({ kind: "error", message: body.error ?? "ส่งคำขอไม่สำเร็จ" });
        return;
      }
      setState({ kind: "pending", message: body.message ?? "ส่งคำขอวิเคราะห์แล้ว กำลังรอผล" });
    } catch {
      setState({ kind: "error", message: "ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ" });
    }
  }

  return (
    <Surface glow="cyan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink">แมตช์นี้ยังไม่ถูกวิเคราะห์ ข้อมูลเชิงลึกจึงยังไม่ครบ</p>
          {state.message ? (
            <p className={`text-xs ${state.kind === "error" ? "text-red-400" : "text-cyan"}`}>{state.message}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={state.kind === "sending" || state.kind === "pending" || state.kind === "done"}
          className="btn-primary min-h-11 px-4 text-sm disabled:opacity-60"
        >
          {state.kind === "sending" ? "กำลังส่ง…" : state.kind === "pending" ? "กำลังรอผล" : "ขอวิเคราะห์แมตช์นี้"}
        </button>
      </div>
    </Surface>
  );
}
