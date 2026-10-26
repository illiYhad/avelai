import Link from "next/link";
import { requireUser } from "@/lib/auth/roles";
import { gameLabel } from "@/lib/games";
import { PASS_DAYS, PASS_PRICE_THB, weeklyPrizePool } from "@/lib/passes";
import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { promptPayQrSvg } from "@/lib/payments/qr-svg";
import { uploadPassSlipAction } from "./actions";
import { PassSlipForm } from "./PassClient";

// K-AV-3: ซื้อ Weekly Pass — QR PromptPay ของแพลตฟอร์มจาก env PLATFORM_PROMPTPAY_ID (ไม่มี = "ยังไม่เปิดขาย Pass")
export const metadata = { title: "Weekly Pass — AVELAi" };
export const dynamic = "force-dynamic";

const thai = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" });

export default async function PassPage() {
  const { db, user } = await requireUser("/pass");
  const since = new Date(new Date().getTime() - 7 * 86400000).toISOString(); // ยอด Pass ที่ยืนยันใน 7 วันล่าสุด
  const payload = buildPromptPayPayload(process.env.PLATFORM_PROMPTPAY_ID, PASS_PRICE_THB);
  const qr = payload ? await promptPayQrSvg(payload) : null;
  const [{ data: passes }, { data: pays }] = await Promise.all([
    db.from("passes").select("id, game, starts_at, ends_at, payment_id").eq("user_id", user.id).order("ends_at", { ascending: false }),
    db.from("payments").select("id, pass_game, status, reject_reason, created_at").eq("payer_user_id", user.id).eq("kind", "PASS").order("created_at", { ascending: false }).limit(5),
  ]);
  const { data: weekAmounts } = await db.from("payments").select("amount_thb").eq("kind", "PASS").eq("status", "VERIFIED").gte("verified_at", since);
  const pool = weeklyPrizePool((weekAmounts ?? []).map((p) => Number(p.amount_thb)));
  const pending = (pays ?? []).find((p) => p.status === "PENDING");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-2xl tracking-[0.15em] text-gold">WEEKLY PASS</h1>
      <p className="text-sm text-white/80">{PASS_PRICE_THB} บาท · ใช้สมัครทัวร์แบบ Weekly Pass ของเกมที่เลือกได้ {PASS_DAYS} วัน · เงินรางวัลรายสัปดาห์ (จากยอด Pass ที่ยืนยันแล้ว) ≈ <span className="font-numeric">{pool.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span> บาท</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/90">Pass ของฉัน</h2>
        {(passes ?? []).length === 0 ? <p className="text-sm text-white/60">ยังไม่มี</p> : (passes ?? []).map((p) => (
          <p key={p.id} className="text-sm">{gameLabel(p.game)} · {thai(p.starts_at)} – {thai(p.ends_at)} · <Link href={`/pass/receipt/${p.payment_id}`} className="text-cyan underline">ใบยืนยัน</Link></p>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded border border-white/15 p-4">
        <h2 className="text-sm font-semibold text-white/90">ซื้อ Pass</h2>
        {!qr ? <p className="text-sm text-white/60">ยังไม่เปิดขาย Pass</p> : pending ? <p className="text-sm text-white/70">ส่งสลิปแล้ว ({gameLabel(pending.pass_game)}) รอแอดมินยืนยัน</p> : (
          <>
            <p className="text-sm text-white/80">โอน <b className="font-numeric">{PASS_PRICE_THB}.00 บาท</b> ผ่าน QR นี้ (ผู้รับ: Balehm Tech Studio) แล้วอัปโหลดสลิป</p>
            <div className="w-60 rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
            <PassSlipForm action={uploadPassSlipAction} token={crypto.randomUUID()} />
          </>
        )}
        {(pays ?? []).filter((p) => p.status === "REJECTED").slice(0, 1).map((p) => <p key={p.id} className="text-sm text-red-300">สลิปล่าสุดถูกปฏิเสธ: {p.reject_reason}</p>)}
      </section>
    </main>
  );
}
