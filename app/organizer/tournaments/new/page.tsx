import { requireUser } from "@/lib/auth/roles";
import { platformRoles } from "@/lib/tournament/access";
import { createTournamentAction } from "../actions";
import { TournamentForm } from "../TournamentForm";

// K-AV-3: สร้างทัวร์ — เฉพาะ ORGANIZER/ADMIN (ตรวจซ้ำใน action + RLS)
export const metadata = { title: "สร้างทัวร์ — AVELAi" };
export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  const { db, user } = await requireUser("/organizer/tournaments/new");
  const roles = await platformRoles(db, user.id);
  const allowed = roles.includes("ORGANIZER") || roles.includes("ADMIN");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-2xl tracking-[0.15em] text-gold">สร้างทัวร์</h1>
      {allowed ? <TournamentForm action={createTournamentAction} submitLabel="สร้างทัวร์ (ร่าง)" /> : <p className="text-sm text-white/60">เฉพาะผู้จัด (ORGANIZER) เท่านั้น — ขอสิทธิ์จากแอดมิน</p>}
    </main>
  );
}
