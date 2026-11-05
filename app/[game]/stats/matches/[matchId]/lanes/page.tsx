import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { atMinute, laneLabel, laneRoleLabel, laneSummaries } from "@/lib/dota/match/b-tabs";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { isValidMatchId } from "@/lib/dota/opendota";
import { blockedNotice } from "../BlockedNotice";
import { bLookups, H2, HEAD_ROW, NoDataB, PlayerCell, SCROLL, SIDE_TEXT, TABLE, TD, TeamHeading, teams, TH, val } from "../b-shared";

// K-AV-D5 · แท็บ Lanes — players[].lane · lane_role · is_roaming · lane_efficiency_pct และอนุกรมรายนาที (lh_t · dn_t · gold_t · xp_t)
// OpenDota ไม่มีฟิลด์ "ใครชนะเลน" → แสดงผลรวมทอง/XP ของแต่ละเลนเป็นข้อเท็จจริง ไม่ตัดสินแพ้ชนะ
export const dynamic = "force-dynamic";

const LANE_MINUTE = 10;

export default async function LanesPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null; // layout แสดงข้อความผิดพลาดให้แล้ว
  const m = r.data;
  if (!m.players.some((p) => p.b.lane !== null || p.b.laneRole !== null || p.b.lhT !== null)) {
    return <NoDataB what="เลน" isParsed={m.isParsed} />;
  }
  const L = await bLookups(m);
  const lanes = laneSummaries(m.players, LANE_MINUTE);
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  const signed = (v: number | null) => (v === null ? "–" : `${v > 0 ? "+" : ""}${v.toLocaleString("en-US")}`);

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
                  <th scope="col" className={TH}>เลน</th>
                  <th scope="col" className={TH}>บทบาท</th>
                  <th scope="col" className={TH}>โรม</th>
                  <th scope="col" className={TH}>ประสิทธิภาพเลน</th>
                  <th scope="col" className={TH}>LH นาที 5</th>
                  <th scope="col" className={TH}>LH นาที 10</th>
                  <th scope="col" className={TH}>DN นาที 10</th>
                  <th scope="col" className={TH}>ทอง นาที 10</th>
                  <th scope="col" className="py-2">XP นาที 10</th>
                </tr>
              </thead>
              <tbody>
                {t.players.map((p, i) => (
                  <tr key={`${p.slot ?? i}`} className="border-b border-line/50 align-middle">
                    <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={p} L={L} /></th>
                    <td className="py-2 pr-3">{laneLabel(p.b.lane) ?? "–"}</td>
                    <td className={TD}>{laneRoleLabel(p.b.laneRole) ?? "–"}</td>
                    <td className="py-2 pr-3">{p.b.isRoaming === null ? "–" : p.b.isRoaming ? "ใช่" : "ไม่"}</td>
                    <td className={TD}>{p.b.laneEfficiencyPct === null ? "–" : `${p.b.laneEfficiencyPct}%`}</td>
                    <td className={TD}>{val(atMinute(p.b.lhT, 5))}</td>
                    <td className={TD}>{val(atMinute(p.b.lhT, LANE_MINUTE))}</td>
                    <td className={TD}>{val(atMinute(p.b.dnT, LANE_MINUTE))}</td>
                    <td className={TD}>{val(atMinute(p.b.goldT, LANE_MINUTE))}</td>
                    <td className="py-2 font-mono">{val(atMinute(p.b.xpT, LANE_MINUTE))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ))}

      <Surface glow="cyan">
        <h2 className={H2}>รวมรายเลน ที่นาที {LANE_MINUTE}</h2>
        <p className="mt-1 text-xs text-ink-muted">
          ผลรวมทองและ XP ของผู้เล่นที่ OpenDota จัดไว้ในเลนเดียวกัน · OpenDota ไม่มีฟิลด์ผลแพ้ชนะเลน หน้านี้จึงไม่ตัดสิน
        </p>
        {lanes.length === 0 ? (
          <p className="mt-3 text-xs text-ink-muted">ไม่มีข้อมูลในแมตช์นี้</p>
        ) : (
          <div className={SCROLL}>
            <table className={TABLE}>
              <thead>
                <tr className={HEAD_ROW}>
                  <th scope="col" className={TH}>เลน</th>
                  <th scope="col" className={TH}>Radiant (คน)</th>
                  <th scope="col" className={TH}>Dire (คน)</th>
                  <th scope="col" className={TH}>ทอง Radiant</th>
                  <th scope="col" className={TH}>ทอง Dire</th>
                  <th scope="col" className={TH}>ต่างทอง</th>
                  <th scope="col" className={TH}>XP Radiant</th>
                  <th scope="col" className={TH}>XP Dire</th>
                  <th scope="col" className="py-2">ต่าง XP</th>
                </tr>
              </thead>
              <tbody>
                {lanes.map((l) => (
                  <tr key={l.lane} className="border-b border-line/50">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">{laneLabel(l.lane) ?? `เลน #${l.lane}`}</th>
                    <td className={TD}>{l.radiant}</td>
                    <td className={TD}>{l.dire}</td>
                    <td className={`${TD} ${SIDE_TEXT.radiant}`}>{val(l.radiantGold)}</td>
                    <td className={`${TD} ${SIDE_TEXT.dire}`}>{val(l.direGold)}</td>
                    <td className={TD}>{signed(diff(l.radiantGold, l.direGold))}</td>
                    <td className={`${TD} ${SIDE_TEXT.radiant}`}>{val(l.radiantXp)}</td>
                    <td className={`${TD} ${SIDE_TEXT.dire}`}>{val(l.direXp)}</td>
                    <td className="py-2 font-mono">{signed(diff(l.radiantXp, l.direXp))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-muted">ค่าต่างเป็นบวก = Radiant มากกว่า · ฝั่งที่ไม่มีผู้เล่นในเลนนั้นแสดง –</p>
      </Surface>
    </div>
  );
}
