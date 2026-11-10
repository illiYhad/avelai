"use client";
// K-AV-TOUR.1: แท็บหน้าทัวร์ — state + #hash (ไม่อ่าน query string ฝั่ง server · หน้าเป็น force-dynamic เดิม)
// เนื้อทุกแท็บ render จาก server แล้วซ่อนด้วย hidden → ไม่มี JS ก็อ่านแท็บแรกได้
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface DetailTab {
  key: string;
  label: string;
  content: ReactNode;
}

export const TAB_HASH_PREFIX = "tab-";

export default function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => {
      const h = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      const key = h.startsWith(TAB_HASH_PREFIX) ? h.slice(TAB_HASH_PREFIX.length) : "";
      if (key && tabs.some((t) => t.key === key)) setActive(key);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [tabs]);

  const choose = (key: string, focus = false) => {
    setActive(key);
    try {
      window.history.replaceState(null, "", `#${TAB_HASH_PREFIX}${key}`);
    } catch {
      /* ไม่มี history (เช่นใน iframe จำกัดสิทธิ์) — ใช้ state อย่างเดียว */
    }
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${key}"]`);
    btn?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (focus) btn?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === active);
    if (e.key === "ArrowRight") choose(tabs[(i + 1) % tabs.length].key, true);
    else if (e.key === "ArrowLeft") choose(tabs[(i - 1 + tabs.length) % tabs.length].key, true);
    else return;
    e.preventDefault();
  };

  return (
    <section className="hud-panel relative min-w-0 rounded-xl">
      <div
        ref={listRef}
        role="tablist"
        aria-label="ข้อมูลทัวร์"
        onKeyDown={onKey}
        data-tabs
        className="flex gap-1 overflow-x-auto overscroll-x-contain border-b border-line px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tabbtn-${t.key}`}
              data-tab={t.key}
              aria-selected={on}
              aria-controls={`tabpanel-${t.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => choose(t.key)}
              className={`relative min-h-11 shrink-0 whitespace-nowrap px-3 text-sm transition-colors ${on ? "text-gold" : "text-ink-muted hover:text-ink"}`}
            >
              {t.label}
              <span aria-hidden className={`absolute inset-x-2 -bottom-px h-0.5 rounded ${on ? "bg-gold shadow-[0_0_10px_rgba(201,168,76,0.8)]" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`tabpanel-${t.key}`}
          aria-labelledby={`tabbtn-${t.key}`}
          hidden={t.key !== active}
          className="p-4 sm:p-6"
        >
          {t.content}
        </div>
      ))}
    </section>
  );
}
