import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { Receipt } from "@/components/payments/Receipt";

// K-AV-3: ใบยืนยันการชำระค่าเข้า — เฉพาะ payment VERIFIED · RLS ให้เห็นเฉพาะผู้จ่าย/staff ทัวร์/ADMIN
export const dynamic = "force-dynamic";

export default async function RegistrationReceiptPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  const { db } = await requireUser(`/tournaments/${id}/receipt/${paymentId}`);
  const { data: p } = await db
    .from("payments")
    .select("id, kind, status, amount_thb, verified_at, payer_user_id, users!payer_user_id(username), registrations!inner(tournament_id, teams(name, tag), tournaments(name))")
    .eq("id", paymentId).eq("kind", "REGISTRATION").eq("status", "VERIFIED").maybeSingle();
  if (!p) notFound();
  const reg = (Array.isArray(p.registrations) ? p.registrations[0] : p.registrations) as { tournament_id: string; teams: { name: string; tag: string } | { name: string; tag: string }[] | null; tournaments: { name: string } | { name: string }[] | null };
  if (reg.tournament_id !== id) notFound();
  const team = Array.isArray(reg.teams) ? reg.teams[0] : reg.teams;
  const tour = Array.isArray(reg.tournaments) ? reg.tournaments[0] : reg.tournaments;
  const payer = (Array.isArray(p.users) ? p.users[0] : p.users) as { username: string } | null;
  return (
    <Receipt r={{
      paymentId: p.id, kind: "REGISTRATION", amountThb: Number(p.amount_thb), verifiedAt: p.verified_at,
      payerUsername: payer?.username ?? "–", description: `ค่าเข้าแข่ง ${tour?.name ?? ""} · ทีม ${team?.name ?? ""} [${team?.tag ?? ""}]`, payee: "ผู้จัดการแข่งขัน",
    }} />
  );
}
