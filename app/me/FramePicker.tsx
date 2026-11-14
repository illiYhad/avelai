"use client";
// K-AV-R3C.1: เลือกกรอบโปรไฟล์จากคลังตัวเอง (rpc equip_frame · migration 221) · แสดงเฉพาะเมื่อ FEATURES.frames
import { useState, useTransition } from "react";
import ProfileFrame from "@/components/frames/ProfileFrame";
import { getBrowserDb } from "@/lib/db/browser";
import { dict, type Locale } from "@/lib/i18n";

export default function FramePicker({ owned, equipped, locale = "th" }: { owned: { itemId: string; name: string }[]; equipped: string | null; locale?: Locale }) {
  const t = dict(locale).frames;
  const [current, setCurrent] = useState<string | null>(equipped);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const save = (itemId: string | null) =>
    start(async () => {
      setError(false);
      const db = getBrowserDb();
      const res = db ? await db.rpc("equip_frame", { p_item_id: itemId }) : { error: { message: "no db" } };
      if (res.error) setError(true);
      else setCurrent(itemId);
    });
  return (
    <section data-frame-picker className="hud-panel rounded-xl p-4">
      <h2 className="mb-3 text-sm font-semibold text-white/90">{t.title}</h2>
      {owned.length === 0 ? (
        <p className="text-sm text-white/60">{t.empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {owned.map((f) => (
            <li key={f.itemId} className="flex w-24 flex-col items-center gap-1 text-center">
              <ProfileFrame itemId={f.itemId} size={64} />
              <span className="text-xs text-white/80">{f.name}</span>
              {current === f.itemId ? (
                <button type="button" disabled={pending} onClick={() => save(null)} className="btn-ghost min-h-11 rounded px-2 text-xs">{pending ? t.saving : t.unequip}</button>
              ) : (
                <button type="button" disabled={pending} onClick={() => save(f.itemId)} className="btn-primary min-h-11 rounded px-2 text-xs">{pending ? t.saving : t.equip}</button>
              )}
              {current === f.itemId ? <span className="text-xs text-cyan">{t.equipped}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {error ? <p role="alert" className="mt-2 text-sm text-red-300">{t.failed}</p> : null}
    </section>
  );
}
