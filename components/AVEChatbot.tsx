'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AVEChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'สวัสดีครับ! ผมคือ AVE ผู้ช่วย AI ประจำ AVELAi มีอะไรให้ผมช่วยเหลือเรื่องคะแนน กฎกติกา หรือทัวร์นาเมนต์ไหมครับ?' }
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
    if (!input.trim() || loading) return;

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
        setMessages((prev) => [...prev, { role: 'assistant', content: 'ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mono">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-black p-4 rounded-full shadow-[0_0_20px_rgba(0,212,255,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
          title="Open AVE Assistant"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
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
                <span className="text-[9px] text-[#00D4FF]/70 tracking-widest uppercase">PRECISION IS FREEDOM</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
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
          </div>
        </div>
      )}
    </div>
  );
}