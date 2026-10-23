"use client";

// ยกจาก Zodiac components/match/ReportResultForm.tsx (เทสแล้ว) ปรับธีม AVELAi
// เส้นเดียว: /api/v1/team-matches/[id]/report (ไม่มีโหมด points league ในรุ่นนี้)
import { useState } from "react";
import { useRouter } from "next/navigation";

interface TeamOption {
  id: string;
  name: string;
}

interface Props {
  matchId: string;
  teamA: TeamOption;
  teamB: TeamOption;
  bestOf: number;
  status: string;
}

type Pick = "A" | "B" | "DRAW" | null;

export default function ReportResultForm({ matchId, teamA, teamB, bestOf, status }: Props) {
  const router = useRouter();
  const [pick, setPick] = useState<Pick>(null);
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [evidence, setEvidence] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const open = status === "AWAITING_RESULT";

  async function submit() {
    if (!pick) return setMessage("กรุณาเลือกผลการแข่งขัน");
    if (!evidence.trim()) return setMessage("กรุณาแนบลิงก์ภาพหลักฐานเพื่อยืนยันผลการแข่งขัน");
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/v1/team-matches/${matchId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerTeamId: pick === "A" ? teamA.id : pick === "B" ? teamB.id : null,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          evidenceUrls: [evidence.trim()],
        }),
      });
      if (res.ok) {
        setMessage("ส่งผลแล้ว");
        router.push(`/teams`);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setMessage(data?.error?.message || "ส่งผลไม่สำเร็จ กรุณาลองใหม่");
    } catch {
      setMessage("ส่งผลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  const pickCls = (active: boolean) =>
    `px-3 py-2 rounded border text-sm ${active ? "bg-[#00D4FF] border-[#00D4FF] text-black font-bold" : "bg-transparent border-white/30 text-white"}`;

  return (
    <div className="p-4 pt-20 bg-[#0A0A0F] text-white min-h-screen">
      <h1 className="text-xl font-bold mb-4">รายงานผลการแข่งขัน</h1>
      <div className="flex flex-col gap-4 max-w-sm">
        {!open && (
          <p data-testid="report-closed" className="text-yellow-400 text-sm">
            แมตช์นี้ยังไม่อยู่ในช่วงรายงานผล
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" data-testid="report-pick-a" className={pickCls(pick === "A")} onClick={() => setPick("A")}>
            {teamA.name} ชนะ
          </button>
          <button type="button" data-testid="report-pick-draw" className={pickCls(pick === "DRAW")} onClick={() => setPick("DRAW")}>
            เสมอ (ให้แอดมินสรุป)
          </button>
          <button type="button" data-testid="report-pick-b" className={pickCls(pick === "B")} onClick={() => setPick("B")}>
            {teamB.name} ชนะ
          </button>
        </div>
        <label className="text-sm">
          เกมที่ {teamA.name} ชนะ
          <input
            data-testid="report-score-a"
            type="number"
            min={0}
            max={bestOf}
            step={1}
            className="ml-2 w-16 rounded border border-white/30 bg-[#12121A] px-2 py-1 text-white"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
          />
        </label>
        <label className="text-sm">
          เกมที่ {teamB.name} ชนะ
          <input
            data-testid="report-score-b"
            type="number"
            min={0}
            max={bestOf}
            step={1}
            className="ml-2 w-16 rounded border border-white/30 bg-[#12121A] px-2 py-1 text-white"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
          />
        </label>
        <label className="text-sm">
          ลิงก์ภาพหลักฐาน
          <input
            data-testid="report-evidence"
            type="text"
            className="mt-1 block w-full rounded border border-white/30 bg-[#12121A] px-2 py-1 text-white placeholder:text-gray-500"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <button
          type="button"
          data-testid="report-submit"
          disabled={!open || busy}
          onClick={submit}
          className="bg-[#00D4FF] text-black font-bold p-2 rounded disabled:opacity-50"
        >
          ส่งผลการแข่งขัน
        </button>
        <p data-testid="report-message" className="text-sm min-h-[1.25rem]">{message}</p>
      </div>
    </div>
  );
}
