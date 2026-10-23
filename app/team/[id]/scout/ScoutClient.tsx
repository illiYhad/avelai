"use client";

// UI สเกาต์: รายชื่อจับตา + ฟอร์มเพิ่ม + ปุ่มดึงข้อมูล Liquipedia
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProspectAction, deleteProspectAction, fetchLiquipediaAction } from "./actions";

export interface ProspectView {
  id: string;
  nickname: string;
  position: string | null;
  current_team: string | null;
  liquipedia_url: string | null;
  notes: string | null;
  stars: number;
  liquipedia_cache: { title?: string; extract?: string | null; fullurl?: string | null; found?: boolean } | null;
  liquipedia_fetched_at: string | null;
}

interface Props {
  teamId: string;
  isLeader: boolean;
  privateBeta: boolean;
  prospects: ProspectView[];
}

export function ScoutClient({ teamId, isLeader, privateBeta, prospects }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const res = await addProspectAction(teamId, formData);
      if ("error" in res) setError(res.error.message);
      else {
        form.reset();
        router.refresh();
      }
    });
  }

  const inputCls =
    "rounded border border-white/15 bg-[#0A0A0F] px-2 py-1.5 text-xs text-white focus:border-[#00D4FF] focus:outline-none";

  return (
    <div className="flex flex-col gap-6">
      {isLeader && (
        <form onSubmit={onAdd} className="rounded-lg border border-white/10 bg-[#12121A] p-4 flex flex-col gap-2">
          <p className="font-mono text-xs font-bold tracking-wider text-[#00D4FF] uppercase">เพิ่มผู้เล่นที่จับตา</p>
          <div className="flex flex-wrap gap-2">
            <input name="nickname" required placeholder="ชื่อในเกม *" className={`${inputCls} flex-1 min-w-32`} />
            <select name="position" className={inputCls} defaultValue="">
              <option value="">ตำแหน่ง —</option>
              <option value="EXP">EXP</option>
              <option value="JUNGLE">JUNGLE</option>
              <option value="MID">MID</option>
              <option value="GOLD">GOLD</option>
              <option value="ROAM">ROAM</option>
            </select>
            <input name="currentTeam" placeholder="ทีมปัจจุบัน" className={`${inputCls} w-32`} />
            <select name="stars" className={inputCls} defaultValue="3">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{"★".repeat(n) || "0 ดาว"}</option>
              ))}
            </select>
          </div>
          <input name="liquipediaUrl" placeholder="ลิงก์ Liquipedia (https://liquipedia.net/...)" className={inputCls} />
          <div className="flex flex-wrap items-center gap-2">
            <input name="notes" placeholder="โน้ต" className={`${inputCls} flex-1 min-w-40`} />
            <button type="submit" disabled={isPending} className="rounded bg-[#00D4FF] px-4 py-1.5 text-xs font-bold text-black disabled:opacity-50">
              {isPending ? "..." : "+ เพิ่ม"}
            </button>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </form>
      )}

      {!privateBeta && (
        <p className="rounded border border-[#C9A84C]/40 bg-[#C9A84C]/5 px-3 py-2 text-xs text-[#C9A84C]">
          ปุ่ม &quot;ดึงข้อมูลจาก Liquipedia&quot; เปิดเฉพาะทีมที่อยู่ใน Private Beta
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {prospects.map((p) => (
          <li key={p.id} className="rounded-lg border border-white/10 bg-[#12121A] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {p.nickname}
                  {p.position && <span className="ml-2 rounded bg-[#00D4FF]/10 px-1.5 py-0.5 text-[10px] font-mono text-[#00D4FF]">{p.position}</span>}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {p.current_team ? `ทีม: ${p.current_team}` : "ไม่มีทีม/ไม่ทราบ"} · <span className="text-[#C9A84C]">{"★".repeat(p.stars)}</span>
                </p>
                {p.notes && <p className="text-xs text-neutral-400 mt-1">{p.notes}</p>}
                {p.liquipedia_url && (
                  <a href={p.liquipedia_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00D4FF] underline">
                    หน้า Liquipedia
                  </a>
                )}
              </div>
              {isLeader && (
                <div className="flex gap-2 shrink-0">
                  {privateBeta && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await fetchLiquipediaAction(teamId, p.id);
                          setRowMessage((m) => ({ ...m, [p.id]: "error" in res ? res.error.message : "ดึงข้อมูลแล้ว" }));
                          if (!("error" in res)) router.refresh();
                        })
                      }
                      className="rounded border border-[#00D4FF]/60 px-3 py-1 text-[10px] font-bold text-[#00D4FF] hover:bg-[#00D4FF]/10 disabled:opacity-50"
                    >
                      ⟳ ดึงข้อมูลจาก Liquipedia
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(async () => { await deleteProspectAction(teamId, p.id); router.refresh(); })}
                    className="text-neutral-500 hover:text-rose-400 text-xs"
                    aria-label="ลบ"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {rowMessage[p.id] && <p className="mt-2 text-xs text-neutral-300">{rowMessage[p.id]}</p>}

            {p.liquipedia_cache?.found && (
              <div className="mt-3 rounded border border-white/10 bg-[#0A0A0F] p-3 text-xs">
                <p className="font-mono text-[10px] text-neutral-500 uppercase mb-1">
                  Liquipedia · ดึงเมื่อ {p.liquipedia_fetched_at ? new Date(p.liquipedia_fetched_at).toLocaleString("th-TH") : "-"}
                </p>
                <p className="text-neutral-300 whitespace-pre-wrap">{p.liquipedia_cache.extract}</p>
              </div>
            )}
          </li>
        ))}
        {prospects.length === 0 && <li className="text-sm text-neutral-500">ยังไม่มีผู้เล่นที่จับตา</li>}
      </ul>
    </div>
  );
}
