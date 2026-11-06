// ใบ 28 รายการ (2026-11-06): ของใช้ร่วมของรายการที่เติม (ลำดับสกิล · บัฟ · ข้อความ "ไม่มีข้อมูล") — ฝั่งเซิร์ฟเวอร์
import { getDotaConstant } from "@/lib/dota/match";
import type { DotaMatchDetailPlayer } from "@/lib/dota/match";
import { H2, HEAD_ROW, PlayerCell, SCROLL, TABLE, TD, TH, type BLookups } from "./b-shared";

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

export type DLookups = {
  /** ability id → ชื่อแสดง · ไม่รู้จัก = "สกิล #id" (ไม่เดาชื่อ) */
  abilityName: (id: number) => string;
  /** id บัฟถาวร → ชื่อแสดง */
  buffName: (id: number) => string;
};

export async function dLookups(): Promise<DLookups> {
  const [ids, abilities, buffs] = await Promise.all([
    getDotaConstant("ability_ids"),
    getDotaConstant("abilities"),
    getDotaConstant("permanent_buffs"),
  ]);
  const idMap = ids.ok ? asObj(ids.data) : {};
  const abMap = abilities.ok ? asObj(abilities.data) : {};
  const buffMap = buffs.ok ? asObj(buffs.data) : {};
  const keyName = (key: string): string => {
    const d = asObj(abMap[key]).dname;
    return typeof d === "string" && d.trim() ? d : key.replaceAll("_", " ");
  };
  return {
    abilityName: (id) => {
      const key = idMap[String(id)];
      return typeof key === "string" ? keyName(key) : `สกิล #${id}`;
    },
    buffName: (id) => {
      const key = buffMap[String(id)];
      return typeof key === "string" ? keyName(key) : `บัฟ #${id}`;
    },
  };
}

/** ข้อความบนหน้าเมื่อ OpenDota ไม่มีข้อมูลรายการนั้น (หรือเป็นแบบแทน) */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 rounded border border-line/60 px-2 py-1 text-xs text-ink-muted">{children}</p>;
}

/** ลำดับสกิลรายเลเวล (ข้อ 8 Overview และข้อ 9 Builds ใช้คอมโพเนนต์นี้ตัวเดียว) */
export function SkillOrder({ players, L, D }: { players: DotaMatchDetailPlayer[]; L: BLookups; D: DLookups }) {
  const rows = players.filter((p) => p.d.abilityUpgrades !== null);
  if (rows.length === 0) return null;
  const maxLv = Math.max(...rows.map((p) => p.d.abilityUpgrades!.length));
  return (
    <section aria-label="ลำดับสกิล">
      <h2 className={H2}>ลำดับสกิล</h2>
      <div className={SCROLL}>
        <table className={TABLE}>
          <thead>
            <tr className={HEAD_ROW}>
              <th scope="col" className={TH}>ผู้เล่น</th>
              {Array.from({ length: maxLv }, (_, i) => (
                <th key={i} scope="col" className={TH}>{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.slot ?? i} className="border-b border-line/50 align-top">
                <th scope="row" className="py-2 pr-3 text-left font-normal"><PlayerCell p={p} L={L} /></th>
                {Array.from({ length: maxLv }, (_, lv) => {
                  const id = p.d.abilityUpgrades![lv];
                  return (
                    <td key={lv} className={`${TD} max-w-20 whitespace-normal text-xs`}>
                      {id === undefined ? "–" : D.abilityName(id)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
