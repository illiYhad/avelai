"use client";

// ยกจาก Zodiac components/team/InvitePlayerModal.tsx — เปลี่ยน identifier เป็น username
// และปรับสีเข้าธีม AVELAi (#00D4FF / #0A0A0F)
import React, { useState, useTransition } from "react";
import { invitePlayerAction } from "@/app/[game]/teams/actions";

interface InvitePlayerModalProps {
  teamId: string;
}

export function InvitePlayerModal({ teamId }: InvitePlayerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setIsOpen(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIdentifier("");
  };

  const handleClose = () => {
    if (!isPending) setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("identifier", identifier.trim());
      const res = await invitePlayerAction(teamId, formData);
      if ("error" in res) {
        setErrorMessage(res.error.message);
      } else {
        setSuccessMessage("เพิ่มผู้เล่นเข้าทีมเรียบร้อยแล้ว!");
        setTimeout(() => setIsOpen(false), 1200);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 rounded border border-[#00D4FF] bg-transparent px-4 py-2 text-xs font-bold tracking-wider text-[#00D4FF] hover:bg-[#00D4FF]/10 transition-all cursor-pointer"
      >
        + เชิญผู้เล่น / INVITE PLAYER
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#12121A] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-sm font-black tracking-wider text-white uppercase">
                เชิญผู้เล่นเข้าร่วมทีม
              </h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="text-neutral-400 hover:text-white transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1.5">
                  ระบุ username ของผู้เล่น:
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="เช่น player_abc123"
                  disabled={isPending}
                  required
                  className="w-full rounded border border-white/15 bg-[#0A0A0F] px-3.5 py-2.5 font-mono text-xs text-white placeholder:text-neutral-500 focus:border-[#00D4FF] focus:outline-none"
                />
              </div>

              {errorMessage && (
                <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {successMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="rounded px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending || !identifier.trim()}
                  className="rounded bg-[#00D4FF] px-5 py-2 text-xs font-bold text-black hover:bg-[#3ae0ff] disabled:opacity-50"
                >
                  {isPending ? "กำลังเพิ่ม..." : "เพิ่มเข้าทีม"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
