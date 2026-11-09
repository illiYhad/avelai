import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerDb } from "@/lib/db/server";
import { gameLabel, gameFromSlug, slugOf } from "@/lib/games";
import { ENTRY_LABEL, FORMAT_LABEL, type EntryType, type TournamentFormat, type TournamentStatus } from "@/lib/tournament/state";
import Link from "next/link";
import { bracketHrefOf, primaryCta } from "@/lib/tournament/detail/cta";
import { buildTimeline } from "@/lib/tournament/detail/timeline";
import { serverNowMs } from "@/lib/tournament/detail/countdown";
import { CONFIRMED_STATUSES, REGISTERED_EXCLUDE, TEAM_LOGO_LIMIT, toTeamChips } from "@/lib/tournament/detail/teams";
import TournamentHero from "@/components/tournament/detail/TournamentHero";
import Timeline from "@/components/tournament/detail/Timeline";
import TeamsPanel from "@/components/tournament/detail/TeamsPanel";
import DetailTabs from "@/components/tournament/detail/DetailTabs";
import FirstVisitTour from "@/components/tournament/detail/FirstVisitTour";

// K-AV-3: รายละเอียดทัวร์ (สาธารณะ) — ไม่แสดง promptpay_id ของผู้จัดที่นี่ (เห็นเฉพาะหน้าสมัครของหัวหน้าทีม)
// K-AV-UX2A Phase B: ปรับชั้นแสดงผล + generateMetadata (OG) · query/ลอจิกเดิม
// K-AV-TOUR.1: หัวทัวร์+นาฬิกา+ปุ่มเดียว · Timeline · กล่องจำนวน · แท็บ 6 · ทัวร์สอนใช้ — query tournaments เดิม · +2 คำขออ่านอย่างเดียว (สมัครแล้ว · รายชื่อทีม) · ไม่แก้ RLS
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
  const [{ data: auth }, { count }, { count: registeredCount }, { data: teamRows }] = await Promise.all([
    db.auth.getUser(),
    db.from("registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id).in("status", [...CONFIRMED_STATUSES]),
    // K-AV-TOUR.1 คำขอใหม่ 1/2: สมัครแล้ว = ทุกสถานะยกเว้น WITHDRAWN (RLS เดิม · คนนอกทีมเห็น 0)
    db.from("registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id).neq("status", REGISTERED_EXCLUDE),
    // K-AV-TOUR.1 คำขอใหม่ 2/2: ชื่อ/ตัวย่อ/โลโก้ทีมเฉพาะแถวที่ RLS เดิมให้อ่าน · สูงสุด 8
    db.from("registrations").select("status, teams(name, tag, logo_url)").eq("tournament_id", id).neq("status", REGISTERED_EXCLUDE).order("created_at", { ascending: true }).limit(TEAM_LOGO_LIMIT),
  ]);
  const status = t.status as TournamentStatus;
  const loggedIn = Boolean(auth.user);
  const serverNow = serverNowMs();
  const cta = primaryCta({ status, format: t.format, loggedIn, slug, id });
  const bracketHref = bracketHrefOf(t.format, slug, id);
  const hasBracket = status === "RUNNING" || status === "COMPLETED" || status === "SEEDING";
  const teams = toTeamChips(teamRows);
  const teamsProps = { registered: registeredCount ?? 0, confirmed: count ?? 0, maxTeams: t.max_teams ?? null, teams, loggedIn };
  const empty = (text: string) => <p className="py-6 text-center text-sm text-ink-muted">{text}</p>;

  const overview = (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-base">
        <dt className="text-ink-muted">รูปแบบ</dt><dd>{FORMAT_LABEL[t.format as TournamentFormat] ?? t.format} · Best of {t.best_of}</dd>
        <dt className="text-ink-muted">วันแข่ง</dt><dd>{thai(t.start_at)}</dd>
        <dt className="text-ink-muted">รับสมัคร</dt><dd>{thai(t.reg_open_at)} – {thai(t.reg_close_at)}</dd>
        <dt className="text-ink-muted">เช็กอิน</dt><dd>ก่อนเริ่ม {t.check_in_minutes} นาที</dd>
        <dt className="text-ink-muted">ค่าสมัคร</dt><dd className="text-gold">{t.entry_type === "PAID" ? `${Number(t.entry_fee_thb).toLocaleString("th-TH")} บาท` : ENTRY_LABEL[t.entry_type as EntryType] ?? t.entry_type}</dd>
        {t.entry_type === "PAID" ? (<><dt className="text-ink-muted">การชำระ</dt><dd>โอนตรงถึงผู้จัด</dd></>) : null}
      </dl>
      {t.rules ? <section><h2 className="mb-2 font-mono text-sm tracking-[0.2em] text-ink-muted">{"// กติกา"}</h2><p className="whitespace-pre-wrap text-base text-ink">{t.rules}</p></section> : null}
    </div>
  );
  const linkBox = (text: string, label: string) => (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-sm text-ink-muted">{text}</p>
      <Link href={bracketHref} className="btn-ghost flex min-h-11 items-center rounded px-4 text-sm">{label}</Link>
    </div>
  );
  const freeAgents = (
    <div data-free-agents className="flex flex-col items-center gap-2 py-8 text-center">
      <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-cyan/50 text-xl text-cyan">＋</span>
      <p className="font-display text-base tracking-[0.06em] text-ink">ผู้เล่นเดี่ยวหาทีม</p>
      <p className="text-sm text-ink-muted">เร็ว ๆ นี้</p>
    </div>
  );
  const tabs = [
    { key: "overview", label: "ภาพรวม", content: overview },
    { key: "bracket", label: "สาย", content: hasBracket ? linkBox("สายการแข่งของทัวร์นี้", t.format === "SWISS" ? "ตาราง Swiss" : "ดูสาย") : empty("ยังไม่มีสาย") },
    { key: "matches", label: "แมตช์", content: hasBracket ? linkBox("ดูแมตช์ทั้งหมดได้จากสาย", "ดูแมตช์ในสาย") : empty("ยังไม่มีแมตช์") },
    { key: "teams", label: "ทีม", content: <TeamsPanel {...teamsProps} variant="list" /> },
    { key: "free-agents", label: "Free agents", content: freeAgents },
    { key: "results", label: "ผล", content: status === "COMPLETED" ? linkBox("ทัวร์จบแล้ว ดูผลในสาย", "ดูผล") : empty("ยังไม่มีผล") },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <TournamentHero
        slug={slug}
        name={t.name}
        status={status}
        format={t.format}
        bestOf={t.best_of}
        teamSize={t.team_size}
        startAt={t.start_at}
        serverNow={serverNow}
        organizer={null}
        cta={cta}
      />
      <Timeline points={buildTimeline(t, serverNow)} />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 lg:order-1">
          <DetailTabs tabs={tabs} />
        </div>
        <aside className="min-w-0 max-lg:-order-1 lg:order-2">
          <TeamsPanel {...teamsProps} variant="summary" />
        </aside>
      </div>
      <FirstVisitTour hasCta={Boolean(cta)} />
    </main>
  );
}
