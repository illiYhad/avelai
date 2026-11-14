import { dict, type Locale } from "@/lib/i18n";
// K-AV-3: ใบยืนยันการชำระ (HTML พิมพ์เป็น PDF ได้) — แสดงเฉพาะ payment ที่ VERIFIED · ไม่ใช่ใบกำกับภาษี
// ห้ามใส่เลขผู้เสียภาษี/ข้อมูลบริษัทที่ไม่มีในไฟล์ใด ๆ ของ repo

export type ReceiptData = {
  paymentId: string;
  kind: "REGISTRATION" | "PASS";
  amountThb: number;
  verifiedAt: string | null;
  payerUsername: string;
  /** ชื่อรายการ เช่น ชื่อทัวร์ + ทีม หรือ "Weekly Pass (Dota 2)" */
  description: string;
  /** ผู้รับเงิน */
  payee: string;
};

function thai(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" }) : "–";
}

export function Receipt({ r, locale = "th" }: { r: ReceiptData; locale?: Locale }) {
  const t = dict(locale).receipt; // K-AV-R2.6
  return (
    <main className="mx-auto w-full max-w-lg px-6 py-10 text-white print:text-black">
      <style>{`@media print { nav, .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
      <section className="rounded border border-white/20 p-6 print:border-black">
        <p className="font-display text-xs tracking-[0.3em] text-gold print:text-black">AVELAi</p>
        <h1 className="mt-1 text-xl font-bold">{t.title}</h1>
        <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-white/60 print:text-black">{t.no}</dt><dd className="font-numeric break-all">{r.paymentId}</dd>
          <dt className="text-white/60 print:text-black">{t.item}</dt><dd>{r.description}</dd>
          <dt className="text-white/60 print:text-black">{t.payer}</dt><dd>{r.payerUsername}</dd>
          <dt className="text-white/60 print:text-black">{t.payee}</dt><dd>{r.payee}</dd>
          <dt className="text-white/60 print:text-black">{t.amount}</dt><dd className="font-numeric">{r.amountThb.toLocaleString("th-TH", { minimumFractionDigits: 2 })} {t.baht}</dd>
          <dt className="text-white/60 print:text-black">{t.verifiedAt}</dt><dd>{thai(r.verifiedAt)}</dd>
        </dl>
        <p className="mt-6 text-xs text-white/60 print:text-black">
          {t.footer} {r.kind === "REGISTRATION" ? t.organizer : "Balehm Tech Studio"} · {t.notTaxInvoice}
        </p>
      </section>
      <p className="no-print mt-4 text-xs text-white/50">{t.printHint}</p>
    </main>
  );
}
