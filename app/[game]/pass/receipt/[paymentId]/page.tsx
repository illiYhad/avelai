import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { gameLabel } from "@/lib/games";
import { Receipt } from "@/components/payments/Receipt";
import { routes } from "@/lib/routes";
import { gameFromSlug, slugOf } from "@/lib/games";

// K-AV-3: ใบยืนยันการชำระ Weekly Pass — เฉพาะ VERIFIED · RLS: ผู้จ่าย/ADMIN
export const dynamic = "force-dynamic";

export default async function PassReceiptPage({ params }: { params: Promise<{ game: string; paymentId: string }> }) {
  const { game, paymentId } = await params;
  const code = gameFromSlug(game);
  if (!code) notFound();
  const slug = slugOf(code);
  const { db } = await requireUser(routes.passReceipt(slug, paymentId));
  const { data: p } = await db.from("payments").select("id, status, amount_thb, verified_at, pass_game, users:public_profiles_v!payer_user_id(username)").eq("id", paymentId).eq("kind", "PASS").eq("status", "VERIFIED").maybeSingle();
  if (!p) notFound();
  const payer = (Array.isArray(p.users) ? p.users[0] : p.users) as { username: string } | null;
  return <Receipt r={{ paymentId: p.id, kind: "PASS", amountThb: Number(p.amount_thb), verifiedAt: p.verified_at, payerUsername: payer?.username ?? "–", description: `Weekly Pass (${gameLabel(p.pass_game)})`, payee: "Balehm Tech Studio" }} />;
}
