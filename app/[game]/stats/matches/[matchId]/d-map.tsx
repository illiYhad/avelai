// K-AV-DOTABUFF.1: แผนที่ของหน้าแมตช์ทุกแท็บ — วาดผังเองด้วย SVG (ไม่ใช้ภาพของ Valve หรือ Dotabuff) · ไฟล์เดียวใช้ร่วม
// ผังเป็นแบบย่อ: Radiant มุมซ้ายล่าง · Dire มุมขวาบน · ตำแหน่งป้อมเป็นตำแหน่งบนผัง ไม่ใช่พิกัดเกมจริง
import type { BarracksState, TowerState } from "@/lib/dota/match/d-full";
import { mapPos } from "@/lib/dota/match/d-full";

/** สีผู้เล่น 10 ช่อง (Radiant 5 ตัวแรก · Dire 5 ตัวหลัง) */
export const PLAYER_COLORS = ["#22d3ee", "#34d399", "#60a5fa", "#a3e635", "#2dd4bf", "#f59e0b", "#f87171", "#fb923c", "#e879f9", "#facc15"];

function Base({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className="aspect-square w-full max-w-sm rounded border border-line bg-[#0f1a14]">
      {/* แม่น้ำ (ทแยงซ้ายบน→ขวาล่าง) และเลน 3 เส้น */}
      <path d="M2 18 L82 98" stroke="#1e3a5f" strokeWidth="6" strokeOpacity="0.6" />
      <path d="M8 92 L8 8 L92 8 M8 92 L92 92 L92 8 M12 88 L88 12" stroke="#3f3f46" strokeWidth="2" fill="none" />
      <circle cx="10" cy="90" r="6" fill="#0e7490" fillOpacity="0.5" />
      <circle cx="90" cy="10" r="6" fill="#b45309" fillOpacity="0.5" />
      {children}
    </svg>
  );
}

export type MapPoint = { x: number; y: number; color: string; title: string; r?: number; hollow?: boolean };

/** จุดบนแผนที่จากพิกัด log ของ OpenDota (ช่วง MAP_MIN-MAP_MAX) */
export function PointsMap({ points, label }: { points: MapPoint[]; label: string }) {
  return (
    <Base label={label}>
      {points.map((p, i) => {
        const { fx, fy } = mapPos(p.x, p.y);
        return (
          <circle key={i} cx={fx * 100} cy={fy * 100} r={p.r ?? 1.8} fill={p.hollow ? "none" : p.color} stroke={p.color} strokeWidth={p.hollow ? 0.8 : 0.3}>
            <title>{p.title}</title>
          </circle>
        );
      })}
    </Base>
  );
}

// ตำแหน่งบนผังของฝั่ง Radiant · Dire = กลับด้าน (100-x, 100-y) ของเลนตรงข้าม
const R_TOWER: Record<string, [number, number][]> = {
  top: [[8, 34], [8, 54], [8, 72]],
  mid: [[42, 58], [33, 67], [24, 76]],
  bot: [[66, 92], [46, 92], [28, 92]],
  base: [[15, 82], [18, 85]],
};
const R_RAX: Record<string, [number, number]> = { top: [8, 78], mid: [20, 80], bot: [22, 92] };
const mirror = (lane: string) => (lane === "top" ? "bot" : lane === "bot" ? "top" : lane);

function towerXY(side: "radiant" | "dire", t: TowerState, baseIdx: number): [number, number] {
  const lane = side === "radiant" ? t.lane : mirror(t.lane);
  const [x, y] = t.lane === "base" ? R_TOWER.base[baseIdx] : R_TOWER[lane][t.tier - 1];
  return side === "radiant" ? [x, y] : [100 - x, 100 - y];
}

/** ป้อม (สี่เหลี่ยม) และค่าย (สามเหลี่ยม) ที่เหลือตอนจบเกม · ทึบ = ยังอยู่ · โปร่ง = ถูกทำลาย */
export function BuildingMap({ sides }: { sides: { side: "radiant" | "dire"; towers: TowerState[] | null; barracks: BarracksState[] | null }[] }) {
  return (
    <Base label="แผนที่ป้อมและค่ายตอนจบเกม">
      {sides.flatMap(({ side, towers, barracks }) => {
        const color = side === "radiant" ? "#22d3ee" : "#f59e0b";
        let baseIdx = 0;
        const tw = (towers ?? []).map((t, i) => {
          const [x, y] = towerXY(side, t, t.lane === "base" ? baseIdx++ : 0);
          return (
            <rect key={`${side}-t${i}`} x={x - 2} y={y - 2} width="4" height="4" fill={t.alive ? color : "none"} stroke={color} strokeWidth="0.6">
              <title>{`${side === "radiant" ? "Radiant" : "Dire"} ${t.lane === "base" ? "T4" : `${LANE_TH[t.lane]} T${t.tier}`} · ${t.alive ? "ยังอยู่" : "ถูกทำลาย"}`}</title>
            </rect>
          );
        });
        const rx = (barracks ?? []).map((b, i) => {
          const lane = side === "radiant" ? b.lane : mirror(b.lane);
          const [bx, by] = R_RAX[lane];
          const off = b.kind === "melee" ? -2.5 : 2.5;
          const [x, y] = side === "radiant" ? [bx + off, by] : [100 - bx - off, 100 - by];
          return (
            <path key={`${side}-b${i}`} d={`M${x} ${y - 2} L${x + 2} ${y + 1.5} L${x - 2} ${y + 1.5} Z`} fill={b.alive ? color : "none"} stroke={color} strokeWidth="0.6">
              <title>{`${side === "radiant" ? "Radiant" : "Dire"} ค่าย${LANE_TH[b.lane]} ${b.kind} · ${b.alive ? "ยังอยู่" : "ถูกทำลาย"}`}</title>
            </path>
          );
        });
        return [...tw, ...rx];
      })}
    </Base>
  );
}

export const LANE_TH: Record<string, string> = { top: "บน", mid: "กลาง", bot: "ล่าง", base: "ฐาน" };
