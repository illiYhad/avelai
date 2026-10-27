import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerDb } from "@/lib/db/server";
import { gameLabel, gameFromSlug, slugOf } from "@/lib/games";
import { ENTRY_LABEL, FORMAT_LABEL, type EntryType, type TournamentFormat, type TournamentStatus } from "@/lib/tournament/state";
import { routes } from "@/lib/routes";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import StatusBadge from "@/components/ui/StatusBadge";
import Stat from "@/components/ui/Stat";
import GameTag from "@/components/ui/GameTag";
import { tournamentBadge } from "@/lib/tournament/badge";

// K-AV-3: รายละเอียดทัวร์ (สาธารณะ) — ไม่แสดง promptpay_id ของผู้จัดที่นี่ (เห็นเฉพาะหน้าสมัครของหัวหน้าทีม)
// K-AV-UX2A Phase B: ปรับชั้นแสดงผล + generateMetadata (OG) · query/ลอจิกเดิม
export const dynamic = "force-dynamic";

const thai = (iso: string | null) => (iso ? new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "–");

// OG สำหรับแชร์ใน Discord — อ่านเฉพาะข้อมูลสาธารณะ (ชื่อ · เกม · วันปิดรับ · จำนวนทีม · รูปแบบ) ไม่มี promptpay/ผู้สมัคร
export async function generateMetadata({ params }: { params: Promise<{ game: string; id: string }> }): Promise<Metadata> {
  const { game, id } = await params;
  const code = gameFromSlug(game);
  if (!code) return {};
  try {
    const db = await getServerDb();
    if (!db) return {};
    const { data: t } = await db.from("tournaments").select("name, game, format, team_size, best_of, reg_close_at, max_teams").eq("id", id).maybeSingle();
    if (!t || t.game !== code) return {};
    const { count } = await db.from("registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id).in("status", ["CONFIRMED", "CHECKED_IN"]);
    const title = `${t.name} · ${gameLabel(t.game)} ${t.team_size}v${t.team_size}`;
    const description = `${t.reg_close_at ? `เปิดรับสมัครถึง ${thai(t.reg_close_at)} · ` : ""}${count ?? 0}${t.max_teams ? `/${t.max_teams}` : ""} ทีม · ${t.format} BO${t.best_of}`;
    return { title: `${t.name} — AVELAi`, description, openGraph: { title, description, siteName: "AVELAi", locale: "th_TH", images: ["/og/avelai-default.png"] } };
  } catch {
    return {};
  }
}

export default async function TournamentDetailPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const db = await getServerDb();
  if (!db) return <main className="px-6 py-10 text-base text-ink-muted">ยังไม่ต่อฐานข้อมูล</main>;
  const { data: t } = await db.from("tournaments").select("id, name, game, format, team_size, best_of, status, reg_open_at, reg_close_at, check_in_minutes, start_at, max_teams, entry_type, entry_fee_thb, rules").eq("id", id).maybeSingle();
  if (!t || t.game !== code) notFound(); // K-AV-UX2B: id ของอีกเกม = 404
  const [{ data: auth }, { count }] = await Promise.all([
    db.auth.getUser(),
    db.from("registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id).in("status", ["CONFIRMED", "CHECKED_IN"]),
  ]);
  const status = t.status as TournamentStatus;
  const canRegister = status === "REGISTRATION" || status === "CHECK_IN";
  const bracketHref = t.format === "SWISS" ? routes.tournamentSwiss(slug, id) : routes.tournamentBracket(slug, id);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 pb-28 sm:px-6 sm:pb-8">
      <PageHeader
        eyebrow={`// ${t.format} BO${t.best_of}`}
        title={t.name}
        subtitle={<span className="flex flex-wrap items-center gap-2"><GameTag game={slug} /><StatusBadge status={tournamentBadge(status)} /></span>}
      />
      <Surface glow="cyan" className="grid grid-cols-3 gap-4">
        <Stat label="// ทีม" value={<>{count ?? 0}{t.max_teams ? <span className="text-base text-ink-muted">/{t.max_teams}</span> : null}</>} tone="cyan" />
        <Stat label="// วันแข่ง" value={<span className="text-base">{thai(t.start_at)}</span>} />
        <Stat label="// ค่าสมัคร" value={<span className="text-base">{t.entry_type === "PAID" ? `${Number(t.entry_fee_thb).toLocaleString("th-TH")} บาท` : ENTRY_LABEL[t.entry_type as EntryType] ?? t.entry_type}</span>} tone="gold" />
      </Surface>
      <Surface>
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-base">
          <dt className="text-ink-muted">รูปแบบ</dt><dd>{FORMAT_LABEL[t.format as TournamentFormat] ?? t.format} · Best of {t.best_of}</dd>
          <dt className="text-ink-muted">รับสมัคร</dt><dd>{thai(t.reg_open_at)} – {thai(t.reg_close_at)}</dd>
          <dt className="text-ink-muted">เช็กอิน</dt><dd>ก่อนเริ่ม {t.check_in_minutes} นาที</dd>
          {t.entry_type === "PAID" ? (<><dt className="text-ink-muted">การชำระ</dt><dd>โอนตรงถึงผู้จัด</dd></>) : null}
        </dl>
      </Surface>
      {t.rules ? <section><h2 className="mb-2 font-mono text-sm tracking-[0.2em] text-ink-muted">{"// กติกา"}</h2><p className="whitespace-pre-wrap text-base text-ink">{t.rules}</p></section> : null}
      <div className="flex flex-wrap gap-3">
        {status === "RUNNING" || status === "COMPLETED" || status === "SEEDING" ? <Link href={bracketHref} className="btn-ghost flex min-h-11 items-center rounded px-4 text-sm">{t.format === "SWISS" ? "ตาราง Swiss" : "ดูสาย"}</Link> : null}
        <Link href={routes.tournaments(slug)} className="btn-ghost flex min-h-11 items-center rounded px-4 text-sm">กลับรายการ</Link>
      </div>
      {canRegister ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-void/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <Link href={routes.tournamentRegister(slug, id)} className="btn-primary flex h-12 w-full items-center justify-center rounded px-6 font-display tracking-[0.08em] sm:w-fit">
            {auth.user ? (status === "CHECK_IN" ? "เช็กอิน / ดูใบสมัคร" : "สมัครทีม") : "เข้าสู่ระบบเพื่อสมัคร"}
          </Link>
        </div>
      ) : null}
    </main>
  );
}
