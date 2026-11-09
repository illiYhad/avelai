"use client";
// K-AV-TOUR.1: ทัวร์สอนใช้แบบทั่วไป (ใช้ร่วม HOME.2) — ชี้เป้าด้วย [data-tour="<target>"] · กล่องลอยข้างเป้า + แถบความคืบหน้า
// จำว่าดูแล้วใน localStorage (ห่อ try/catch ทุกจุด · ไม่แตะฐาน) · ESC = ข้าม · prefers-reduced-motion = ไม่มีแอนิเมชัน
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface TourStep {
  target: string;
  title: string;
  body: string;
}

export const TOUR_SKIP = "ข้าม";
export const TOUR_NEXT = "ถัดไป";
export const TOUR_DONE = "เข้าใจแล้ว";

export function readSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeSeen(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* โหมดส่วนตัว/บล็อก storage — ปิดทัวร์ในรอบนี้ได้ แค่จำไม่ได้ */
  }
}

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;
const CARD_W = 320;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function StepTour({ steps, storageKey, avatar }: { steps: TourStep[]; storageKey: string; avatar?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [reduced, setReduced] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);

  // เปิดหลัง hydrate (localStorage/matchMedia มีแค่ฝั่ง client) · รอ 1 เฟรมให้หน้าวางเสร็จก่อนวัดเป้า
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      let r = false;
      try {
        r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        r = false;
      }
      setReduced(r);
      if (!readSeen(storageKey) && steps.length > 0) setOpen(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [storageKey, steps.length]);

  const close = useCallback(() => {
    writeSeen(storageKey);
    setOpen(false);
  }, [storageKey]);

  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // เลื่อนเป้าเข้าจอแล้ววัดตำแหน่ง
  useEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    const raf = window.requestAnimationFrame(measure);
    const t = window.setTimeout(measure, reduced ? 0 : 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, reduced, measure]);

  useIsoLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, open, box]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, i]);

  if (!open || !step) return null;

  const last = i === steps.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const w = Math.min(CARD_W, vw - 32);
  let top = vh / 2 - cardH / 2;
  let left = vw / 2 - w / 2;
  if (box) {
    const below = box.top + box.height + 12;
    const above = box.top - cardH - 12;
    if (below + cardH <= vh - 8) top = below;
    else if (above >= 8) top = above;
    else top = Math.max(8, vh - cardH - 8);
    left = Math.min(Math.max(16, box.left), vw - w - 16);
  }
  const anim = reduced ? "" : "transition-all duration-300 ease-out";

  return (
    <div data-step-tour className="fixed inset-0 z-[60]" aria-live="polite">
      {/* ฉากมืด + ช่องเจาะรอบเป้า */}
      {box ? (
        <div
          aria-hidden
          className={`pointer-events-none fixed rounded-xl border-2 border-gold shadow-[0_0_0_9999px_rgba(2,6,23,0.72),0_0_24px_rgba(201,168,76,0.6)] ${anim}`}
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(2,6,23,0.72)]" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-tour-title"
        tabIndex={-1}
        data-tour-step={i + 1}
        className={`hud-panel hud-panel-gold fixed rounded-xl p-4 outline-none ${anim}`}
        style={{ top, left, width: w }}
      >
        <div className="mb-3 flex gap-1" aria-label={`ขั้น ${i + 1} จาก ${steps.length}`}>
          {steps.map((s, k) => (
            <span key={s.target} aria-hidden className={`h-1 flex-1 rounded ${k <= i ? "bg-gold" : "bg-white/15"}`} />
          ))}
        </div>
        <div className="flex gap-3">
          {avatar ? <div className="shrink-0">{avatar}</div> : null}
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-[0.2em] text-ink-muted">{`${i + 1}/${steps.length}`}</p>
            <h2 id="step-tour-title" className="font-display text-base tracking-[0.04em] text-gold">{step.title}</h2>
            <p className="mt-1 text-sm text-ink">{step.body}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={close} className="min-h-11 px-2 text-sm text-ink-muted hover:text-ink">{TOUR_SKIP}</button>
          <button
            type="button"
            onClick={() => (last ? close() : setI(i + 1))}
            className="btn-primary min-h-11 rounded px-5 font-display text-sm tracking-[0.08em]"
          >
            {last ? TOUR_DONE : TOUR_NEXT}
          </button>
        </div>
      </div>
    </div>
  );
}
