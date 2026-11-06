import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { atMinute, laneLabel, laneRoleLabel, laneSummaries } from "@/lib/dota/match/b-tabs";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { isValidMatchId } from "@/lib/dota/opendota";
import { blockedNotice } from "../BlockedNotice";
import { LANE_OUTCOME_MIN_RATIO, LANE_OUTCOME_MINUTE, laneOutcome, lhAtMinutes, LH_MINUTES, type LaneOutcome } from "@/lib/dota/match/d-full";
import { SourceNote } from "../d-shared";
import { bLookups, H2, HEAD_ROW, NoDataB, PlayerCell, SCROLL, SIDE_TEXT, TABLE, TD, TeamHeading, teams, TH, val } from "../b-shared";

// K-AV-D5 · แท็บ Lanes — players[].lane · lane_role · is_roaming · lane_efficiency_pct และอนุกรมรายนาที (lh_t · dn_t · gold_t · xp_t)
// OpenDota ไม่มีฟิลด์ "ใครชนะเลน" → K-AV-DOTABUFF.1 ข้อ 10 ตัดสินด้วยเกณฑ์ของ AVELAi (laneOutcome ใน lib/dota/match/d-full.ts)
// เป็นการแสดงผลเท่านั้น ห้ามส่งต่อไปคะแนน · ข้อ 11 ความแม่น LH ไม่มีใน OpenDota · ข้อ 12 LH นาที 4/8/12
export const dynamic = "force-dynamic";

const LANE_MINUTE = LANE_OUTCOME_MINUTE;
const OUTCOME_TEXT: Record<LaneOutcome, string> = {
  radiant: "Radiant ชนะ",
  dire: "Dire ชนะ",
  draw: "เสมอ",
  uneven: "ไม่ตัดสิน (จำนวนคนต่างกัน)",
  nodata: "ไม่มีข้อมูล",
};

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
                  {LH_MINUTES.map((mn) => (
                    <th key={mn} scope="col" className={TH}>LH นาที {mn}</th>
                  ))}
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
                    {lhAtMinutes(p.b.lhT).map((v, k) => (
                      <td key={k} className={TD}>{val(v)}</td>
                    ))}
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
          ผลรวมทองและ XP ของผู้เล่นที่ OpenDota จัดไว้ในเลนเดียวกัน · คอลัมน์ &quot;ผลเลน&quot; ใช้เกณฑ์ของ AVELAi ไม่ใช่ข้อมูลจาก OpenDota: จำนวนคนสองฝั่งเท่ากันและทองนาที {LANE_MINUTE} ต่างกันตั้งแต่ {LANE_OUTCOME_MIN_RATIO * 100}% ของฝั่งที่มากกว่า = ฝั่งนั้นชนะ · น้อยกว่านั้น = เสมอ · จำนวนคนต่างกัน = ไม่ตัดสิน
        </p>
        {lanes.length === 0 ? (
          <p className="mt-3 text-xs text-ink-muted">ไม่มีข้อมูลในแมตช์นี้</p>
        ) : (
          <div className={SCROLL}>
            <table className={TABLE}>
              <thead>
                <tr className={HEAD_ROW}>
                  <th scope="col" className={TH}>เลน</th>
                  <th scope="col" className={TH}>ผลเลน</th>
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
                    <td className="py-2 pr-3 text-ink">{OUTCOME_TEXT[laneOutcome(l)]}</td>
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
        <SourceNote>ความแม่นการเก็บ LH: OpenDota ไม่มีข้อมูลนี้ · ดูคอลัมน์ &quot;ประสิทธิภาพเลน&quot; (lane_efficiency_pct ของ OpenDota) แทน</SourceNote>
      </Surface>
    </div>
  );
}
