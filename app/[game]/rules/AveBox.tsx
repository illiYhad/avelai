"use client";

// K-AV-RULES.2: กล่องแชท AVE หน้าตาตามต้นแบบ :539–566 · ใบนี้ยังไม่ส่งข้อความจริง (ต่อ /api/ave/chat ใน K-AV-RULES.3)
// กดปุ่มหรือ Enter = ไปหน้าเข้าสู่ระบบ แล้วกลับมาที่หมวดนี้ · ไม่มีการเรียกเครือข่ายจากไฟล์นี้
import { useRouter } from "next/navigation";
import { AVE } from "./rules-content";

export default function AveBox() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-[var(--ref-gold-30)] bg-[var(--ref-card)] shadow-[var(--ref-glow-gold)]">
      <div className="flex items-center gap-3 border-b border-[var(--ref-s800)] bg-[var(--ref-dark)] px-6 py-4">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--ref-cyan)] bg-[var(--ref-s900)] font-display text-sm font-black text-[var(--ref-cyan)]">AVE</span>
        <div>
          <h4 className="text-lg font-bold tracking-wide text-white">{AVE.name}</h4>
          <p className="flex items-center gap-1 font-mono text-xs text-[var(--ref-cyan)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--ref-cyan)]" />
            {AVE.status}
          </p>
        </div>
      </div>
      <div className="h-80 space-y-4 overflow-y-auto bg-[var(--ref-dark)]/50 p-6">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--ref-gold-30)] bg-[var(--ref-s800)] px-4 py-3 text-sm leading-relaxed text-[var(--ref-s300)] shadow-md" data-testid="ave-greet">
            สวัสดีค่ะ! 🎯 ฉันคือ <strong>AVE (อีฟ)</strong> AI ประจำทัวร์นาเมนต์ AVELAi — PRECISION IS FREEDOM —
            <br />
            <br />
            มีข้อสงสัยเกี่ยวกับการคิดคะแนน <em>Killpoint</em>, วิธีการจับคู่ <em>Snake Draft</em>, หรือกฎ <em>Tie-breaker</em> ถามฉันมาได้เลยค่ะ!
          </div>
        </div>
      </div>
      <form
        className="border-t border-[var(--ref-s800)] bg-[var(--ref-dark)] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(AVE.loginHref);
        }}
      >
        <div className="flex gap-2">
          <input type="text" aria-label="คำถามถึง AVE" placeholder={AVE.placeholder} className="min-w-0 flex-1 rounded-lg border border-[var(--ref-s700)] bg-[var(--ref-s800)] px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--ref-gold)]" />
          <button type="submit" className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--ref-gold)] px-4 py-2.5 text-sm font-bold text-[var(--ref-dark)] sm:px-6">{AVE.send}</button>
        </div>
        <p className="mt-2 text-xs text-[var(--ref-s400)]">{AVE.loginNote}</p>
      </form>
    </div>
  );
}
