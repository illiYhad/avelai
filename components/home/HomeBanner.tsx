"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { homeSlides, SLIDE_INTERVAL_MS } from "@/lib/home/slides";
import { defaultLocale, dict, type Locale } from "@/lib/i18n";
import { fill } from "@/lib/home/time-label";

// K-AV-HOME.1: แบนเนอร์หมุน (โครงจากภาพต้นแบบ 01/02 · หน้าตาโลก AVELAi)
// SSR = สไลด์ 1 (ไม่กระพริบตอนโหลด) · หมุนเองทุก 6 วินาที · หยุดเมื่อเมาส์ชี้/โฟกัส · prefers-reduced-motion = ไม่หมุนเอง
// รูปพื้นโปร่งใส: ห้ามยืด/บีบ (object-contain + สัดส่วนไฟล์จริง) · ไม่มีอะไรวางทับตัวละคร/โลโก้บนตัว
// K-AV-I18N.0b: สไลด์ + aria จากพจนานุกรมตาม locale
export default function HomeBanner({ locale = defaultLocale }: { locale?: Locale }) {
  const HOME_SLIDES = homeSlides(locale);
  const t = dict(locale).home.banner;
  const count = HOME_SLIDES.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || count < 2) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % count), SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  return (
    <section
      data-section="banner"
      aria-roledescription="carousel"
      aria-label={t.label}
      className="hud-panel hud-panel-gold relative h-[320px] overflow-hidden rounded-xl lg:h-[420px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {HOME_SLIDES.map((s, i) => {
        const on = i === active;
        return (
          <div
            key={s.id}
            data-slide={s.id}
            aria-roledescription="slide"
            aria-label={fill(t.slideOf, { n: i + 1, total: HOME_SLIDES.length })}
            aria-hidden={!on}
            inert={!on}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${on ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {/* พื้นไล่สีจากซ้าย (ไม่ทับรูป) */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-void via-panel/90 to-cyan-deep/20" />
            <div className="absolute bottom-0 right-2 h-[42%] sm:right-6 sm:h-full">
              <Image
                src={s.image.src}
                width={s.image.width}
                height={s.image.height}
                alt={s.image.alt}
                priority={i === 0}
                sizes="(min-width: 1024px) 300px, 230px"
                className={`h-full w-auto object-contain object-bottom ${s.glow === "gold" ? "drop-shadow-[0_0_24px_var(--color-gold)]" : ""}`}
              />
            </div>
            <div className="relative z-10 flex h-full max-w-full flex-col justify-center gap-3 px-6 pb-12 pt-6 sm:max-w-[58%] sm:px-10">
              {s.eyebrow && <p className="hud-chip">{s.eyebrow}</p>}
              <h2 className="hud-title text-2xl leading-tight text-ink sm:text-4xl lg:text-5xl">{s.title}</h2>
              <p className="line-clamp-3 max-w-[70%] text-sm text-ink-muted sm:max-w-none sm:text-base">{s.body}</p>
              <div className="pt-2">
                <Link href={s.cta.href} className="btn-primary rounded-md px-6">
                  {s.cta.label}
                </Link>
              </div>
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {HOME_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={fill(t.goTo, { n: i + 1, title: s.title })}
            aria-current={i === active}
            onClick={() => setActive(i)}
            className="flex h-6 items-center px-1"
          >
            <span className={`block h-1 rounded-full transition-all ${i === active ? "w-8 bg-gold" : "w-5 bg-white/30"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
