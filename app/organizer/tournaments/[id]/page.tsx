/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { gameLabel } from "@/lib/games";
import { TOURNAMENT_COLS, tournamentPromptPay, tournamentStaffLevel, type TournamentRow } from "@/lib/tournament/access";
import { REG_LABEL, STATUS_LABEL, isTournamentStatus, nextStatuses, type RegistrationStatus, type TournamentStatus } from "@/lib/tournament/state";
import { ActionButton } from "@/components/tournaments/ui";
import { addStaffAction, removeStaffAction, reviewRegistrationPaymentAction, setTournamentStatusAction, updateTournamentAction } from "../actions";
import { generateBracketAction, generateSwissRoundAction } from "../bracket-actions";
import { TournamentForm } from "../TournamentForm";
import { PaymentReview, StaffForm, StatusButtons } from "./ManageClient";

// K-AV-3: หน้าจัดการทัวร์ของผู้จัด/staff — ใบสมัคร · สลิป (signed URL ≤ 10 นาที สร้างฝั่ง server) · สถานะ · staff
export const dynamic = "force-dynamic";

type Reg = { id: string; status: string; paid_via: string | null; seed: number | null; teams: { name: string; tag: string } | { name: string; tag: string }[] | null };
type Pay = { id: string; registration_id: string; status: string; amount_thb: number | string; slip_path: string; reject_reason: string | null; created_at: string; payer_user_id: string };

export default async function ManageTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireUser(`/organizer/tournaments/${id}`);
  const { data: tRaw } = await db.from("tournaments").select(TOURNAMENT_COLS).eq("id", id).maybeSingle();
  const t = tRaw as TournamentRow | null;
  if (!t) notFound();
  const level = await tournamentStaffLevel(db, user.id, t);
  if (level === "NONE") notFound();
  const [{ data: regsRaw }, { data: staff }] = await Promise.all([
    db.from("registrations").select("id, status, paid_via, seed, teams(name, tag)").eq("tournament_id", id).order("created_at"),
    db.from("tournament_staff").select("user_id, role, users:public_profiles_v!user_id(username)").eq("tournament_id", id),
  ]);
  const regs = (regsRaw ?? []) as Reg[];
  const regIds = regs.map((r) => r.id);
  const { data: paysRaw } = regIds.length ? await db.from("payments").select("id, registration_id, status, amount_thb, slip_path, reject_reason, created_at, payer_user_id").in("registration_id", regIds).order("created_at", { ascending: false }) : { data: [] };
  const pays = (paysRaw ?? []) as Pay[];
  // K-AV-7: Karma ต่ำสุดของสมาชิกแต่ละทีม (จาก roster ที่ snapshot ตอนสมัคร · RPC karma_states)
  const { data: rosterRows } = regIds.length ? await db.from("tournament_rosters").select("registration_id, user_id").in("registration_id", regIds) : { data: [] };
  const rosterUserIds = [...new Set((rosterRows ?? []).map((r) => r.user_id as string))];
  const { data: karmaRows } = rosterUserIds.length ? await db.rpc("karma_states", { p_user_ids: rosterUserIds }) : { data: [] };
  const karmaOf = new Map(((karmaRows ?? []) as { user_id: string; score: number }[]).map((k) => [k.user_id, k.score]));
  const minKarma = new Map<string, number>();
  for (const r of rosterRows ?? []) {
    const s = karmaOf.get(r.user_id as string);
    if (s === undefined) continue;
    const cur = minKarma.get(r.registration_id as string);
    minKarma.set(r.registration_id as string, cur === undefined ? s : Math.min(cur, s));
  }
  const slipUrl = new Map<string, string>();
  for (const p of pays.filter((x) => x.status === "PENDING").slice(0, 50)) {
    const { data } = await db.storage.from("payment-slips").createSignedUrl(p.slip_path, 600);
    if (data?.signedUrl) slipUrl.set(p.id, data.signedUrl);
  }
  const status = t.status as TournamentStatus;
  const next = isTournamentStatus(status) ? [...nextStatuses(status)] : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <p className="text-xs tracking-widest text-cyan">{STATUS_LABEL[status] ?? t.status} · {gameLabel(t.game)} · {level === "ORGANIZER" ? "ผู้จัด" : "staff"}</p>
        <h1 className="text-2xl font-bold text-white">{t.name}</h1>
        <Link href={`/tournaments/${id}`} className="text-xs text-white/60 underline">ดูหน้าสาธารณะ</Link>
      </div>

      {level === "ORGANIZER" ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/90">สถานะ</h2>
          <StatusButtons next={next} setStatus={setTournamentStatusAction.bind(null, id)} />
        </section>
      ) : null}

      {status === "SEEDING" || status === "RUNNING" ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/90">สาย / รอบ (K-AV-4)</h2>
          <div className="flex flex-wrap items-center gap-3">
            {t.format === "SWISS"
              ? <ActionButton action={generateSwissRoundAction.bind(null, id)} label="สร้างรอบ Swiss ถัดไป" className="rounded bg-gold px-3 py-1.5 text-sm font-semibold text-void" />
              : status === "SEEDING" ? <ActionButton action={generateBracketAction.bind(null, id)} label={`สร้างสาย ${t.format}`} confirmText="สร้างสายจากทีมที่เช็กอินแล้ว — ทำครั้งเดียว ทัวร์จะเริ่มแข่งทันที" className="rounded bg-gold px-3 py-1.5 text-sm font-semibold text-void" /> : null}
            <Link href={t.format === "SWISS" ? `/tournaments/${id}/swiss` : `/tournaments/${id}/bracket`} className="text-sm text-cyan underline">ดูสาย/ตาราง</Link>
            <Link href={`/organizer/tournaments/${id}/matches`} className="text-sm text-cyan underline">แมตช์ / ชี้ขาดผล</Link>
            <Link href={`/organizer/tournaments/${id}/disputes`} className="text-sm text-cyan underline">ข้อพิพาท / โทษ</Link>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/90">ใบสมัคร ({regs.length})</h2>
        {regs.length === 0 ? <p className="text-sm text-white/60">ยังไม่มีทีมสมัคร</p> : regs.map((r) => {
          const team = Array.isArray(r.teams) ? r.teams[0] : r.teams;
          const myPays = pays.filter((p) => p.registration_id === r.id);
          return (
            <div key={r.id} className="rounded border border-white/15 p-3 text-sm">
              <p><b>{team?.name} [{team?.tag}]</b> · <span className="text-cyan">{REG_LABEL[r.status as RegistrationStatus] ?? r.status}</span>{r.paid_via ? ` · ${r.paid_via}` : ""}{r.seed ? ` · seed ${r.seed}` : ""}{minKarma.has(r.id) ? <> · Karma ต่ำสุด <span className={`font-numeric ${(minKarma.get(r.id) ?? 100) < 70 ? "text-amber-300" : "text-white/80"}`}>{minKarma.get(r.id)}</span></> : null}</p>
              {myPays.map((p) => (
                <div key={p.id} className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
                  <p className="text-xs text-white/70">สลิป <span className="font-numeric">{Number(p.amount_thb).toLocaleString("th-TH")} บาท</span> · {p.status}{p.reject_reason ? ` · ${p.reject_reason}` : ""} · {new Date(p.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
                  {p.status === "PENDING" ? (
                    <>
                      {slipUrl.get(p.id) ? <a href={slipUrl.get(p.id)} target="_blank" rel="noreferrer" className="w-fit"><img src={slipUrl.get(p.id)} alt="สลิป" className="max-h-64 rounded border border-white/10" /></a> : <p className="text-xs text-red-300">เปิดสลิปไม่ได้</p>}
                      {p.payer_user_id === user.id ? <p className="text-xs text-white/60">สลิปของคุณเอง — ให้ staff คนอื่นตรวจ</p> : <PaymentReview review={reviewRegistrationPaymentAction.bind(null, id, p.id)} />}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </section>

      {level === "ORGANIZER" ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-white/90">staff / ผู้ตัดสิน</h2>
            <ul className="text-sm">
              {(staff ?? []).map((s) => {
                const u = (Array.isArray(s.users) ? s.users[0] : s.users) as { username: string } | null;
                return <li key={s.user_id as string} className="flex items-center gap-3 py-1">{u?.username ?? s.user_id} · {s.role}<ActionButton action={removeStaffAction.bind(null, id, s.user_id as string)} label="เอาออก" className="text-xs text-white/60 underline" /></li>;
              })}
            </ul>
            <StaffForm action={addStaffAction.bind(null, id)} />
          </section>
          {status === "DRAFT" || status === "REGISTRATION" ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-white/90">แก้รายละเอียด</h2>
              <TournamentForm action={updateTournamentAction.bind(null, id)} values={{ ...t, promptpay_id: await tournamentPromptPay(db, id) }} submitLabel="บันทึก" />
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
