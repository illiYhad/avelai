"use client";

import { useEffect, useRef, useState } from "react";

// K-AV-UX2A Phase B: กระดานสาย (แสดงผลอย่างเดียว) — เลื่อนแนวนอน + เงาขอบ + scroll-snap ต่อรอบ · คลิกกล่อง = แผงรายละเอียด
// (ขวาบนจอใหญ่ · bottom sheet บนมือถือ) — ใช้เฉพาะข้อมูลที่หน้าโหลดมาแล้ว ไม่มี fetch เพิ่ม
export type BoardSlot = {
  key: string;
  a: { label: string; won: boolean };
  b: { label: string; won: boolean };
  statusText: string;
  void: boolean;
  reset: boolean;
};
export type BoardGroup = { bracket: string; label: string; rounds: { round: number; slots: BoardSlot[] }[] };

function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="relative">
      <div ref={ref} onScroll={measure} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
        {children}
      </div>
      {edge.left ? <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-void to-transparent" /> : null}
      {edge.right ? <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-void to-transparent" /> : null}
    </div>
  );
}

export default function BracketBoard({ groups }: { groups: BoardGroup[] }) {
  const [sel, setSel] = useState<{ slot: BoardSlot; where: string } | null>(null);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sel]);

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        {groups.map((g) => (
          <section key={g.bracket}>
            <h2 className="mb-3 font-mono text-sm tracking-[0.2em] text-ink-muted">{"// "}{g.label}</h2>
            <ScrollRow>
              {g.rounds.map((r) => (
                <div key={r.round} className="flex w-60 shrink-0 snap-start flex-col gap-3">
                  <p className="font-mono text-xs tracking-[0.2em] text-ink-muted">ROUND {r.round}</p>
                  {r.slots.map((s) => {
                    const active = sel?.slot.key === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSel(active ? null : { slot: s, where: `${g.label} · รอบ ${r.round}` })}
                        className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          s.void ? "border-line text-ink-muted" : active ? "border-gold bg-surface-3" : "border-line bg-surface-2 hover:border-cyan/50"
                        }`}
                      >
                        {s.reset ? <span className="mb-1 block text-xs text-ink-muted">นัดตัดสิน (ถ้าสายล่างชนะ)</span> : null}
                        {(["a", "b"] as const).map((side) => (
                          <span key={side} className={`flex items-center justify-between gap-2 py-0.5 ${s[side].won ? "text-cyan" : "text-ink"}`}>
                            <span className="truncate">{s.void ? "–" : s[side].label}</span>
                            {s[side].won ? <span aria-label="ชนะ">✓</span> : null}
                          </span>
                        ))}
                        <span className="mt-1 block text-xs text-ink-muted">{s.statusText}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </ScrollRow>
          </section>
        ))}
      </div>

      {sel ? (
        <>
          <div aria-hidden className="fixed inset-0 z-40 bg-void/70 lg:hidden" onClick={() => setSel(null)} />
          <aside
            role="dialog"
            aria-label="รายละเอียดแมตช์"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-line bg-surface-2 p-5 lg:sticky lg:top-24 lg:z-auto lg:w-72 lg:shrink-0 lg:rounded-lg"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="font-mono text-xs tracking-[0.2em] text-cyan">{"// "}{sel.where}</p>
              <button type="button" onClick={() => setSel(null)} aria-label="ปิด" className="flex h-11 w-11 items-center justify-center rounded text-ink-muted">✕</button>
            </div>
            <dl className="flex flex-col gap-2 text-base">
              <div><dt className="text-sm text-ink-muted">ทีม A</dt><dd className={sel.slot.a.won ? "text-cyan" : "text-ink"}>{sel.slot.a.label}{sel.slot.a.won ? " ✓" : ""}</dd></div>
              <div><dt className="text-sm text-ink-muted">ทีม B</dt><dd className={sel.slot.b.won ? "text-cyan" : "text-ink"}>{sel.slot.b.label}{sel.slot.b.won ? " ✓" : ""}</dd></div>
              <div><dt className="text-sm text-ink-muted">สถานะ</dt><dd className="text-ink">{sel.slot.statusText}</dd></div>
            </dl>
          </aside>
        </>
      ) : null}
    </div>
  );
}
