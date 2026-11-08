"use client";

import { useActionState } from "react";
import Link from "next/link";
import Surface from "@/components/ui/Surface";
import { unlinkDotaAccountAction, type DotaLinkState } from "./dota-actions";
import { LINK_MESSAGES, type SteamLinkError } from "@/lib/game-accounts/steam";

// K-AV-LINK: การ์ด "บัญชีเกม" ใน /me — Dota 2 ยืนยันผ่าน Steam จริง
// K-AV-ME.1: Phase 1 = Dota 2 เท่านั้น · MLBB = "เร็ว ๆ นี้" (ไม่มีฟอร์ม) · linkMlbb ใน mlbb-actions.ts ยังเก็บไว้ใช้ตอนเปิด MLBB · ID เก่าแสดงอ่านอย่างเดียว
// ป้ายใช้โทนเดียวกับ StatusBadge (STATUS_BADGES ถูกล็อกคีย์โดยเทสต์ของ UX2A จึงไม่เพิ่มคีย์ใหม่ที่นั่น)

export type DotaAccount = { external_id: string; verified: boolean; viaSteam: boolean } | null;
export type MlbbAccount = { external_id: string; zone_id: string | null } | null;

const initial: DotaLinkState = { ok: false, message: "" };

function Badge({ tone, children }: { tone: "ok" | "wait"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200";
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export default function GameAccountsCard({
  dota, mlbb, linked, linkError, unavailable, steamLogin = false,
}: {
  dota: DotaAccount; mlbb: MlbbAccount; linked: string | null; linkError: string | null; unavailable: boolean;
  /** K-AV-STEAMLOGIN.1: บัญชีที่เข้าด้วย Steam (อีเมลภายใน) · Steam เป็นทางเข้าทางเดียว จึงไม่มีปุ่มยกเลิกการผูก */
  steamLogin?: boolean;
}) {
  const [unlinkState, unlinkAction, unlinking] = useActionState(unlinkDotaAccountAction, initial);
  const flash =
    linked === "steam" ? { ok: true, text: LINK_MESSAGES.linked.steam }
    : linkError && linkError in LINK_MESSAGES.errors ? { ok: false, text: LINK_MESSAGES.errors[linkError as SteamLinkError] }
    : null;

  return (
    <Surface as="section" glow="cyan" className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-white/90">บัญชีเกม</h2>
      {flash ? <p className={`text-sm ${flash.ok ? "text-cyan" : "text-red-400"}`}>{flash.text}</p> : null}
      {unavailable ? (
        <p className="text-sm text-white/60">ยังเปิดใช้ไม่ได้ (ระบบกำลังเตรียมฐานข้อมูล)</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-white/80">Dota 2 · ยืนยันกับ Steam</p>
            {dota?.verified && dota.viaSteam ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-numeric text-white">{dota.external_id}</span>
                <Badge tone="ok">ยืนยันแล้ว (Steam)</Badge>
                <Link href="/me/dota" className="text-cyan underline">ดูการ์ดผู้เล่น →</Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {dota ? <><span className="font-numeric text-white">{dota.external_id}</span><Badge tone="wait">ยังไม่ยืนยัน</Badge></> : <span className="text-white/60">ยังไม่ผูกบัญชี</span>}
              </div>
            )}
            {/* K-AV-LINK.1: ยกเลิกการผูก (ทั้งแถวที่ยืนยันแล้วและแถวเก่าที่กรอกมือ) · K-AV-STEAMLOGIN.1: ซ่อนสำหรับบัญชีที่เข้าด้วย Steam */}
            {dota && !steamLogin ? (
              <form action={unlinkAction}>
                <button type="submit" disabled={unlinking} className="min-h-11 rounded border border-white/30 px-4 text-sm text-white/80 disabled:opacity-50">
                  {unlinking ? "กำลังยกเลิก…" : "ยกเลิกการผูก"}
                </button>
                {unlinkState.message ? <p className={`mt-1 text-sm ${unlinkState.ok ? "text-cyan" : "text-red-400"}`}>{unlinkState.message}</p> : null}
              </form>
            ) : null}
          </div>

          {/* K-AV-ME.1: MLBB ยังไม่เปิดใน Phase 1 → บรรทัดเดียว + ป้าย "เร็ว ๆ นี้" · ไม่มีฟอร์ม */}
          <div data-game="mlbb" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-white/60">Mobile Legends (MLBB)</span>
            <Badge tone="wait">เร็ว ๆ นี้</Badge>
            {mlbb ? <span className="font-numeric text-white/60">{mlbb.external_id}{mlbb.zone_id ? ` (${mlbb.zone_id})` : ""}</span> : null}
          </div>
        </>
      )}
    </Surface>
  );
}
