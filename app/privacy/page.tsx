import type { Metadata } from "next";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

// K-AV-R2.4: โครงหน้าเท่านั้น · เนื้อหานโยบายรออลิสร่าง + พี่หยัดอ่าน (ห้ามเขียนเอง)
export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLocale()).legal;
  return { title: `${t.privacyTitle} — AVELAi` };
}

export default async function Page() {
  const t = dict(await getLocale()).legal;
  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-2xl tracking-[0.15em] text-gold">{t.privacyTitle}</h1>
      <p data-legal-pending className="text-sm text-ink-muted">{t.pending}</p>
    </main>
  );
}
