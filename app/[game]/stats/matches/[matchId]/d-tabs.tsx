// K-AV-DOTABUFF.1 · ส่วนเติมของแท็บ Combat (13) · Kills (14-17) · Farm (18-20) · Runes (21-22) · Vision (23-26)
// ฝั่งเซิร์ฟเวอร์ · ส่งเฉพาะ array ที่ map แล้วเข้า client chart · ค่าที่ไม่มี = "–" หรือข้อความว่าไม่มีข้อมูล
import Link from "next/link";
import Surface from "@/components/ui/Surface";
import type { DotaMatchDetail } from "@/lib/dota/match";
import { gameClock, isConsumable } from "@/lib/dota/match/b-tabs";
import { runeName } from "@/lib/dota/match/c-events";
import {
  goldLost, itemCount, killGold, killParticipation, runeCounts, teamfightDamage, teamfightDeaths, type VisionItem,
} from "@/lib/dota/match/d-full";
import { bLookups, H2, HEAD_ROW, ItemIcon, PlayerCell, SCROLL, sideText, TABLE, TD, TH, val } from "./b-shared";
import { FightBars, MultiLine } from "./d-charts";
import { PLAYER_COLORS, PointsMap, type MapPoint } from "./d-map";
import { SourceNote } from "./d-shared";

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

// ---------- 13 ----------
export async function CombatD({ m }: { m: DotaMatchDetail }) {
  const fights = teamfightDamage(m.d.teamfights);
  if (!fights || fights.length === 0) return null;
  const L = await bLookups(m);
  const names = m.players.map((p, i) => `${L.hero(p.heroId).label} (${i + 1})`);
  const rows = fights.map((f, i) => {
    const row: Record<string, number | string | null> = { fight: `#${i + 1} ${gameClock(f.start)}` };
    names.forEach((n, j) => (row[n] = f.damage[j] ?? null));
    return row;
  });
  return (
    <Surface>
      <h2 className={H2}>ดาเมจต่อการปะทะ</h2>
      <FightBars rows={rows} series={names.map((name, i) => ({ name, color: PLAYER_COLORS[i] ?? "#a1a1aa" }))} label="ดาเมจต่อการปะทะ" />
      <SourceNote>OpenDota ไม่มีดาเมจรายนาที · กราฟนี้เป็นดาเมจของผู้เล่นในแต่ละการปะทะ (teamfights) ไม่ใช่รายนาที · {fights.length} การปะทะ</SourceNote>
    </Surface>
  );
}

// ---------- 14-17 ----------
export async function KillsD({ m }: { m: DotaMatchDetail }) {
  const L = await bLookups(m);
  const score = (isRadiant: boolean | null) => (isRadiant === true ? m.radiantScore : isRadiant === false ? m.direScore : null);
  const deaths = teamfightDeaths(m.d.teamfights);
  const totalDeaths = m.players.reduce<number | null>((a, p) => (a === null || p.deaths === null ? null : a + p.deaths), 0);
  const inFights = deaths?.reduce((a, d) => a + d.count, 0) ?? null;
  const points: MapPoint[] = (deaths ?? []).map((d) => ({
    x: d.x, y: d.y, color: PLAYER_COLORS[d.playerIndex] ?? "#a1a1aa", r: 1.6 + d.count * 0.4,
    title: `${L.hero(m.players[d.playerIndex]?.heroId ?? null).label} ตาย ${d.count} ครั้ง · การปะทะเริ่ม ${gameClock(d.time)}`,
  }));
  return (
    <>
      <Surface>
        <h2 className={H2}>การมีส่วนร่วมและทอง</h2>
        <div className={SCROLL}>
          <table className={TABLE}>
            <thead>
              <tr className={HEAD_ROW}>
                <th scope="col" className={TH}>ผู้เล่น</th>
                <th scope="col" className={TH}>% มีส่วนร่วม</th>
                <th scope="col" className={TH}>ทองจากการฆ่า</th>
                <th scope="col" className={TH}>ทองที่เสียเมื่อตาย</th>
              </tr>
            </thead>
            <tbody>
              {m.players.map((p, i) => (
                <tr key={p.slot ?? i} className="border-b border-line/50">
                  <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={p} L={L} /></th>
                  <td className={TD}>{pct(killParticipation(p.kills, p.assists, score(p.isRadiant)))}</td>
                  <td className={TD}>{val(killGold(p.d.goldReasons))}</td>
                  <td className={TD}>{val(goldLost(p.d.goldReasons))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceNote>% มีส่วนร่วม = (ฆ่า + ช่วย) ÷ คะแนนรวมฝั่งตัวเอง · ทองจาก gold_reasons ของ OpenDota (12 = ฆ่าฮีโร่ · 1 = เสียเมื่อตาย)</SourceNote>
      </Surface>
      <Surface>
        <h2 className={H2}>แผนที่จุดตาย</h2>
        {deaths === null ? (
          <p className="mt-2 text-sm text-ink">ไม่มีข้อมูลจุดตายในแมตช์นี้</p>
        ) : (
          <>
            <div className="mt-3"><PointsMap points={points} label="จุดตายในการปะทะ" /></div>
            <SourceNote>
              จุดตายในการปะทะ {val(inFights)} จาก {val(totalDeaths)} ครั้ง · OpenDota มีตำแหน่งตายเฉพาะใน teamfights ไม่ใช่ทุกครั้งที่ตาย · ผังวาดเองแบบย่อ
            </SourceNote>
          </>
        )}
      </Surface>
    </>
  );
}

// ---------- 18-20 ----------
export async function FarmD({ m }: { m: DotaMatchDetail }) {
  const L = await bLookups(m);
  const label = (i: number) => `${L.hero(m.players[i].heroId).label} (${i + 1})`;
  const gold = m.players.flatMap((p, i) => (p.b.goldT ? [{ name: label(i), color: PLAYER_COLORS[i] ?? "#a1a1aa", values: p.b.goldT }] : []));
  const lh = m.players.flatMap((p, i) => (p.b.lhT ? [{ name: label(i), color: PLAYER_COLORS[i] ?? "#a1a1aa", values: p.b.lhT }] : []));
  const buys = m.players
    .flatMap((p, i) => (p.b.purchaseLog ?? []).filter((e) => !isConsumable(e.key)).map((e) => ({ ...e, i })))
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
  return (
    <>
      <Surface>
        <h2 className={H2}>ทองรายนาที (gold_t)</h2>
        {gold.length ? <MultiLine series={gold} label="ทองรายนาทีต่อผู้เล่น" height={200} /> : <p className="mt-2 text-sm text-ink">ไม่มีข้อมูลในแมตช์นี้</p>}
      </Surface>
      <Surface>
        <h2 className={H2}>LH รายนาที (lh_t)</h2>
        {lh.length ? <MultiLine series={lh} label="LH รายนาทีต่อผู้เล่น" /> : <p className="mt-2 text-sm text-ink">ไม่มีข้อมูลในแมตช์นี้</p>}
      </Surface>
      <Surface>
        <h2 className={H2}>ไทม์ไลน์ซื้อของ</h2>
        {buys.length === 0 ? (
          <p className="mt-2 text-sm text-ink">ไม่มีข้อมูลในแมตช์นี้</p>
        ) : (
          <ol className="mt-3 flex max-h-[60vh] flex-col gap-1 overflow-y-auto text-xs sm:text-sm">
            {buys.map((b, k) => (
              <li key={k} className="flex items-center gap-3 border-b border-line/40 py-1">
                <span className="w-12 shrink-0 font-mono text-ink-muted">{gameClock(b.time)}</span>
                <span className={`w-32 shrink-0 truncate font-mono ${sideText(m.players[b.i].isRadiant)}`}>{label(b.i)}</span>
                <ItemIcon name={b.key} L={L} />
                <span className="text-ink">{L.itemName(b.key)}</span>
              </li>
            ))}
          </ol>
        )}
        <SourceNote>จาก purchase_log ของ OpenDota ทุกผู้เล่นเรียงตามเวลา · ไม่รวมของสิ้นเปลือง (ดูครบได้ที่แท็บ Builds)</SourceNote>
      </Surface>
    </>
  );
}

// ---------- 21-22 ----------
export function RunesD({ m }: { m: DotaMatchDetail }) {
  const counts = runeCounts(m.players.map((p) => p.runesLog));
  return (
    <Surface>
      <h2 className={H2}>รูนที่เก็บ แยกชนิด</h2>
      {counts === null ? (
        <p className="mt-2 text-sm text-ink">ไม่มีข้อมูลในแมตช์นี้</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {Object.entries(counts).map(([k, n]) => (
            <li key={k} className="rounded border border-line px-2 py-1 font-mono text-xs text-ink">{runeName(k)} × {n}</li>
          ))}
        </ul>
      )}
      <SourceNote>OpenDota ไม่มีจำนวนรูนที่เกิด และไม่มีตำแหน่งบน/ล่างของรูน (runes_log มีแค่เวลากับชนิด) · ตัวเลขนี้คือจำนวนที่ผู้เล่นเก็บเท่านั้น</SourceNote>
    </Surface>
  );
}

// ---------- 23-26 ----------
const VISION: { key: VisionItem; label: string }[] = [
  { key: "dust", label: "ดัสต์" },
  { key: "smoke_of_deceit", label: "สโมก" },
  { key: "gem", label: "เจม" },
];
export const WARD_RANGES = [
  { id: "all", label: "ทั้งเกม", from: -Infinity, to: Infinity },
  { id: "0-10", label: "0-10", from: -Infinity, to: 600 },
  { id: "10-20", label: "10-20", from: 600, to: 1200 },
  { id: "20-30", label: "20-30", from: 1200, to: 1800 },
  { id: "30+", label: "30+", from: 1800, to: Infinity },
] as const;

export async function VisionD({ m, range, basePath }: { m: DotaMatchDetail; range: string | undefined; basePath: string }) {
  const L = await bLookups(m);
  const r = WARD_RANGES.find((x) => x.id === range) ?? WARD_RANGES[0];
  const inR = (t: number | null) => t !== null && t >= r.from && t < r.to;
  const points: MapPoint[] = m.players.flatMap((p, i) => {
    const name = L.hero(p.heroId).label;
    const col = p.isRadiant === false ? "#f59e0b" : "#22d3ee";
    const one = (log: typeof p.obsLog, kind: string, hollow: boolean): MapPoint[] =>
      (log ?? []).filter((w) => w.x !== null && w.y !== null && inR(w.time))
        .map((w) => ({ x: w.x!, y: w.y!, color: col, hollow, title: `${name} (${i + 1}) วาง ${kind} ${gameClock(w.time)}` }));
    return [...one(p.obsLog, "Observer", false), ...one(p.senLog, "Sentry", true)];
  });
  const lost = m.players.reduce((a, p) => a + [...(p.obsLeftLog ?? []), ...(p.senLeftLog ?? [])].filter((w) => inR(w.time)).length, 0);
  const anyWard = m.players.some((p) => p.obsLog !== null || p.senLog !== null);
  return (
    <>
      <Surface>
        <h2 className={H2}>ดัสต์ · สโมก · เจม</h2>
        <div className={SCROLL}>
          <table className={TABLE}>
            <thead>
              <tr className={HEAD_ROW}>
                <th scope="col" className={TH}>ผู้เล่น</th>
                {VISION.map((v) => (
                  <th key={v.key} scope="col" className={TH}>{v.label} ซื้อ / ใช้</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.players.map((p, i) => (
                <tr key={p.slot ?? i} className="border-b border-line/50">
                  <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={p} L={L} /></th>
                  {VISION.map((v) => (
                    <td key={v.key} className={TD}>{val(itemCount(p.d.purchase, v.key))} / {val(itemCount(p.b.itemUses, v.key))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceNote>จาก purchase และ item_uses ของ OpenDota · ไม่มีคีย์ = &quot;–&quot;</SourceNote>
      </Surface>
      <Surface>
        <h2 className={H2}>แผนที่วอร์ด</h2>
        {!anyWard ? (
          <p className="mt-2 text-sm text-ink">ไม่มีข้อมูลในแมตช์นี้</p>
        ) : (
          <>
            <nav aria-label="ช่วงนาที" className="mt-3 flex flex-wrap gap-2">
              {WARD_RANGES.map((x) => (
                <Link
                  key={x.id}
                  href={x.id === "all" ? basePath : `${basePath}?w=${encodeURIComponent(x.id)}`}
                  scroll={false}
                  className={`rounded border px-2 py-1 font-mono text-xs ${x.id === r.id ? "border-cyan text-cyan" : "border-line text-ink-muted"}`}
                >
                  {x.label}{x.id === "all" ? "" : " นาที"}
                </Link>
              ))}
            </nav>
            <div className="mt-3"><PointsMap points={points} label={`วอร์ดช่วง ${r.label}`} /></div>
            <SourceNote>
              วางในช่วงนี้ {points.length} อัน · หายไปในช่วงนี้ {lost} อัน · ทึบ = Observer · วงโปร่ง = Sentry · ฟ้า = Radiant · ส้ม = Dire · พิกัดจาก obs_log/sen_log (ช่วงจริงในข้อมูล 72-191 · ผังใช้ 64-192) · ผังวาดเองแบบย่อ
            </SourceNote>
          </>
        )}
      </Surface>
    </>
  );
}
