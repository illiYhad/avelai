"use client";

// K-AV-RULES.2: กราฟ 4 ตัวตามต้นแบบ (วาดใหม่ด้วย recharts) · ข้อมูลจาก rules-content.ts · สีจาก ref-theme.ts
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PENALTY, RADAR, ROLE_DONUT, SCORE_STACK } from "./rules-content";
import { REF } from "./ref-theme";

const tick = { fill: REF.axisText, fontSize: 12 };
const tip = { background: REF.card, border: `1px solid ${REF.border}`, color: REF.slate300, fontSize: 12 };
const legend = { fontSize: 12, color: REF.axisText };

/** เรดาร์ 5 มิติ (:611–668) */
export function FormatRadar() {
  const data = RADAR.axes.map((axis, i) => ({ axis, swiss: RADAR.swiss.data[i], queue: RADAR.queue.data[i] }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke={REF.border} />
          <PolarAngleAxis dataKey="axis" tick={{ fill: REF.slate300, fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, RADAR.max]} tick={{ fill: REF.slate500, fontSize: 12 }} axisLine={false} />
          <Radar name={RADAR.swiss.label} dataKey="swiss" stroke={REF.cyan} fill={REF.radarSwissFill} strokeWidth={2} isAnimationActive={false} />
          <Radar name={RADAR.queue.label} dataKey="queue" stroke={REF.gold} fill={REF.radarQueueFill} strokeWidth={2} isAnimationActive={false} />
          <Legend wrapperStyle={legend} />
          <Tooltip contentStyle={tip} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** โดนัท Pos 1–5 (:670–705) */
export function RoleDonut() {
  const data = ROLE_DONUT.labels.map((name, i) => ({ name, value: ROLE_DONUT.data[i] }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" stroke={REF.dark} strokeWidth={2} isAnimationActive={false}>
            {data.map((_, i) => <Cell key={i} fill={REF.roleColors[i]} />)}
          </Pie>
          <Legend verticalAlign="bottom" wrapperStyle={legend} iconSize={12} />
          <Tooltip contentStyle={tip} formatter={(v) => `${v}%`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** แท่งซ้อน Score Distribution (:707–757) */
export function ScoreStack() {
  const data = SCORE_STACK.groups.map((g, i) => ({
    group: g, outcome: SCORE_STACK.series[0].data[i], kp: SCORE_STACK.series[1].data[i], role: SCORE_STACK.series[2].data[i],
  }));
  const color = { outcome: REF.scoreOutcome, kp: REF.scoreKp, role: REF.scoreRole } as const;
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={REF.border} vertical={false} />
          <XAxis dataKey="group" tick={tick} stroke={REF.border} interval={0} height={48} />
          <YAxis tick={tick} stroke={REF.border} />
          <ReferenceLine y={0} stroke={REF.slate500} />
          <Tooltip contentStyle={tip} cursor={{ fill: REF.slate800 }} />
          <Legend wrapperStyle={legend} iconSize={12} />
          {SCORE_STACK.series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="score" fill={color[s.key as keyof typeof color]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** แท่งแนวนอน Penalty Severity (:759–795) */
export function PenaltyBars() {
  const data = PENALTY.labels.map((name, i) => ({ name, value: PENALTY.data[i] }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={REF.border} />
          <XAxis type="number" tick={tick} stroke={REF.border} domain={[-100, 0]} />
          <YAxis type="category" dataKey="name" tick={tick} stroke={REF.border} width={120} />
          <Tooltip contentStyle={tip} cursor={{ fill: REF.slate800 }} />
          <Bar dataKey="value" name={PENALTY.series} radius={6} isAnimationActive={false}>
            {data.map((_, i) => <Cell key={i} fill={REF.penaltyColors[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
