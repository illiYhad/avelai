"use client";

// K-AV-RULES.1: ตัวคำนวณคะแนนรายแมตช์ · เรียก computeMatchScore() / formLevel() จริงผ่าน calcView() (ไม่มีสูตรซ้ำ)
import { useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SCORE_CONFIG } from "@/lib/avelai/score";
import { calcView, EXAMPLE_FIELDS, type CalcFields } from "./calc";

const FIELDS: { key: Exclude<keyof CalcFields, "won">; label: string }[] = [
  { key: "kills", label: "Kills" },
  { key: "deaths", label: "Deaths" },
  { key: "assists", label: "Assists" },
  { key: "towers", label: "Towers" },
  { key: "wards", label: "Wards" },
  { key: "heal", label: "Heal" },
  { key: "stuns", label: "Stun (วินาที)" },
  { key: "dmgTaken", label: "DmgTaken" },
];

const COLORS = ["var(--color-gold)", "var(--color-cyan)", "var(--color-ink-muted)"];

export default function ScoreCalculator() {
  const [f, setF] = useState<CalcFields>(EXAMPLE_FIELDS);
  const v = calcView(f);
  const chart = v.ok
    ? [
        { name: "Outcome", value: v.result.outcome ?? 0 },
        { name: "KP หลังตัวคูณ", value: v.result.kpAfterMultiplier ?? 0 },
        { name: "Role Bonus", value: v.result.roleBonus.value ?? 0 },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="radiogroup" aria-label="ผลแพ้ชนะ">
        {[true, false].map((won) => (
          <button
            key={String(won)}
            type="button"
            role="radio"
            aria-checked={f.won === won}
            onClick={() => setF({ ...f, won })}
            className={`min-h-11 flex-1 rounded border px-4 py-2 text-sm font-bold ${f.won === won ? "border-gold bg-gold/15 text-gold" : "border-line text-ink-muted"}`}
          >
            {won ? "ชนะ" : "แพ้"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map((x) => (
          <label key={x.key} className="flex flex-col gap-1 text-sm text-ink-muted">
            {x.label}
            <input
              inputMode="decimal"
              value={f[x.key]}
              onChange={(e) => setF({ ...f, [x.key]: e.target.value })}
              className="min-h-11 rounded border border-line bg-surface-1 px-3 py-2 font-mono text-base text-ink"
            />
          </label>
        ))}
      </div>

      {!v.ok ? (
        <p className="text-base text-gold" role="status">{v.message}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Outcome</dt><dd className="text-ink">{v.outcome}</dd></div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Base KP</dt>
              <dd className="text-ink">{v.baseKp}{v.floored ? ` (ชนพื้น ${SCORE_CONFIG.kp.floor})` : ""}</dd>
            </div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">ตัวคูณ</dt><dd className="text-ink">{v.multiplier}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">KP หลังตัวคูณ</dt><dd className="text-ink">{v.kpAfter}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Role: Wards</dt><dd className="text-ink">{v.role.wards}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Role: Heal</dt><dd className="text-ink">{v.role.heal}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Role: Stun</dt><dd className="text-ink">{v.role.stuns}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Role: DmgTaken</dt><dd className="text-ink">{v.role.dmgTaken}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Role Bonus รวม</dt><dd className="text-ink">{v.role.total}</dd></div>
          </dl>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded border border-line p-3">
              <p className="text-xs text-ink-muted">Total Score</p>
              <p className="font-display text-2xl text-ink" data-testid="calc-total">{v.total}</p>
            </div>
            <div className="rounded border border-gold/50 p-3">
              <p className="text-xs text-ink-muted">Match Score (0–5)</p>
              <p className="font-display text-2xl text-gold" data-testid="calc-match">{v.match}</p>
            </div>
            <div className="rounded border border-cyan/40 p-3">
              <p className="text-xs text-ink-muted">Level ถ้าฟอร์มเท่าค่านี้</p>
              <p className="font-display text-2xl text-cyan" data-testid="calc-level">{v.level}</p>
            </div>
          </div>
          <p className="text-xs text-ink-muted">เล่นไม่ครบ 5 นัด ใช้ฟอร์ม {SCORE_CONFIG.form.baseline}</p>
          <div className="h-56 w-full" aria-label="กราฟส่วนประกอบคะแนน">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} stroke="var(--color-line)" />
                <YAxis tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} stroke="var(--color-line)" />
                <ReferenceLine y={0} stroke="var(--color-line)" />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  contentStyle={{ background: "var(--color-surface-1)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                  formatter={(val) => (typeof val === "number" ? val.toFixed(2) : String(val))}
                />
                <Bar dataKey="value" isAnimationActive={false}>
                  {chart.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
