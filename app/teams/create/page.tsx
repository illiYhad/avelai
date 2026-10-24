"use client";

// ยกจาก Zodiac app/team/create/page.tsx (ย่อฟอร์ม · โลโก้รับเป็น URL แทนอัปโหลดไฟล์)
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTeamAction } from "@/app/teams/actions";

export default function CreateTeamPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTeamAction(formData);
      if ("error" in res) {
        setError(res.error.message);
      } else {
        router.push(`/teams/${res.teamId}`);
      }
    });
  }

  const inputCls =
    "w-full rounded border border-white/15 bg-[#12121A] px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#00D4FF] focus:outline-none";

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-2">TEAM MANAGEMENT</p>
        <h1 className="text-2xl font-bold mb-6">สร้างทีมใหม่ (MLBB)</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="text-sm text-neutral-300">
            ชื่อทีม *
            <input name="name" required minLength={2} maxLength={50} className={`mt-1 ${inputCls}`} placeholder="เช่น Underdog Esports" />
          </label>
          <label className="text-sm text-neutral-300">
            แท็กทีม (2-6 ตัวอักษร) *
            <input name="tag" required minLength={2} maxLength={6} className={`mt-1 ${inputCls} uppercase`} placeholder="เช่น UDG" />
          </label>
          <label className="text-sm text-neutral-300">
            คำอธิบายทีม
            <textarea name="description" rows={3} maxLength={300} className={`mt-1 ${inputCls}`} placeholder="แนะนำทีมสั้น ๆ" />
          </label>
          <label className="text-sm text-neutral-300">
            ลิงก์โลโก้ (https://...)
            <input name="logoUrl" type="url" className={`mt-1 ${inputCls}`} placeholder="https://..." />
          </label>

          {error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 rounded bg-[#00D4FF] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#3ae0ff] disabled:opacity-50"
          >
            {isPending ? "กำลังสร้างทีม..." : "สร้างทีม"}
          </button>
        </form>
      </div>
    </main>
  );
}
