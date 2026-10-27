import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { TOURNAMENT_COLS, tournamentStaffLevel, type TournamentRow } from "@/lib/tournament/access";
import { obsUrls } from "@/lib/obs/urls";
import { parseTheme } from "@/lib/obs/validate";
import { addSponsorAction, deleteSponsorAction, moveSponsorAction, setObsThemeAction, updateSponsorAction } from "./actions";
import { SPONSOR_COLS, type SponsorRow } from "./types";
import { ObsUrlList, SponsorsManager, ThemePicker } from "./SponsorsClient";
import { routes } from "@/lib/routes";
import { gameFromSlug, slugOf } from "@/lib/games";

// K-AV-8: หน้าผู้จัด — สปอนเซอร์ (เพิ่ม/แก้/ลบ/เรียง) · ธีม OBS · URL สำหรับใส่ OBS Browser Source
// หน้าย่อยแยกจาก /organizer/tournaments/[id] (ไม่แก้หน้าของ T3) · ต้องล็อกอิน (regex /organizer ใน protected-paths ครอบอยู่แล้ว)
export const dynamic = "force-dynamic";

export default async function SponsorsPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const { db, user } = await requireUser(routes.organizerSponsors(slug, id));
  const { data: tRaw } = await db.from("tournaments").select(`${TOURNAMENT_COLS}, obs_theme`).eq("id", id).maybeSingle();
  const t = tRaw as (TournamentRow & { obs_theme: unknown }) | null;
  if (!t) notFound();
  const level = await tournamentStaffLevel(db, user.id, t);
  if (level === "NONE") notFound();
  const canEdit = level === "ORGANIZER";
  const { data: rows } = await db.from("sponsors").select(SPONSOR_COLS).eq("tournament_id", id).order("sort_order").order("created_at");
  const sponsors = (rows ?? []) as SponsorRow[];
  const theme = parseTheme(t.obs_theme);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const base = host ? `${proto}://${host}` : null;
  const urls = obsUrls(base, id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <p className="text-xs tracking-widest text-cyan">จอ OBS + สปอนเซอร์ · {canEdit ? "ผู้จัด" : "staff (ดูอย่างเดียว)"}</p>
        <h1 className="text-2xl font-bold text-white">{t.name}</h1>
        <Link href={routes.organizerTournament(slug, id)} className="text-xs text-white/60 underline">กลับหน้าจัดการ</Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/90">URL สำหรับ OBS Browser Source (สาธารณะ · ไม่ต้องล็อกอิน · อัปเดตทุก 5 วินาที)</h2>
        <p className="text-xs text-white/50">แนะนำขนาด 1920×1080 · พื้นหลังโปร่งใส · เติม <code>?theme=DARK|TRANSPARENT|GOLD|CYAN</code> ท้าย URL เพื่อลองธีมโดยไม่บันทึก{t.status === "DRAFT" ? " · ⚠ ทัวร์ยังเป็นร่าง — จอจะแสดง 404 จนกว่าจะเปิดรับสมัคร" : ""}</p>
        <ObsUrlList urls={urls} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/90">ธีมจอ OBS (ปัจจุบัน: {theme})</h2>
        <ThemePicker current={theme} setTheme={setObsThemeAction.bind(null, id)} canEdit={canEdit} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/90">สปอนเซอร์ ({sponsors.length}/30)</h2>
        <SponsorsManager
          sponsors={sponsors}
          canEdit={canEdit}
          actions={{
            add: addSponsorAction.bind(null, id),
            update: updateSponsorAction.bind(null, id),
            remove: deleteSponsorAction.bind(null, id),
            move: moveSponsorAction.bind(null, id),
          }}
        />
      </section>
    </main>
  );
}
