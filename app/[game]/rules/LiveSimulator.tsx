"use client";

// K-AV-RULES.2: Live Simulator ตามต้นแบบ :358–442 · ตัวเลขทุกตัวจาก calcView() → computeMatchScore() / formLevel()
// ช่อง "ตำแหน่ง" ไม่เปลี่ยนคะแนน (ต้นแบบ :797–844 ก็ไม่ใช้) · เก็บไว้ส่ง AI Caster ใน K-AV-RULES.3
import { useState } from "react";
import { calcView, EXAMPLE_FIELDS, type CalcFields } from "./calc";
import { SIM } from "./rules-content";

const box = "w-full rounded border border-[var(--ref-s700)] bg-[var(--ref-s800)] p-2 font-mono text-white outline-none focus:border-[var(--ref-cyan400)]";
const small = "w-full rounded border border-[var(--ref-s700)] bg-[var(--ref-s900)] p-1.5 font-mono text-white outline-none focus:border-[var(--ref-cyan400)]";

export default function LiveSimulator() {
  const [f, setF] = useState<CalcFields>(EXAMPLE_FIELDS);
  const [role, setRole] = useState<string>(SIM.defaultRole);
  const v = calcView(f);
  const set = (k: Exclude<keyof CalcFields, "won">) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="rounded-xl border border-[var(--ref-border)] bg-[var(--ref-card)] p-5 lg:col-span-5">
      <h4 className="mb-4 border-b border-[var(--ref-s700)] pb-2 font-display text-base font-semibold text-white">{SIM.title}</h4>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="col-span-2 md:col-span-1">
          <span className="mb-1 block text-[var(--ref-s400)]">{SIM.outcome}</span>
          <select aria-label={SIM.outcome} value={f.won ? "win" : "loss"} onChange={(e) => setF({ ...f, won: e.target.value === "win" })} className={`${box} font-sans font-bold`}>
            <option value="win">{SIM.win}</option>
            <option value="loss">{SIM.lose}</option>
          </select>
        </label>
        <label className="col-span-2 md:col-span-1">
          <span className="mb-1 block text-[var(--ref-s400)]">{SIM.role}</span>
          <select aria-label={SIM.role} value={role} onChange={(e) => setRole(e.target.value)} className={`${box} font-sans font-bold`} data-role={role}>
            {SIM.roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <div className="col-span-2">
          <span className="mb-1 block text-[var(--ref-gold)]">{SIM.formLabel}</span>
          <div className="w-full rounded border border-[var(--ref-gold-50)] bg-[var(--ref-s900)] p-2 text-[var(--ref-s300)]">
            {SIM.matchLead} <span className="font-mono font-bold text-[var(--ref-gold)]" data-testid="sim-match">{v.ok ? v.match : "–"}</span>{" "}
            (Level <span data-testid="sim-level">{v.ok ? v.levelNum : "–"}</span>)
          </div>
        </div>
        {([["kills", SIM.kills], ["deaths", SIM.deaths], ["assists", SIM.assists], ["towers", SIM.towers]] as const).map(([k, label]) => (
          <label key={k}>
            <span className="mb-1 block text-[var(--ref-s400)]">{label}</span>
            <input inputMode="numeric" value={f[k]} onChange={set(k)} className={box} />
          </label>
        ))}
      </div>

      <div className="mt-3 space-y-2 rounded-lg border border-[var(--ref-s700)] bg-[var(--ref-s800-60)] p-3 text-xs">
        <span className="block font-bold text-[var(--ref-amber400)]">{SIM.roleBox}</span>
        <div className="grid grid-cols-2 gap-2">
          {([["wards", SIM.wards], ["heal", SIM.heal], ["stuns", SIM.stun], ["dmgTaken", SIM.dmg]] as const).map(([k, label]) => (
            <label key={k}>
              <span className="block text-xs text-[var(--ref-s400)]">{label}</span>
              <input inputMode="numeric" value={f[k]} onChange={set(k)} className={small} />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--ref-cyan-30)] bg-[var(--ref-s950)] p-4">
        <div className="min-w-0">
          <p className="text-xs text-[var(--ref-s400)]">{SIM.totalLabel}</p>
          <p className="mt-0.5 break-words font-mono text-xs text-[var(--ref-s500)]" data-testid="sim-breakdown">{v.ok ? v.breakdown : v.message}</p>
        </div>
        <div className="text-right">
          <span className="bg-gradient-to-r from-[var(--ref-cyan400)] to-[var(--ref-em400)] bg-clip-text font-display text-3xl font-black text-transparent" data-testid="sim-total">
            {v.ok ? v.total : "–"}
          </span>
          <span className="block text-xs text-[var(--ref-s400)]">{SIM.pts}</span>
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--ref-s800)] pt-2">
        <button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[var(--ref-cyan-50)] bg-gradient-to-r from-[var(--ref-cyan-30)] to-[var(--ref-blue)]/40 px-4 py-2.5 text-sm font-semibold text-white opacity-60">
          {SIM.caster}
        </button>
        <p className="mt-1 text-center text-xs text-[var(--ref-s500)]">{SIM.casterSoon}</p>
      </div>
    </div>
  );
}
