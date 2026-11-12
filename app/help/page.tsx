import Link from "next/link";
import { helpCategories } from "@/lib/help/articles";
import { CONTACT } from "@/lib/contact";
import { dict, localePath } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";

// K-AV-HOME.2: ศูนย์ช่วยเหลือ (ภาพต้นแบบ 07_knowledge_base.png) · สาธารณะ · EN = /en/help
// 4 หมวด · เนื้อหาเฉพาะที่มีที่มาแล้ว (ที่มาของแต่ละบทความเขียนเป็นคอมเมนต์ใน lib/i18n/th.ts → help.center)
// เรื่องที่ยังไม่มีมติ (ตั๋ว · การเข้าร่วมลีก) = "เร็ว ๆ นี้" ไม่แต่งเนื้อหา
export async function generateMetadata() {
  return { title: dict(await getLocale()).help.center.metaTitle };
}

export default async function HelpPage() {
  const locale = await getLocale();
  const c = dict(locale).help.center;
  const lp = (p: string) => localePath(locale, p);
  const cats = helpCategories(c, lp);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 pb-28 sm:px-6">
      <PageHeader eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
      <nav aria-label={c.title} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cats.map((cat) => (
          <a key={cat.id} href={`#${cat.id}`} className="hud-panel rounded-lg border-l-2 border-l-cyan p-4 hover:border-cyan/60">
            <p className="font-bold text-ink">{cat.title}</p>
            <p className="mt-1 text-sm text-ink-muted">{cat.desc}</p>
          </a>
        ))}
      </nav>
      {cats.map((cat) => (
        <section key={cat.id} id={cat.id} data-help-category={cat.id} className="flex scroll-mt-24 flex-col gap-3">
          <h2 className="hud-title text-xl text-ink">{cat.title}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {cat.articles.map((a) => (
              <Surface key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-ink">{a.title}</h3>
                  {!a.body && <span className="hud-chip hud-chip-gold shrink-0">{c.soon}</span>}
                </div>
                {a.body && <p className="mt-2 text-sm text-ink-muted">{a.body}</p>}
                {a.link && <Link href={a.link.href} className="mt-3 inline-block text-sm text-cyan underline">{a.link.label}</Link>}
              </Surface>
            ))}
          </div>
        </section>
      ))}
      <section data-help-contact className="hud-panel rounded-lg p-5">
        <h2 className="font-bold text-ink">{c.contactTitle}</h2>
        <p className="mt-2 text-sm text-ink-muted">Discord: {CONTACT.discord} · {c.email}: {CONTACT.email}</p>
      </section>
    </main>
  );
}
