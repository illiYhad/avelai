/* eslint-disable @next/next/no-img-element */
import React from 'react';

// K-AV-HUB1: การ์ดโปรไฟล์แนวตั้งของหน้า Hub — ชื่อ/รูปจาก session ผู้ใช้เท่านั้น (ไม่มีค่าตั้งต้นเป็นชื่อสมมติ)
// ค่าที่ยังไม่มีข้อมูลจริง (CP · อันดับ · Token · Cash) ส่ง null → แสดง "—" · สี/ฟอนต์ใช้ token CI
// ช่อง gachaFrameUrl / gachaTitleBadgeUrl คงไว้สำหรับ Genesis_Gacha ในอนาคต
export interface PlayerVerticalProfileProps {
  username: string;
  avatarUrl?: string | null;
  rankTitle?: string | null;
  gachaFrameUrl?: string | null;
  gachaTitleBadgeUrl?: string | null;
  circuitPoints?: number | null;
  seasonRank?: number | null;
  tokens?: number | null;
  cashBalanceThb?: number | null;
  action?: React.ReactNode;
}

const dash = (v: number | null | undefined, fmt: (n: number) => string = (n) => n.toLocaleString('th-TH')) =>
  v === null || v === undefined ? '—' : fmt(v);

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-void/60 p-3">
      <div className="font-mono text-xs tracking-wider text-ink-muted">{label}</div>
      <div className={`font-numeric text-base font-bold ${tone}`}>{value}</div>
    </div>
  );
}

export const PlayerVerticalProfile: React.FC<PlayerVerticalProfileProps> = ({
  username,
  avatarUrl = null,
  rankTitle = null,
  gachaFrameUrl = null,
  gachaTitleBadgeUrl = null,
  circuitPoints = null,
  seasonRank = null,
  tokens = null,
  cashBalanceThb = null,
  action,
}) => (
  <div className="ci-corners relative flex h-full w-full flex-col justify-between rounded-2xl border border-cyan/30 bg-panel p-5 shadow-glow-cyan [--corner:var(--color-cyan)] md:p-6">
    <div>
      <div className="relative mx-auto mt-2 mb-4 flex h-28 w-28 items-center justify-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-line bg-void">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-3xl font-black text-cyan">{username.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        {gachaFrameUrl ? (
          <img src={gachaFrameUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-cyan/30" />
        )}
      </div>

      <div className="space-y-1 text-center">
        <h2 className="truncate font-display text-lg font-black tracking-wide text-ink">{username}</h2>
        {rankTitle ? (
          <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-muted">{rankTitle}</span>
        ) : null}
        {gachaTitleBadgeUrl ? <img src={gachaTitleBadgeUrl} alt="" className="mx-auto h-5 object-contain" /> : null}
      </div>
    </div>

    <div className="mt-6 space-y-2 border-t border-line pt-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="CIRCUIT POINTS" value={dash(circuitPoints)} tone="text-cyan" />
        <Stat label="อันดับซีซัน" value={dash(seasonRank, (n) => `#${n}`)} tone="text-cyan" />
        <Stat label="TOKENS" value={dash(tokens)} tone="text-gold" />
        <Stat label="CASH" value={dash(cashBalanceThb, (n) => `฿${n.toFixed(2)}`)} tone="text-gold" />
      </div>
      {action}
    </div>
  </div>
);
