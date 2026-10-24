"use client";

// ฟอร์มชี้ขาดข้อพิพาทของแอดมิน/กรรมการ — เรียก /api/v1/team-matches/[id]/dispute/resolve
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  matchId: string;
  disputeId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
}

export function ResolveDisputeForm({ matchId, disputeId, teamA, teamB }: Props) {
  const router = useRouter();
  const [winner, setWinner] = useState<string | "DRAW">("DRAW");
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/v1/team-matches/${matchId}/dispute/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          winnerTeamId: winner === "DRAW" ? null : winner,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          resolutionNotes: notes.trim(),
        }),
      });
      if (res.ok) {
        setMessage("บันทึกคำตัดสินแล้ว");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setMessage(data?.error?.message || "บันทึกไม่สำเร็จ");
    } catch {
      setMessage("บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const selCls =
    "rounded border border-white/20 bg-[#0A0A0F] px-2 py-1.5 text-xs text-white focus:border-[#00D4FF] focus:outline-none";

  return (
    <div className="mt-3 flex flex-col gap-2 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/5 p-3">
      <p className="text-[10px] font-mono font-bold tracking-wider text-[#C9A84C]">ADMIN RESOLUTION</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={winner} onChange={(e) => setWinner(e.target.value)} className={selCls}>
          <option value="DRAW">เสมอ / ยกเลิกผล</option>
          <option value={teamA.id}>{teamA.name} ชนะ</option>
          <option value={teamB.id}>{teamB.name} ชนะ</option>
        </select>
        <input type="number" min={0} max={7} value={scoreA} onChange={(e) => setScoreA(e.target.value)} className={`${selCls} w-14`} aria-label="score A" />
        <span className="text-xs text-neutral-500">:</span>
        <input type="number" min={0} max={7} value={scoreB} onChange={(e) => setScoreB(e.target.value)} className={`${selCls} w-14`} aria-label="score B" />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="เหตุผลคำตัดสิน (บังคับ)"
        className={`${selCls} w-full`}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || notes.trim().length < 5}
          onClick={submit}
          className="rounded bg-[#C9A84C] px-4 py-1.5 text-xs font-bold text-black disabled:opacity-50"
        >
          {busy ? "กำลังบันทึก..." : "ชี้ขาด"}
        </button>
        {message && <p className="text-xs text-neutral-300">{message}</p>}
      </div>
    </div>
  );
}
