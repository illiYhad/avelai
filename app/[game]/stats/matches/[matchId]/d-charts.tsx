"use client";
// K-AV-DOTABUFF.1: กราฟของหน้าแมตช์ทุกแท็บ (recharts) — client component ไฟล์เดียวใช้ร่วม
// รับเฉพาะ array ที่ map แล้วจากฝั่งเซิร์ฟเวอร์ ไม่รับ JSON ดิบ · ค่า null = ไม่วาดจุดนั้น (ไม่แต่งเป็น 0)
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const AXIS = { fontSize: 12, fill: "currentColor" };
const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : String(v ?? "–"));

export type AdvPoint = { minute: number; value: number | null };
export type Marker = { minute: number; label: string; kind: string };

/** กราฟส่วนต่างทีม (บวก = Radiant นำ) พร้อมจุดเหตุการณ์ */
export function AdvChart({ data, label, markers }: { data: AdvPoint[]; label: string; markers: Marker[] }) {
  const at = new Map(data.map((d) => [d.minute, d.value]));
  return (
    <div className="h-56 w-full text-ink-muted" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeOpacity={0.15} />
          <XAxis dataKey="minute" tick={AXIS} unit="'" />
          <YAxis tick={AXIS} width={56} tickFormatter={fmt} />
          <Tooltip formatter={(v) => [fmt(v), label]} labelFormatter={(m) => `นาที ${m}`} />
          <ReferenceLine y={0} strokeOpacity={0.5} />
          <Line type="monotone" dataKey="value" name={label} stroke="#22d3ee" dot={false} connectNulls={false} isAnimationActive={false} />
          {markers.map((mk, i) => {
            const y = at.get(mk.minute);
            return y === undefined || y === null ? null : (
              <ReferenceDot key={i} x={mk.minute} y={y} r={4} fill={mk.kind === "roshan" ? "#a855f7" : mk.kind === "firstblood" ? "#ef4444" : "#f59e0b"} stroke="none" />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Series = { name: string; color: string; values: (number | null)[] };

/** กราฟเส้นหลายเส้นรายนาที (ทองหรือ LH ต่อผู้เล่น) */
export function MultiLine({ series, label, height = 224 }: { series: Series[]; label: string; height?: number }) {
  const len = Math.max(0, ...series.map((s) => s.values.length));
  const data = Array.from({ length: len }, (_, minute) => {
    const row: Record<string, number | null> = { minute };
    for (const s of series) row[s.name] = s.values[minute] ?? null;
    return row;
  });
  return (
    <div className="w-full text-ink-muted" style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeOpacity={0.15} />
          <XAxis dataKey="minute" tick={AXIS} unit="'" />
          <YAxis tick={AXIS} width={56} tickFormatter={fmt} />
          <Tooltip formatter={(v, n) => [fmt(v), n]} labelFormatter={(m) => `นาที ${m}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} dot={false} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** แท่งดาเมจต่อการปะทะ · แถวละการปะทะ คีย์ละผู้เล่น */
export function FightBars({ rows, series, label }: { rows: Record<string, number | string | null>[]; series: { name: string; color: string }[]; label: string }) {
  return (
    <div className="h-64 w-full text-ink-muted" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeOpacity={0.15} />
          <XAxis dataKey="fight" tick={AXIS} />
          <YAxis tick={AXIS} width={56} tickFormatter={fmt} />
          <Tooltip formatter={(v, n) => [fmt(v), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Bar key={s.name} dataKey={s.name} stackId="d" fill={s.color} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

