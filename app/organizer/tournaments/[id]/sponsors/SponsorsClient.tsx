"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { Msg } from "@/components/tournaments/ui";
import { OBS_THEMES, SPONSOR_TIERS, TIER_LABEL, KIND_LABEL, type ObsKind, type ObsTheme } from "@/lib/obs/validate";
import { THEME_LABEL } from "@/lib/obs/theme";
import type { SponsorRow, SponsorState } from "./types";

// K-AV-8: ฟอร์มสปอนเซอร์/ธีม/คัดลอก URL OBS ฝั่ง client — action ตรวจสิทธิ์และค่าซ้ำฝั่ง server เสมอ
const input = "rounded border border-white/20 bg-[#12121A] px-2 py-1 text-sm text-white";
const btn = "rounded border border-white/30 px-2 py-1 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40";

type Actions = {
  add: (formData: FormData) => Promise<SponsorState>;
  update: (sponsorId: string, formData: FormData) => Promise<SponsorState>;
  remove: (sponsorId: string) => Promise<SponsorState>;
  move: (sponsorId: string, dir: "up" | "down") => Promise<SponsorState>;
};

function SponsorFields({ s }: { s?: SponsorRow }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input name="name" defaultValue={s?.name ?? ""} placeholder="ชื่อสปอนเซอร์ (1–80 ตัว)" required maxLength={80} className={input} />
      <select name="tier" defaultValue={s?.tier ?? "PARTNER"} className={input}>
        {SPONSOR_TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
      </select>
      <input name="logo_url" type="url" defaultValue={s?.logo_url ?? ""} placeholder="ลิงก์โลโก้ (https://…)" required pattern="https://.*" className={`${input} sm:col-span-2`} />
      <input name="link_url" type="url" defaultValue={s?.link_url ?? ""} placeholder="ลิงก์เว็บไซต์ (ไม่บังคับ · https://…)" pattern="https://.*" className={`${input} sm:col-span-2`} />
    </div>
  );
}

export function SponsorsManager({ sponsors, actions, canEdit }: { sponsors: SponsorRow[]; actions: Actions; canEdit: boolean }) {
  const [state, setState] = useState<SponsorState | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      {sponsors.length === 0 ? <p className="text-sm text-white/60">ยังไม่มีสปอนเซอร์</p> : null}
      <ol className="flex flex-col gap-2">
        {sponsors.map((s, i) => (
          <li key={s.id} className="rounded border border-white/15 p-3 text-sm">
            {editing === s.id ? (
              <form action={(fd) => start(async () => { const r = await actions.update(s.id, fd); setState(r); if (r.ok) setEditing(null); })} className="flex flex-col gap-2">
                <SponsorFields s={s} />
                <div className="flex gap-2">
                  <button type="submit" disabled={pending} className="rounded bg-gold px-3 py-1 text-xs font-semibold text-void disabled:opacity-50">บันทึก</button>
                  <button type="button" onClick={() => setEditing(null)} className={btn}>ยกเลิก</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <img src={s.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
                <span className="flex-1 min-w-0">
                  <b>{s.name}</b> <span className="text-xs text-white/50">· {TIER_LABEL[s.tier as keyof typeof TIER_LABEL] ?? s.tier} · ลำดับ {i + 1}</span>
                  {s.link_url ? <> · <a href={s.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan underline">เว็บไซต์</a></> : null}
                </span>
                {canEdit ? (
                  <span className="flex gap-1">
                    <button type="button" disabled={pending || i === 0} onClick={() => start(async () => setState(await actions.move(s.id, "up")))} className={btn} title="เลื่อนขึ้น">↑</button>
                    <button type="button" disabled={pending || i === sponsors.length - 1} onClick={() => start(async () => setState(await actions.move(s.id, "down")))} className={btn} title="เลื่อนลง">↓</button>
                    <button type="button" disabled={pending} onClick={() => setEditing(s.id)} className={btn}>แก้</button>
                    <button type="button" disabled={pending} onClick={() => { if (window.confirm(`ลบ ${s.name}?`)) start(async () => setState(await actions.remove(s.id))); }} className="rounded border border-red-400/60 px-2 py-1 text-xs text-red-300 disabled:opacity-40">ลบ</button>
                  </span>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ol>
      {canEdit ? (
        <form action={(fd) => start(async () => setState(await actions.add(fd)))} className="flex flex-col gap-2 rounded border border-white/15 p-3">
          <p className="text-xs text-white/60">เพิ่มสปอนเซอร์ (ไม่อัปโหลดไฟล์ — ใส่ลิงก์โลโก้ https)</p>
          <SponsorFields />
          <button type="submit" disabled={pending} className="w-fit rounded bg-gold px-3 py-1.5 text-sm font-semibold text-void disabled:opacity-50">{pending ? "…" : "เพิ่ม"}</button>
        </form>
      ) : null}
      <Msg state={state} />
    </div>
  );
}

export function ThemePicker({ current, setTheme, canEdit }: { current: ObsTheme; setTheme: (theme: string) => Promise<SponsorState>; canEdit: boolean }) {
  const [state, setState] = useState<SponsorState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {OBS_THEMES.map((t) => (
          <button key={t} type="button" disabled={pending || !canEdit} onClick={() => start(async () => setState(await setTheme(t)))}
            className={`rounded border px-3 py-1.5 text-sm ${t === current ? "border-cyan text-cyan" : "border-white/30 text-white/80"} disabled:opacity-50`}>
            {THEME_LABEL[t]}
          </button>
        ))}
      </div>
      <Msg state={state} />
    </div>
  );
}

export function ObsUrlList({ urls }: { urls: { kind: ObsKind; url: string }[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (u: string) => {
    try { await navigator.clipboard.writeText(u); setCopied(u); setTimeout(() => setCopied(null), 1500); } catch { setCopied(null); }
  };
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {urls.map(({ kind, url }) => (
        <li key={kind} className="flex flex-wrap items-center gap-2">
          <span className="w-28 text-white/70">{KIND_LABEL[kind]}</span>
          <code className="min-w-0 flex-1 truncate rounded bg-white/5 px-2 py-1 text-xs text-white/90">{url}</code>
          <button type="button" onClick={() => copy(url)} className={btn}>{copied === url ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan underline">เปิดดู</a>
        </li>
      ))}
    </ul>
  );
}
