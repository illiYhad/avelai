"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { defaultLocale, dict, type Locale } from "@/lib/i18n";

// K-AV-HOME.2: กล่องแนะนำครั้งแรก (ภาพต้นแบบ 03_space_modal.png) · AVE (อีฟ) พูดสั้น ๆ · ปุ่มเดียว
// เด้งครั้งแรกครั้งเดียว: จำใน localStorage · อ่าน/เขียนไม่ได้ (โหมดส่วนตัว/บล็อก) = ไม่เด้ง ไม่พัง
export const ESTA_INTRO_KEY = "avelai.esta.intro.v1";

/** true = ควรเด้ง (ยังไม่เคยเห็น และอ่าน storage ได้) */
export function shouldShowIntro(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    if (!storage) return false;
    return storage.getItem(ESTA_INTRO_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markIntroSeen(storage: Pick<Storage, "setItem"> | null | undefined): void {
  try {
    storage?.setItem(ESTA_INTRO_KEY, "1");
  } catch {
    // เขียนไม่ได้ = ครั้งหน้าอาจเด้งอีก ไม่เป็นไร
  }
}

const noSubscribe = () => () => {};

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export default function EstaIntro({ locale = defaultLocale }: { locale?: Locale }) {
  const t = dict(locale).esta.intro;
  // server/hydration = ไม่เด้ง · หลัง hydrate อ่าน localStorage (useSyncExternalStore ไม่ต้อง setState ใน effect)
  const canShow = useSyncExternalStore(noSubscribe, () => shouldShowIntro(getStorage()), () => false);
  const [dismissed, setDismissed] = useState(false);
  const open = canShow && !dismissed;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    markIntroSeen(getStorage());
    setDismissed(true);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void/80 px-4 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="esta-intro-title"
        data-esta-intro
        className="hud-panel relative w-full max-w-md rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Image src="/brand/rules/ave-avatar-256.jpg" width={48} height={48} alt="AVE" className="h-12 w-12 rounded-full border border-cyan/50" />
          <h2 id="esta-intro-title" className="hud-title text-xl text-ink">{t.title}</h2>
        </div>
        <p className="mt-4 text-base text-ink-muted">{t.body}</p>
        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-base text-ink">
          {t.points.split("|").map((p) => <li key={p}>{p}</li>)}
        </ul>
        <div className="mt-6 flex justify-end">
          <button type="button" autoFocus onClick={close} className="btn-primary min-h-11 rounded-md px-6">
            {t.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
