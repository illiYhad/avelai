import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { promptPayQrSvg } from "@/lib/payments/qr-svg";
import { TOURNAMENT_COLS, leaderTeams, tournamentPromptPay, type TournamentRow } from "@/lib/tournament/access";
import { REG_LABEL, STATUS_LABEL, type RegistrationStatus, type TournamentStatus } from "@/lib/tournament/state";
import { ActionButton } from "@/components/tournaments/ui";
import { checkInAction, registerTeamAction, uploadSlipAction } from "./actions";
import { RegisterForm, SlipForm } from "./RegisterClient";
import { routes } from "@/lib/routes";
import { gameFromSlug, slugOf } from "@/lib/games";

// K-AV-3: หน้าสมัคร/ชำระ/เช็กอิน ของหัวหน้าทีม — ต้องล็อกอิน (protected-paths + requireUser)
export const dynamic = "force-dynamic";

type Reg = { id: string; team_id: string; status: string; paid_via: string | null; teams: { name: string; tag: string } | { name: string; tag: string }[] | null };
type Pay = { id: string; registration_id: string; status: string; reject_reason: string | null; created_at: string };

export default async function RegisterPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const { db, user } = await requireUser(routes.tournamentRegister(slug, id));
  const { data: tRaw } = await db.from("tournaments").select(TOURNAMENT_COLS).eq("id", id).maybeSingle();
  const t = tRaw as TournamentRow | null;
  if (!t) notFound();
  const teams = await leaderTeams(db, user.id, t.game);
  const teamIds = teams.map((x) => x.id);
  const { data: regsRaw } = teamIds.length ? await db.from("registrations").select("id, team_id, status, paid_via, teams(name, tag)").eq("tournament_id", id).in("team_id", teamIds) : { data: [] };
  const regs = (regsRaw ?? []) as Reg[];
  const regIds = regs.map((r) => r.id);
  const { data: paysRaw } = regIds.length ? await db.from("payments").select("id, registration_id, status, reject_reason, created_at").in("registration_id", regIds).order("created_at", { ascending: false }) : { data: [] };
  const pays = (paysRaw ?? []) as Pay[];
  const unregistered = teams.filter((x) => !regs.some((r) => r.team_id === x.id));
  const amount = Number(t.entry_fee_thb);
  // PromptPay ของผู้จัดอ่านได้เฉพาะเมื่อทีมของเราสมัครแล้ว (RLS ตาราง tournament_promptpay)
  const promptpay = t.entry_type === "PAID" && regs.length ? await tournamentPromptPay(db, id) : null;
  const payload = promptpay ? buildPromptPayPayload(promptpay, amount) : null;
  const qr = payload ? await promptPayQrSvg(payload) : null;
  const status = t.status as TournamentStatus;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs tracking-widest text-cyan">{STATUS_LABEL[status] ?? t.status}</p>
        <h1 className="text-2xl font-bold text-white">{t.name}</h1>
        <Link href={routes.tournament(slug, id)} className="text-xs text-white/60 underline">รายละเอียดทัวร์</Link>
      </div>

      {regs.map((r) => {
        const team = Array.isArray(r.teams) ? r.teams[0] : r.teams;
        const myPays = pays.filter((p) => p.registration_id === r.id);
        const latest = myPays[0];
        const verified = myPays.find((p) => p.status === "VERIFIED");
        return (
          <section key={r.id} className="flex flex-col gap-3 rounded border border-white/15 p-4">
            <p className="text-sm"><b>{team?.name} [{team?.tag}]</b> · <span className="text-cyan">{REG_LABEL[r.status as RegistrationStatus] ?? r.status}</span></p>
            {r.status === "PENDING_PAYMENT" && t.entry_type === "PAID" ? (
              <>
                {latest?.status === "PENDING" ? <p className="text-sm text-white/70">ส่งสลิปแล้ว รอผู้จัดยืนยัน</p> : null}
                {latest?.status === "REJECTED" ? <p className="text-sm text-red-300">สลิปล่าสุดถูกปฏิเสธ: {latest.reject_reason} — ส่งใหม่ได้</p> : null}
                {latest?.status !== "PENDING" ? (
                  <>
                    <p className="text-sm text-white/80">โอน <b className="font-numeric">{amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</b> ไป PromptPay ของผู้จัด <span className="font-numeric">{promptpay ?? "–"}</span> (เงินไม่ผ่านระบบ AVELAi)</p>
                    {qr ? <div className="w-60 rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} /> : <p className="text-sm text-red-300">สร้าง QR ไม่ได้ — PromptPay ID ของผู้จัดไม่ถูกต้อง ติดต่อผู้จัด</p>}
                    <SlipForm action={uploadSlipAction.bind(null, id)} registrationId={r.id} token={crypto.randomUUID()} />
                  </>
                ) : null}
              </>
            ) : null}
            {verified ? <Link href={routes.tournamentReceipt(slug, id, verified.id)} className="text-sm text-cyan underline">ใบยืนยันการชำระ</Link> : null}
            {status === "CHECK_IN" && r.status === "CONFIRMED" ? <ActionButton action={checkInAction.bind(null, id, r.id)} label="เช็กอิน" className="w-fit rounded btn-primary px-4 py-2 text-sm" /> : null}
          </section>
        );
      })}

      {status === "REGISTRATION" ? (
        unregistered.length ? <section className="rounded border border-white/15 p-4"><RegisterForm action={registerTeamAction.bind(null, id)} teams={unregistered} /></section>
        : teams.length === 0 ? <p className="text-sm text-white/60">คุณยังไม่ได้เป็นหัวหน้าทีมที่เล่นเกมนี้ — <Link href={routes.teams(slug)} className="underline">ไปหน้าทีม</Link></p>
        : null
      ) : regs.length === 0 ? <p className="text-sm text-white/60">ทัวร์นี้ไม่ได้เปิดรับสมัครอยู่</p> : null}
    </main>
  );
}
