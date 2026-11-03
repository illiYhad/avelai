"use client";

import { useActionState } from "react";
import Link from "next/link";
import Surface from "@/components/ui/Surface";
import { linkMlbb, type MlbbLinkState } from "./mlbb-actions";
import { unlinkDotaAccountAction, type DotaLinkState } from "./dota-actions";
import { LINK_MESSAGES, type SteamLinkError } from "@/lib/game-accounts/steam";

// K-AV-LINK: การ์ด "บัญชีเกม" ใน /me — Dota 2 ยืนยันผ่าน Steam จริง · MLBB กรอกเอง (ยังไม่ยืนยัน)
// ป้ายใช้โทนเดียวกับ StatusBadge (STATUS_BADGES ถูกล็อกคีย์โดยเทสต์ของ UX2A จึงไม่เพิ่มคีย์ใหม่ที่นั่น)

export type DotaAccount = { external_id: string; verified: boolean; viaSteam: boolean } | null;
export type MlbbAccount = { external_id: string; zone_id: string | null } | null;

const initial: MlbbLinkState = { ok: false, message: "" };

function Badge({ tone, children }: { tone: "ok" | "wait"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200";
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export default function GameAccountsCard({
  dota, mlbb, linked, linkError, unavailable,
}: {
  dota: DotaAccount; mlbb: MlbbAccount; linked: string | null; linkError: string | null; unavailable: boolean;
}) {
  const [state, action, pending] = useActionState(linkMlbb, initial);
  const [unlinkState, unlinkAction, unlinking] = useActionState(unlinkDotaAccountAction, initial as DotaLinkState);
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
                {/* ลิงก์ธรรมดา (ไม่ใช่ Link) — เป็น route handler ที่ redirect ไปนอกเว็บ ไม่ใช่หน้า */}
                {/* ต้องเป็น <a>: เป็น route handler ที่ redirect ไป Steam (Link จะ prefetch/soft-navigate ไปนอกเว็บ) */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/link/steam/start" className="rounded btn-primary px-4 py-2">ผูกบัญชี Steam</a>
              </div>
            )}
            {/* K-AV-LINK.1: ยกเลิกการผูก (ทั้งแถวที่ยืนยันแล้วและแถวเก่าที่กรอกมือ) */}
            {dota ? (
              <form action={unlinkAction}>
                <button type="submit" disabled={unlinking} className="min-h-11 rounded border border-white/30 px-4 text-sm text-white/80 disabled:opacity-50">
                  {unlinking ? "กำลังยกเลิก…" : "ยกเลิกการผูก"}
                </button>
                {unlinkState.message ? <p className={`mt-1 text-sm ${unlinkState.ok ? "text-cyan" : "text-red-400"}`}>{unlinkState.message}</p> : null}
              </form>
            ) : null}
          </div>

          <form action={action} className="flex flex-col gap-2">
            <p className="text-sm text-white/80">Mobile Legends (MLBB) · กรอกเอง</p>
            {mlbb ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-numeric text-white">{mlbb.external_id}{mlbb.zone_id ? ` (${mlbb.zone_id})` : ""}</span>
                <Badge tone="wait">ยังไม่ยืนยัน</Badge>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <input name="mlbb_id" required inputMode="numeric" placeholder="MLBB ID" aria-label="MLBB ID"
                className="min-w-0 flex-1 rounded border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-gold" />
              <input name="zone_id" required inputMode="numeric" placeholder="Server ID" aria-label="Server ID"
                className="w-28 rounded border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-gold" />
            </div>
            <button type="submit" disabled={pending} className="self-start rounded btn-primary px-4 py-2 disabled:opacity-50">
              {pending ? "กำลังบันทึก…" : mlbb ? "เปลี่ยน ID" : "บันทึก"}
            </button>
            <p className="text-xs text-white/60">Moonton ไม่มีระบบยืนยันจากภายนอก ผู้จัดจะตรวจเองถ้าจำเป็น</p>
            {state.message ? <p className={`text-sm ${state.ok ? "text-cyan" : "text-red-400"}`}>{state.message}</p> : null}
          </form>
        </>
      )}
    </Surface>
  );
}
