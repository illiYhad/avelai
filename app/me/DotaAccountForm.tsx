"use client";

import { useActionState } from "react";
import { linkDotaAccountAction, unlinkDotaAccountAction, type DotaLinkState } from "./dota-actions";

const initialState: DotaLinkState = { ok: false, message: "" };

/** K-AV-D1: ส่วน "บัญชี Dota 2" ในหน้า /me · ป้าย "ยังไม่ยืนยัน" จนกว่าจะมีขั้นยืนยัน (ใบถัดไป) */
export default function DotaAccountForm({
  externalId,
  verified,
  unavailable,
}: {
  externalId: string | null;
  verified: boolean;
  unavailable: boolean;
}) {
  const [linkState, linkAction, linking] = useActionState(linkDotaAccountAction, initialState);
  const [unlinkState, unlinkAction, unlinking] = useActionState(unlinkDotaAccountAction, initialState);
  const state = unlinkState.message ? unlinkState : linkState;

  return (
    <section className="flex w-full max-w-sm flex-col gap-3">
      <h2 className="text-sm font-semibold text-white/90">บัญชี Dota 2</h2>
      {unavailable ? (
        <p className="text-sm text-white/60">ยังเปิดใช้ไม่ได้ (ระบบกำลังเตรียมฐานข้อมูล)</p>
      ) : (
        <>
          {externalId ? (
            <div className="flex items-center justify-between gap-3 rounded border border-white/15 px-3 py-2 text-sm">
              <span className="font-numeric text-white">{externalId}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${verified ? "bg-cyan/20 text-cyan" : "bg-white/10 text-white/70"}`}>
                {verified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-white/60">ยังไม่ได้ผูกบัญชี</p>
          )}
          <form action={linkAction} className="flex flex-col gap-2">
            <label htmlFor="dota_id" className="text-sm text-white/80">
              Dota ID · SteamID64 · หรือลิงก์ Dotabuff / OpenDota
            </label>
            <input
              id="dota_id"
              name="dota_id"
              required
              placeholder="เช่น 94288314"
              className="rounded border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-gold"
            />
            <button type="submit" disabled={linking} className="rounded bg-gold px-4 py-2 font-semibold text-void disabled:opacity-50">
              {linking ? "กำลังบันทึก…" : externalId ? "เปลี่ยนบัญชี" : "ผูกบัญชี"}
            </button>
          </form>
          {externalId ? (
            <form action={unlinkAction}>
              <button
                type="submit"
                disabled={unlinking}
                className="rounded border border-white/30 px-3 py-1.5 text-sm text-white/80 disabled:opacity-50"
              >
                {unlinking ? "กำลังยกเลิก…" : "ยกเลิกการผูก"}
              </button>
            </form>
          ) : null}
        </>
      )}
      {state.message ? <p className={`text-sm ${state.ok ? "text-cyan" : "text-red-400"}`}>{state.message}</p> : null}
    </section>
  );
}
