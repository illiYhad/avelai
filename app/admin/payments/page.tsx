/* eslint-disable @next/next/no-img-element */
import { requireAdmin } from "@/lib/auth/roles";
import { gameLabel } from "@/lib/games";
import { reviewPassPaymentAction } from "./actions";
import { PassReview } from "./AdminPaymentsClient";

// K-AV-3: ADMIN ตรวจสลิป Weekly Pass ที่รออยู่ (signed URL ≤ 10 นาที)
export const metadata = { title: "ตรวจสลิป Pass — AVELAi" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const { db, user } = await requireAdmin("/admin/payments");
  const { data: pays } = await db.from("payments").select("id, pass_game, amount_thb, slip_path, created_at, payer_user_id, users!payer_user_id(username)").eq("kind", "PASS").eq("status", "PENDING").order("created_at").limit(50);
  const rows = await Promise.all((pays ?? []).map(async (p) => {
    const { data } = await db.storage.from("payment-slips").createSignedUrl(p.slip_path, 600);
    const u = (Array.isArray(p.users) ? p.users[0] : p.users) as { username: string } | null;
    return { ...p, url: data?.signedUrl ?? null, username: u?.username ?? p.payer_user_id };
  }));
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-2xl tracking-[0.15em] text-gold">ตรวจสลิป Weekly Pass (ADMIN)</h1>
      {rows.length === 0 ? <p className="text-sm text-white/60">ไม่มีสลิปที่รอตรวจ</p> : rows.map((p) => (
        <section key={p.id} className="flex flex-col gap-2 rounded border border-white/15 p-4 text-sm">
          <p><b>{p.username}</b> · {gameLabel(p.pass_game)} · <span className="font-numeric">{Number(p.amount_thb).toLocaleString("th-TH")} บาท</span> · {new Date(p.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="w-fit"><img src={p.url} alt="สลิป" className="max-h-64 rounded border border-white/10" /></a> : <p className="text-xs text-red-300">เปิดสลิปไม่ได้</p>}
          {p.payer_user_id === user.id ? <p className="text-xs text-white/60">สลิปของคุณเอง — ให้แอดมินคนอื่นตรวจ</p> : <PassReview review={reviewPassPaymentAction.bind(null, p.id)} />}
        </section>
      ))}
    </main>
  );
}
