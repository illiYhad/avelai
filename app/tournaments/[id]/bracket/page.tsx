import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { championOf, rowToSlot, type SlotRow } from "@/lib/tournament/engine";
import { BRACKET_LABEL, groupRounds, teamLabel, type TeamName } from "@/lib/tournament/engine/view";

// K-AV-4: สาย SE/DE อ่านอย่างเดียว · responsive (เลื่อนแนวนอนบนมือถือ) · ทีมยังไม่รู้ = "รอผล"
export const dynamic = "force-dynamic";

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getServerDb();
  if (!db) return <main className="px-6 py-10 text-sm text-white/60">ยังไม่ต่อฐานข้อมูล</main>;
  const { data: t } = await db.from("tournaments").select("id, name, format, status").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: auth } = await db.auth.getUser();
  const { data: rows } = await db.from("tournament_bracket_slots").select("tournament_id, bracket, round, position, team_a_id, team_b_id, winner_to, winner_to_side, loser_to, loser_to_side, source_a, source_b, is_grand_final_reset, winner_team_id, status").eq("tournament_id", id);
  const slots = ((rows ?? []) as SlotRow[]).map(rowToSlot);
  const teamIds = [...new Set(slots.flatMap((s) => [s.teamA, s.teamB, s.winnerId]).filter((x): x is string => !!x))];
  const { data: teams } = teamIds.length ? await db.from("teams").select("id, name, tag").in("id", teamIds) : { data: [] };
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));
  const champion = championOf(slots);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.name} · สาย {t.format}</h1>
        <Link href={`/tournaments/${id}`} className="text-xs text-white/60 underline">รายละเอียดทัวร์</Link>
        {champion ? <p className="mt-1 text-sm text-gold">🏆 แชมป์: {teamLabel(names, champion)}</p> : null}
      </div>
      {!auth.user ? <p className="text-sm text-white/60">เข้าสู่ระบบเพื่อดูสาย</p> : slots.length === 0 ? <p className="text-sm text-white/60">ยังไม่ได้สร้างสาย</p> : groupRounds(slots).map((g) => (
        <section key={g.bracket}>
          <h2 className="mb-2 text-sm font-semibold text-white/90">{BRACKET_LABEL[g.bracket]}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {g.rounds.map((r) => (
              <div key={r.round} className="flex min-w-[220px] flex-col gap-2">
                <p className="text-xs text-white/50">รอบ {r.round}</p>
                {r.slots.map((s) => (
                  <div key={s.key} className={`rounded border px-3 py-2 text-xs ${s.status === "VOID" ? "border-white/5 text-white/30" : "border-white/15"}`}>
                    {s.isGrandFinalReset ? <p className="mb-1 text-[10px] text-white/50">นัดตัดสิน (ถ้าสายล่างชนะ)</p> : null}
                    {(["A", "B"] as const).map((side) => {
                      const team = side === "A" ? s.teamA : s.teamB;
                      const won = s.winnerId && team === s.winnerId;
                      return (
                        <p key={side} className={`flex justify-between gap-2 py-0.5 ${won ? "text-cyan" : team ? "text-white" : "text-white/40"}`}>
                          <span className="truncate">{s.status === "VOID" ? "–" : teamLabel(names, team)}</span>
                          {won ? <span>✓</span> : null}
                        </p>
                      );
                    })}
                    <p className="mt-1 text-[10px] text-white/40">{s.status === "BYE" ? "ผ่านอัตโนมัติ" : s.status === "READY" ? "รอแข่ง" : s.status === "DONE" ? "จบแล้ว" : s.status === "VOID" ? "ไม่ใช้" : "รอผล"}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
