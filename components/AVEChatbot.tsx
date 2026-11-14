'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bot, X, Send, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react';
import { defaultLocale, dict, type Locale } from '@/lib/i18n';
import { helpMenuItems } from '@/lib/help/menu';

// K-AV-HOME.2: ปุ่มฟ้า AVE = จุดช่วยเหลือจุดเดียว (ภาพต้นแบบ 05/06)
// กดแล้วขึ้นเมนูช่วยเหลือก่อน → "คุยกับ AVE" เปิดแชทเดิม (ตรรกะแชท/ข้อความ/API ไม่แตะ)

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// K-AV-AVE.soon: aveReady=false (server ยังไม่ตั้งคีย์ AVE) → ป้าย "เร็ว ๆ นี้" แทนช่องพิมพ์ · ไม่เรียก /api/ave/chat
export default function AVEChatbot({ username = null, locale = defaultLocale, aveReady = true }: { username?: string | null; locale?: Locale; aveReady?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'chat' | 'contact'>('menu');
  const tm = dict(locale).help.menu;
  const menu = helpMenuItems(locale, username);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'สวัสดีค่ะ! ฉันคือ AVE (อีฟ) ผู้ช่วย AI ประจำ AVELAi มีอะไรให้ช่วยเรื่องคะแนน กฎกติกา หรือทัวร์นาเมนต์ไหมคะ?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!aveReady || !input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ave/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-6)
        })
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'ขออภัยค่ะ ระบบประมวลผลขัดข้องชั่วคราว' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย' }]);
    } finally {
      setLoading(false);
    }
  };

  const row = 'flex min-h-11 w-full items-center justify-between rounded-lg bg-slate-900 px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer';

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mono">
      {!isOpen && (
        <button
          onClick={() => { setView('menu'); setIsOpen(true); }}
          aria-label={tm.open}
          className="bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-black p-4 rounded-full shadow-[0_0_20px_rgba(0,212,255,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
          title="Open AVE Assistant"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {isOpen && view !== 'chat' && (
        <div role="dialog" aria-label={tm.label} data-help-menu className="bg-[#0B0F17] border border-[#00D4FF]/40 rounded-2xl w-[calc(100vw-3rem)] max-w-80 sm:w-96 sm:max-w-none shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col gap-3 p-4 font-sans backdrop-blur-xl">
          <div className="flex items-start justify-between gap-2">
            {menu.map((it) => it.kind === 'text' && (
              <h3 key={it.id} data-help-item={it.id} className="text-white font-bold text-lg leading-snug">{it.label}</h3>
            ))}
            <button type="button" onClick={() => setIsOpen(false)} aria-label={tm.close} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-slate-900 cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          {view === 'contact' ? (
            <div data-help-contact className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-white">{tm.contact}</p>
              {menu.flatMap((it) => (it.kind === 'contact' ? it.lines : [])).map((l) => (
                <p key={l} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-zinc-200">{l}</p>
              ))}
              <button type="button" onClick={() => setView('menu')} className="mt-1 flex items-center gap-1 self-start text-sm text-[#00D4FF] cursor-pointer">
                <ArrowLeft className="w-4 h-4" />{tm.back}
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {menu.map((it) => {
                if (it.kind === 'chat') return (
                  <li key={it.id} data-help-item={it.id}>
                    <button type="button" onClick={() => setView('chat')} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#00D4FF] px-3 py-2.5 text-sm font-black text-slate-950 hover:bg-[#00D4FF]/80 cursor-pointer">
                      {it.label}
                    </button>
                    <p className="mt-1 text-center text-xs text-zinc-400">{it.hint}</p>
                  </li>
                );
                if (it.kind === 'link') return (
                  <li key={it.id} data-help-item={it.id}>
                    <Link href={it.href} onClick={() => setIsOpen(false)} className={row}>
                      {it.label}<ChevronRight className="w-4 h-4 text-zinc-400" />
                    </Link>
                  </li>
                );
                if (it.kind === 'contact') return (
                  <li key={it.id} data-help-item={it.id}>
                    <button type="button" onClick={() => setView('contact')} className={row}>
                      {it.label}<ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>
                  </li>
                );
                return null;
              })}
            </ul>
          )}
        </div>
      )}

      {isOpen && view === 'chat' && (
        <div className="bg-[#0B0F17] border border-[#00D4FF]/40 rounded-2xl w-80 sm:w-96 h-120 shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/40 flex items-center justify-center text-[#00D4FF]">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-white font-bold text-xs tracking-wider flex items-center gap-1.5">
                  AVE PROTOCOL <Sparkles className="w-3 h-3 text-[#C9A84C]" />
                </h3>
                <span className="text-xs text-[#00D4FF]/70 tracking-widest uppercase">PRECISION IS FREEDOM</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setView('menu')}
                aria-label={tm.back}
                title={tm.back}
                className="text-zinc-500 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 selection:bg-[#00D4FF] selection:text-black">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed font-sans ${msg.role === 'user'
                      ? 'bg-[#00D4FF] text-slate-950 font-medium rounded-br-xs shadow-md'
                      : 'bg-slate-900 text-zinc-200 border border-slate-800 rounded-bl-xs shadow-inner'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-900 border border-slate-800 rounded-xl rounded-bl-xs p-3 text-xs text-[#00D4FF] animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
                  AVE กำลังประมวลผลข้อมูล...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-2.5 border-t border-slate-800/80 bg-slate-950">
            {!aveReady ? (
              <p data-ave-soon className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-center text-xs text-[#00D4FF]">{tm.aveSoon}</p>
            ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="สอบถามระบบ AVELAi ได้ที่นี่..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-[#00D4FF]/60 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-hidden transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-[#00D4FF] hover:bg-[#00D4FF]/80 disabled:opacity-40 disabled:hover:bg-[#00D4FF] text-slate-950 font-black p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
