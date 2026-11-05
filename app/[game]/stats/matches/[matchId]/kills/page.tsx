import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail, type DotaMatchDetailPlayer } from "@/lib/dota/match";
import { gameClock, isHeroUnit, killsOn, killTimeline, recordTotal } from "@/lib/dota/match/b-tabs";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { isValidMatchId } from "@/lib/dota/opendota";
import { blockedNotice } from "../BlockedNotice";
import { bLookups, H2, HEAD_ROW, NoDataB, PlayerCell, SCROLL, sideText, TABLE, TD, TeamHeading, teams, TH, val, type BLookups } from "../b-shared";

// K-AV-D5 · แท็บ Kills — players[].kills_log {time,key} · killed · buyback_log · multi_kills · kill_streaks · life_state_dead
// ไม่มี KP / คะแนน / MVP ในแท็บนี้ · พิกัดจุดตายไม่มีใน kills_log จึงไม่แสดงแผนที่
export const dynamic = "force-dynamic";

export default async function KillsPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null; // layout แสดงข้อความผิดพลาดให้แล้ว
  const m = r.data;
  const timeline = killTimeline(m.players);
  if (timeline === null && !m.players.some((p) => p.b.killed !== null)) {
    return <NoDataB what="การฆ่า" isParsed={m.isParsed} />;
  }
  const L = await bLookups(m);
  const radiant = m.players.filter((p) => p.isRadiant === true);
  const dire = m.players.filter((p) => p.isRadiant === false);
  const heroKills = timeline?.filter((k) => isHeroUnit(k.victimKey)) ?? null;
  const sizes = (rec: Record<string, number> | null) =>
    rec === null ? "–" : recordTotal(rec) === 0 ? "0" : Object.entries(rec).map(([size, n]) => `${size} ตัว ×${n}`).join(" · ");
  const longest = (rec: Record<string, number> | null) => {
    if (rec === null) return "–";
    const keys = Object.keys(rec).map(Number).filter(Number.isFinite);
    return keys.length === 0 ? "0" : String(Math.max(...keys));
  };

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
                  <th scope="col" className={TH}>K / D / A</th>
                  <th scope="col" className={TH}>ฆ่าหลายตัวติด</th>
                  <th scope="col" className={TH}>สตรีกยาวสุด</th>
                  <th scope="col" className={TH}>บายแบ็ก</th>
                  <th scope="col" className="py-2">เวลาตายรวม</th>
                </tr>
              </thead>
              <tbody>
                {t.players.map((p, i) => (
                  <tr key={`${p.slot ?? i}`} className="border-b border-line/50 align-middle">
                    <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={p} L={L} /></th>
                    <td className={TD}>{val(p.kills)} / {val(p.deaths)} / {val(p.assists)}</td>
                    <td className={TD}>{sizes(p.b.multiKills)}</td>
                    <td className={TD}>{longest(p.b.killStreaks)}</td>
                    <td className={TD}>
                      {p.b.buybackTimes === null
                        ? "–"
                        : p.b.buybackTimes.length === 0
                          ? "0"
                          : `${p.b.buybackTimes.length} (${p.b.buybackTimes.map(gameClock).join(", ")})`}
                    </td>
                    <td className="py-2 font-mono">{gameClock(p.b.deadSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ))}

      <Matrix title="Radiant ฆ่า Dire" killers={radiant} victims={dire} L={L} />
      <Matrix title="Dire ฆ่า Radiant" killers={dire} victims={radiant} L={L} />

      <Surface>
        <h2 className={H2}>ลำดับการฆ่า</h2>
        {heroKills === null ? (
          <p className="mt-2 text-xs text-ink-muted">ไม่มีข้อมูลในแมตช์นี้</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-muted">
              {heroKills.length} ครั้ง · นับเฉพาะครั้งที่ผู้เล่นเป็นคนปิด · ตายจากครีป ป้อม หรือนิวทรัลไม่อยู่ในรายการนี้
            </p>
            <div className={`${SCROLL} max-h-[70vh] overflow-y-auto`}>
              <table className={TABLE}>
                <thead>
                  <tr className={HEAD_ROW}>
                    <th scope="col" className={TH}>เวลา</th>
                    <th scope="col" className={TH}>ผู้ฆ่า</th>
                    <th scope="col" className="py-2">ผู้ตาย</th>
                  </tr>
                </thead>
                <tbody>
                  {heroKills.map((k, i) => {
                    const killer = m.players[k.killerIndex];
                    const victim = L.playerByHeroKey(k.victimKey);
                    return (
                      <tr key={i} className="border-b border-line/40 align-middle">
                        <td className="py-1.5 pr-3 font-mono text-ink-muted">{gameClock(k.time)}</td>
                        <td className="py-1.5 pr-3"><PlayerCell p={killer} L={L} /></td>
                        <td className="py-1.5">
                          {victim ? <PlayerCell p={victim} L={L} /> : <span className="font-mono text-xs text-ink">{L.heroLabelByKey(k.victimKey)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}

function Matrix({ title, killers, victims, L }: { title: string; killers: DotaMatchDetailPlayer[]; victims: DotaMatchDetailPlayer[]; L: BLookups }) {
  if (killers.length === 0 || victims.length === 0) return null;
  return (
    <Surface glow="cyan">
      <h2 className={H2}>{title}</h2>
      <p className="mt-1 text-xs text-ink-muted">แถว = ผู้ฆ่า · คอลัมน์ = ผู้ตาย · ตัวเลข = จำนวนครั้ง</p>
      <div className={SCROLL}>
        <table className={TABLE}>
          <thead>
            <tr className={HEAD_ROW}>
              <th scope="col" className={TH}>ผู้ฆ่า</th>
              {victims.map((v, i) => (
                <th key={`${v.slot ?? i}`} scope="col" className={`${TH} ${sideText(v.isRadiant)}`}>{L.hero(v.heroId).label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {killers.map((k, i) => (
              <tr key={`${k.slot ?? i}`} className="border-b border-line/50 align-middle">
                <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={k} L={L} /></th>
                {victims.map((v, j) => (
                  <td key={`${v.slot ?? j}`} className={TD}>{val(killsOn(k.b, L.heroKeyOf(v)))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}
