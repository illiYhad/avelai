"use client";

// K-AV-RULES.2: กล่องแชท AVE หน้าตาตามต้นแบบ :539–566
// K-AV-RULES.3: ส่งข้อความจริงไป POST /api/ave/chat (ตรรกะอยู่ ave-chat.ts) · คำตอบแสดงเป็นข้อความธรรมดา · 401 = ลิงก์เข้าสู่ระบบ (ไม่ redirect เอง)
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AVE } from "./rules-content";
import { AVE_CHAT_URL, AVE_LOGIN_HREF, AVE_TYPING, askAve, buildHistory, checkDraft, resultToLine, type AveLine } from "./ave-chat";

const bubble = "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md";

function AveLineView({ line }: { line: AveLine }) {
  if (line.role === "system") {
    return (
      <div className="flex justify-center" data-testid={`ave-system-${line.kind}`}>
        <div className="max-w-[90%] rounded-lg border border-[var(--ref-cyan-50)] bg-[var(--ref-dark)] px-4 py-2 text-center text-xs text-[var(--ref-s300)]">
          {line.kind === "login" ? (
            <a href={AVE_LOGIN_HREF} className="font-semibold text-[var(--ref-cyan)] underline underline-offset-2">{line.content}</a>
          ) : (
            line.content
          )}
        </div>
      </div>
    );
  }
  if (line.role === "user") {
    return (
      <div className="flex justify-end">
        <div className={`${bubble} rounded-tr-sm bg-[var(--ref-gold)] font-medium text-[var(--ref-dark)]`}>{line.content}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className={`${bubble} rounded-tl-sm border border-[var(--ref-gold-30)] bg-[var(--ref-s800)] text-[var(--ref-s300)]`}>{line.content}</div>
    </div>
  );
}

export default function AveBox() {
  const [lines, setLines] = useState<AveLine[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  async function send() {
    if (busy) return;
    const checked = checkDraft(draft);
    if (!checked.ok) {
      if (checked.error) setLines((l) => [...l, { role: "system", kind: "error", content: checked.error as string }]);
      return;
    }
    const history = buildHistory(lines);
    setLines((l) => [...l, { role: "user", content: checked.message }]);
    setDraft("");
    setBusy(true);
    const result = await askAve(
      (body) => fetch(AVE_CHAT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body }),
      checked.message,
      history,
    );
    setLines((l) => [...l, resultToLine(result)]);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-[var(--ref-gold-30)] bg-[var(--ref-card)] shadow-[var(--ref-glow-gold)]">
      <div className="flex items-center gap-3 border-b border-[var(--ref-s800)] bg-[var(--ref-dark)] px-6 py-4">
        {/* :544 รูป AVE (ใบเสริม 2) */}
        <Image src="/brand/rules/ave-avatar-256.jpg" alt="AVE ผู้ช่วย AI" width={256} height={256} className="h-12 w-12 shrink-0 rounded-full border border-[var(--ref-cyan)] object-cover shadow-lg" />
        <div>
          <h4 className="text-lg font-bold tracking-wide text-white">{AVE.name}</h4>
          <p className="flex items-center gap-1 font-mono text-xs text-[var(--ref-cyan)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--ref-cyan)]" />
            {AVE.status}
          </p>
        </div>
      </div>
      <div ref={scrollRef} className="h-80 space-y-4 overflow-y-auto bg-[var(--ref-dark)]/50 p-6" aria-live="polite">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--ref-gold-30)] bg-[var(--ref-s800)] px-4 py-3 text-sm leading-relaxed text-[var(--ref-s300)] shadow-md" data-testid="ave-greet">
            สวัสดีค่ะ! 🎯 ฉันคือ <strong>AVE (อีฟ)</strong> AI ประจำทัวร์นาเมนต์ AVELAi — PRECISION IS FREEDOM —
            <br />
            <br />
            มีข้อสงสัยเกี่ยวกับการคิดคะแนน <em>Killpoint</em>, วิธีการจับคู่ <em>Snake Draft</em>, หรือกฎ <em>Tie-breaker</em> ถามฉันมาได้เลยค่ะ!
          </div>
        </div>
        {lines.map((l, i) => <AveLineView key={i} line={l} />)}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-[var(--ref-s800)] px-4 py-2 text-xs text-[var(--ref-s400)]">{AVE_TYPING}</div>
          </div>
        )}
      </div>
      <form
        className="border-t border-[var(--ref-s800)] bg-[var(--ref-dark)] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="คำถามถึง AVE"
            placeholder={AVE.placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--ref-s700)] bg-[var(--ref-s800)] px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--ref-gold)]"
          />
          <button type="submit" disabled={busy} className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--ref-gold)] px-4 py-2.5 text-sm font-bold text-[var(--ref-dark)] disabled:cursor-not-allowed disabled:opacity-60 sm:px-6">{AVE.send}</button>
        </div>
      </form>
    </div>
  );
}
