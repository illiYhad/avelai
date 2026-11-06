// ใบ 28 รายการ (2026-11-06) · ส่วนเติมของแท็บ Overview: บัฟ (2) · กราฟส่วนต่างทอง/XP (3-4) · จุดเหตุการณ์ (5) · แผนที่ป้อม (6) · ใครฆ่าใคร (7) · ลำดับสกิล (8)
import Surface from "@/components/ui/Surface";
import type { DotaMatchDetail } from "@/lib/dota/match";
import { chartMarkers, decodeBarracks, decodeTowers, killMatrix } from "@/lib/dota/match/d-full";
import { H2, HEAD_ROW, PlayerCell, SCROLL, TABLE, TD, TH, val, type BLookups } from "./b-shared";
import { AdvChart } from "./d-charts";
import { BuildingMap } from "./d-map";
import { SkillOrder, SourceNote, type DLookups } from "./d-shared";

export function OverviewD({ m, L, D }: { m: DotaMatchDetail; L: BLookups; D: DLookups }) {
  const markers = chartMarkers(m.objectives) ?? [];
  const adv = (s: (number | null)[] | null) => (s ? s.map((value, minute) => ({ minute, value })) : null);
  const gold = adv(m.b.radiantGoldAdv);
  const xp = adv(m.b.radiantXpAdv);
  const radiant = m.players.filter((p) => p.isRadiant === true);
  const dire = m.players.filter((p) => p.isRadiant === false);
  // ทั้งสองฝั่งเป็น 0 = ไม่มีข้อมูลจริง (เช่นแมตช์ที่ไม่มีข้อมูลเกม) · ไม่วาดว่าแตกหมด
  const noBuildings = m.d.towerStatusRadiant === 0 && m.d.towerStatusDire === 0;
  const towers = noBuildings ? { r: null, d: null } : { r: decodeTowers(m.d.towerStatusRadiant), d: decodeTowers(m.d.towerStatusDire) };
  const buffs = m.players.filter((p) => p.d.permanentBuffs && p.d.permanentBuffs.length > 0);

  return (
    <>
      {buffs.length > 0 ? (
        <Surface>
          <h2 className={H2}>บัฟถาวร</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {buffs.map((p, i) => (
              <li key={p.slot ?? i} className="flex flex-wrap items-center gap-2">
                <PlayerCell p={p} L={L} />
                {p.d.permanentBuffs!.map((b, j) => (
                  <span key={j} className="rounded border border-cyan/40 px-1.5 py-0.5 font-mono text-xs text-cyan">
                    {D.buffName(b.buffId)}{b.stacks ? ` ×${b.stacks}` : ""}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}

      {gold || xp ? (
        <Surface glow="cyan">
          {gold ? (
            <>
              <h2 className={H2}>ส่วนต่างทอง (บวก = Radiant นำ)</h2>
              <AdvChart data={gold} label="ส่วนต่างทอง" markers={markers} />
            </>
          ) : null}
          {xp ? (
            <>
              <h2 className={`${H2} mt-4`}>ส่วนต่าง XP (บวก = Radiant นำ)</h2>
              <AdvChart data={xp} label="ส่วนต่าง XP" markers={markers} />
            </>
          ) : null}
          <p className="mt-2 flex flex-wrap gap-3 text-xs text-ink-muted">
            <span><span className="text-[#ef4444]">●</span> First blood</span>
            <span><span className="text-[#f59e0b]">●</span> ป้อมแตก</span>
            <span><span className="text-[#a855f7]">●</span> Roshan</span>
            {markers.length === 0 ? <span>ไม่มีข้อมูลเหตุการณ์ในแมตช์นี้</span> : null}
          </p>
        </Surface>
      ) : null}

      {towers.r || towers.d ? (
        <Surface>
          <h2 className={H2}>ป้อมและค่ายตอนจบเกม</h2>
          <div className="mt-3">
            <BuildingMap
              sides={[
                { side: "radiant", towers: towers.r, barracks: decodeBarracks(m.d.barracksStatusRadiant) },
                { side: "dire", towers: towers.d, barracks: decodeBarracks(m.d.barracksStatusDire) },
              ]}
            />
          </div>
          <SourceNote>สี่เหลี่ยม = ป้อม · สามเหลี่ยม = ค่าย · ทึบ = ยังอยู่ · โปร่ง = ถูกทำลาย · ผังวาดเองแบบย่อ ตำแหน่งไม่ใช่พิกัดจริง</SourceNote>
        </Surface>
      ) : null}

      {radiant.length > 0 && dire.length > 0 && radiant.some((p) => p.b.killed !== null) ? (
        <Surface>
          <h2 className={H2}>ใครฆ่าใคร</h2>
          <KillTable rows={radiant} cols={dire} L={L} />
          <SourceNote>ตัวเลข = แถวฆ่าคอลัมน์ / คอลัมน์ฆ่าแถว · จาก killed ของ OpenDota เฉพาะฮีโร่</SourceNote>
        </Surface>
      ) : null}

      <Surface>
        <SkillOrder players={m.players} L={L} D={D} />
        {m.players.every((p) => p.d.abilityUpgrades === null) ? <p className="text-sm text-ink">ไม่มีข้อมูลลำดับสกิลในแมตช์นี้</p> : null}
      </Surface>
    </>
  );
}

function KillTable({ rows, cols, L }: { rows: DotaMatchDetail["players"]; cols: DotaMatchDetail["players"]; L: BLookups }) {
  const colKeys = cols.map(L.heroKeyOf);
  const rowKeys = rows.map(L.heroKeyOf);
  const fwd = killMatrix(rows.map((p) => p.b), colKeys);
  const back = killMatrix(cols.map((p) => p.b), rowKeys);
  return (
    <div className={SCROLL}>
      <table className={TABLE}>
        <thead>
          <tr className={HEAD_ROW}>
            <th scope="col" className={TH}>Radiant \ Dire</th>
            {cols.map((p, j) => (
              <th key={j} scope="col" className={TH}><PlayerCell p={p} L={L} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i} className="border-b border-line/50">
              <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={p} L={L} /></th>
              {cols.map((_, j) => (
                <td key={j} className={TD}>
                  <span className="text-cyan">{val(fwd[i][j])}</span> / <span className="text-gold">{val(back[j][i])}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
