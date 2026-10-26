import Link from "next/link";
import { getServerDb } from "@/lib/db/server";
import { gameLabel } from "@/lib/games";
import { ENTRY_LABEL, FORMAT_LABEL, STATUS_LABEL, type EntryType, type TournamentFormat, type TournamentStatus } from "@/lib/tournament/state";

// K-AV-3: รายการทัวร์ (สาธารณะ · RLS ให้เห็นเฉพาะที่ไม่ใช่ร่าง · ไม่แสดงข้อมูลส่วนตัว/PromptPay)
export const metadata = { title: "ทัวร์นาเมนต์ — AVELAi" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; game: string; format: string; status: string; entry_type: string; entry_fee_thb: number | string; start_at: string | null; team_size: number };

export default async function TournamentsPage() {
  const db = await getServerDb();
  const { data } = db ? await db.from("tournaments").select("id, name, game, format, status, entry_type, entry_fee_thb, start_at, team_size").neq("status", "DRAFT").order("start_at", { ascending: true, nullsFirst: false }).limit(100) : { data: [] };
  const rows = (data ?? []) as Row[];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-2xl tracking-[0.15em] text-gold">ทัวร์นาเมนต์</h1>
      {!db ? <p className="text-sm text-white/60">ยังไม่ต่อฐานข้อมูล</p> : rows.length === 0 ? <p className="text-sm text-white/60">ยังไม่มีทัวร์ที่เปิดอยู่</p> : (
        <ul className="divide-y divide-white/10 rounded border border-white/15">
          {rows.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <Link href={`/tournaments/${t.id}`} className="font-semibold text-white hover:underline">{t.name}</Link>
              <p className="text-xs text-white/60">
                {gameLabel(t.game)} · {FORMAT_LABEL[t.format as TournamentFormat] ?? t.format} · {t.team_size}v{t.team_size} · {ENTRY_LABEL[t.entry_type as EntryType] ?? t.entry_type}
                {t.entry_type === "PAID" ? ` ${Number(t.entry_fee_thb).toLocaleString("th-TH")} บาท` : ""} · <span className="text-cyan">{STATUS_LABEL[t.status as TournamentStatus] ?? t.status}</span>
                {t.start_at ? ` · ${new Date(t.start_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
