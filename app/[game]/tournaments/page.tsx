import Link from "next/link";
import { getServerDb } from "@/lib/db/server";
import { gameLabel, gameFromSlug, slugOf } from "@/lib/games";
import { ENTRY_LABEL, type EntryType } from "@/lib/tournament/state";
import { routes } from "@/lib/routes";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import GameTag from "@/components/ui/GameTag";
import { tournamentBadge } from "@/lib/tournament/badge";

// K-AV-3: รายการทัวร์ (สาธารณะ · RLS ให้เห็นเฉพาะที่ไม่ใช่ร่าง · ไม่แสดงข้อมูลส่วนตัว/PromptPay)
// K-AV-UX2A Phase B: ปรับชั้นแสดงผลเท่านั้น (ข้อมูลเพิ่มจากเดิม: best_of · max_teams · จำนวนทีมที่ยืนยัน — อ่านอย่างเดียว)
export const metadata = { title: "ทัวร์นาเมนต์ — AVELAi" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; game: string; format: string; best_of: number; max_teams: number | null; status: string; entry_type: string; entry_fee_thb: number | string; start_at: string | null; team_size: number };

export default async function TournamentsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const db = await getServerDb();
  const { data } = db ? await db.from("tournaments").select("id, name, game, format, best_of, max_teams, status, entry_type, entry_fee_thb, start_at, team_size").eq("game", code).neq("status", "DRAFT").order("start_at", { ascending: true, nullsFirst: false }).limit(100) : { data: [] };
  const rows = (data ?? []) as Row[];
  const { data: regs } = db && rows.length ? await db.from("registrations").select("tournament_id").in("tournament_id", rows.map((r) => r.id)).in("status", ["CONFIRMED", "CHECKED_IN"]) : { data: [] };
  const counts = new Map<string, number>();
  for (const r of (regs ?? []) as { tournament_id: string }[]) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader eyebrow="// TOURNAMENTS" title="ทัวร์นาเมนต์" subtitle={`รายการแข่งของ ${gameLabel(code)}`} aside={<GameTag game={slug} />} />
      {!db ? <p className="text-base text-ink-muted">ยังไม่ต่อฐานข้อมูล</p> : rows.length === 0 ? (
        <EmptyState message={`ยังไม่มีทัวร์ของ ${gameLabel(code)}`} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={routes.tournament(slug, t.id)} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-cyan">
                <Surface glow={t.status === "REGISTRATION" ? "gold" : "none"} className="transition-colors hover:border-cyan/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs tracking-[0.2em] text-cyan">{t.format} BO{t.best_of} · {t.team_size}v{t.team_size}</p>
                      <h2 className="mt-1 truncate text-lg font-bold text-ink">{t.name}</h2>
                    </div>
                    <StatusBadge status={tournamentBadge(t.status)} />
                  </div>
                  <hr className="my-3 border-line" />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
                    <span>
                      {t.start_at ? new Date(t.start_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "ยังไม่กำหนดวัน"}
                      {" · "}{ENTRY_LABEL[t.entry_type as EntryType] ?? t.entry_type}
                      {t.entry_type === "PAID" ? ` ${Number(t.entry_fee_thb).toLocaleString("th-TH")} บาท` : ""}
                    </span>
                    <span className="font-mono tabular-nums text-ink">{counts.get(t.id) ?? 0}/{t.max_teams ?? "–"} ทีม</span>
                  </div>
                </Surface>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
