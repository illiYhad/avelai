import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { advMinutes, atMinute } from "@/lib/dota/match/b-tabs";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { isValidMatchId } from "@/lib/dota/opendota";
import { blockedNotice } from "../BlockedNotice";
import { bLookups, H2, HEAD_ROW, NoDataB, PlayerCell, SCROLL, SIDE_TEXT, TABLE, TD, TeamHeading, teams, TH, val } from "../b-shared";

// K-AV-D5 · แท็บ Farm — GPM/XPM/LH/DN (มีทุกแมตช์) · total_gold · gold_spent · actions_per_min · gold_t / lh_t รายนาที
// ส่วนต่างทีมจาก radiant_gold_adv / radiant_xp_adv ของ OpenDota โดยตรง (ไม่คำนวณเอง)
export const dynamic = "force-dynamic";

const CHECKPOINTS = [10, 20, 30];

export default async function FarmPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null; // layout แสดงข้อความผิดพลาดให้แล้ว
  const m = r.data;
  const L = await bLookups(m);
  const hasTimeline = m.players.some((p) => p.b.goldT !== null || p.b.lhT !== null);
  const gold = m.b.radiantGoldAdv;
  const xp = m.b.radiantXpAdv;
  const minutes = advMinutes(Math.max(gold?.length ?? 0, xp?.length ?? 0));
  const lead = (v: number | null) => (v === null ? "–" : v === 0 ? "เท่ากัน" : v > 0 ? "Radiant" : "Dire");
  const abs = (v: number | null) => (v === null ? "–" : Math.abs(v).toLocaleString("en-US"));
  const leadClass = (v: number | null) => (v === null || v === 0 ? "text-ink" : v > 0 ? SIDE_TEXT.radiant : SIDE_TEXT.dire);

  return (
    <div className="flex flex-col gap-6">
      {teams(m).map((t) => (
        <Surface key={t.title} glow={t.won ? "gold" : "none"}>
          <TeamHeading title={t.title} won={t.won} />
          <div className={SCROLL}>
            <table className={TABLE}>
              <thead>
                <tr className={HEAD_ROW}>
                  <th scope="col" className={TH}>ผู้เล่น</th>
                  <th scope="col" className={TH}>GPM</th>
                  <th scope="col" className={TH}>XPM</th>
                  <th scope="col" className={TH}>LH / DN</th>
                  <th scope="col" className={TH}>ทองรวม</th>
                  <th scope="col" className={TH}>ทองที่ใช้</th>
                  <th scope="col" className={TH}>XP รวม</th>
                  <th scope="col" className={TH}>APM</th>
                  {CHECKPOINTS.map((c) => (
                    <th key={`g${c}`} scope="col" className={TH}>ทอง น.{c}</th>
                  ))}
                  {CHECKPOINTS.map((c) => (
                    <th key={`l${c}`} scope="col" className={TH}>LH น.{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.players.map((p, i) => (
                  <tr key={`${p.slot ?? i}`} className="border-b border-line/50 align-middle">
                    <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={p} L={L} /></th>
                    <td className={TD}>{val(p.gpm)}</td>
                    <td className={TD}>{val(p.xpm)}</td>
                    <td className={TD}>{val(p.lastHits)} / {val(p.denies)}</td>
                    <td className={TD}>{val(p.b.totalGold)}</td>
                    <td className={TD}>{val(p.b.goldSpent)}</td>
                    <td className={TD}>{val(p.b.totalXp)}</td>
                    <td className={TD}>{val(p.b.apm)}</td>
                    {CHECKPOINTS.map((c) => (
                      <td key={`g${c}`} className={TD}>{val(atMinute(p.b.goldT, c))}</td>
                    ))}
                    {CHECKPOINTS.map((c) => (
                      <td key={`l${c}`} className={TD}>{val(atMinute(p.b.lhT, c))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ))}

      {!hasTimeline ? (
        <NoDataB what="ทอง/XP/LH ตามเวลา" isParsed={m.isParsed} />
      ) : (
        <p className="text-xs text-ink-muted">น.10 / น.20 / น.30 = ค่าสะสมถึงนาทีนั้น · เกมจบก่อนถึงนาทีนั้นแสดง –</p>
      )}

      {gold === null && xp === null ? (
        <NoDataB what="ส่วนต่างทีมตามเวลา" isParsed={m.isParsed} />
      ) : (
        <Surface glow="cyan">
          <h2 className={H2}>ส่วนต่างทีมตามเวลา</h2>
          <p className="mt-1 text-xs text-ink-muted">ทุก 5 นาทีและนาทีสุดท้าย · ค่าจาก OpenDota โดยตรง</p>
          <div className={SCROLL}>
            <table className={TABLE}>
              <thead>
                <tr className={HEAD_ROW}>
                  <th scope="col" className={TH}>นาที</th>
                  <th scope="col" className={TH}>ทองนำ</th>
                  <th scope="col" className={TH}>ฝั่งนำทอง</th>
                  <th scope="col" className={TH}>XP นำ</th>
                  <th scope="col" className="py-2">ฝั่งนำ XP</th>
                </tr>
              </thead>
              <tbody>
                {minutes.map((min) => {
                  const g = atMinute(gold, min);
                  const x = atMinute(xp, min);
                  return (
                    <tr key={min} className="border-b border-line/40">
                      <th scope="row" className="py-1.5 pr-3 text-left font-mono font-normal text-ink-muted">{min}</th>
                      <td className="py-1.5 pr-3 font-mono">{abs(g)}</td>
                      <td className={`py-1.5 pr-3 font-mono ${leadClass(g)}`}>{lead(g)}</td>
                      <td className="py-1.5 pr-3 font-mono">{abs(x)}</td>
                      <td className={`py-1.5 font-mono ${leadClass(x)}`}>{lead(x)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Surface>
      )}
    </div>
  );
}
