'use client'

import React, { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AVEChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'สวัสดีครับ! ผมคือ AVE ประจำ AVELAi มีอะไรให้ผมช่วยเหลือเรื่องคะแนนหรือทัวร์นาเมนต์ไหมครับ?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch('/api/ave/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-6)
        })
      })

      const data = await res.json()
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว' }])
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold p-4 rounded-full shadow-lg shadow-cyan-500/50 flex items-center justify-center transition-all duration-300 transform hover:scale-110"
        >
          <span className="text-2xl">🤖</span>
        </button>
      )}

      {isOpen && (
        <div className="bg-[#0f172a] border border-cyan-500/40 rounded-xl w-80 sm:w-96 h-[480px] shadow-2xl flex flex-col overflow-hidden backdrop-blur-md">
          {/* Header */}
          <div className="bg-cyan-950/80 p-3 border-b border-cyan-500/30 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-xl">🤖</span>
              <div>
                <h3 className="text-cyan-400 font-bold text-sm leading-tight">AVE Assistant</h3>
                <span className="text-[10px] text-gray-400">PRECISION IS FREEDOM</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-lg font-bold px-2"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-2.5 text-xs leading-relaxed ${msg.role === 'user'
                      ? 'bg-cyan-600 text-white rounded-br-none'
                      : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-cyan-400 animate-pulse">
                  AVE กำลังประมวลผล...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-2 border-t border-gray-800 bg-[#0b0f19]">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="สอบถาม AVE ได้ที่นี่..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                ส่ง
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}