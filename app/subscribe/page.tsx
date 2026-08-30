'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js' // นำเข้า User type มาใช้ตรงๆ

export default function SubscribePage() {
  const [user, setUser] = useState<User | null>(null) // เลิกใช้ any แล้วจ้า
  const [currentTier, setCurrentTier] = useState<string>('free')
  const [loading, setLoading] = useState<boolean>(false)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  );
  const router = useRouter()
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      const { data } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
      if (data) setCurrentTier(data.subscription_tier)
    }
    getUser()
  }, [router, supabase])

  const handleUpgrade = async () => {
    if (!user) return
    setLoading(true)
    const { error } = await supabase
      .from('users')
      .update({ subscription_tier: 'pro', arena_tickets: 5 })
      .eq('id', user.id)
    if (!error) { setCurrentTier('pro'); router.refresh() }
    setLoading(false)
  }

  const handleDowngrade = async () => {
    if (!user) return
    setLoading(true)
    const { error } = await supabase
      .from('users')
      .update({ subscription_tier: 'free', arena_tickets: 1 })
      .eq('id', user.id)
    if (!error) { setCurrentTier('free'); router.refresh() }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-4 py-16 flex flex-col items-center">
      <div className="text-center mb-12">
        <p className="text-[#00D4FF] font-mono text-sm tracking-widest mb-2">ARENA ACCESS</p>
        <h1 className="font-['Orbitron'] text-4xl font-black tracking-wide mb-3">
          CHOOSE YOUR <span className="text-[#C9A84C]">PASSPORT</span>
        </h1>
        <p className="text-gray-400 text-sm">PRECISION IS FREEDOM</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">

        <div className={`flex-1 rounded-xl border p-6 flex flex-col gap-4 transition-all duration-300 ${currentTier === 'free'
          ? 'border-[#00D4FF] shadow-[0_0_24px_rgba(0,212,255,0.2)] bg-[#12121A]'
          : 'border-gray-700 bg-[#12121A]'
          }`}>
          <div>
            <p className="text-xs text-gray-500 font-mono tracking-widest mb-1">TIER 1</p>
            <h2 className="font-['Orbitron'] text-2xl font-bold text-white">FREE RECRUIT</h2>
            <p className="text-3xl font-black mt-2">0 <span className="text-sm font-normal text-gray-400">/ mo</span></p>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-gray-300 flex-1">
            <li className="flex items-center gap-2"><span className="text-[#00D4FF]">+</span> 1 Arena Ticket / week</li>
            <li className="flex items-center gap-2"><span className="text-[#00D4FF]">+</span> Leaderboard access</li>
            <li className="flex items-center gap-2"><span className="text-[#00D4FF]">+</span> Standard Passport</li>
            <li className="flex items-center gap-2"><span className="text-gray-600">-</span> <span className="text-gray-500">Daily tickets</span></li>
            <li className="flex items-center gap-2"><span className="text-gray-600">-</span> <span className="text-gray-500">AVE AI analysis</span></li>
            <li className="flex items-center gap-2"><span className="text-gray-600">-</span> <span className="text-gray-500">Gold Passport frame</span></li>
          </ul>
          {currentTier === 'free' ? (
            <div className="w-full py-2 text-center text-xs font-mono text-[#00D4FF] border border-[#00D4FF] rounded-lg">
              CURRENT PLAN
            </div>
          ) : (
            <button onClick={handleDowngrade} disabled={loading}
              className="w-full py-2 text-xs font-mono text-gray-400 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors">
              DOWNGRADE
            </button>
          )}
        </div>

        <div className={`flex-1 rounded-xl border p-6 flex flex-col gap-4 transition-all duration-300 relative overflow-hidden ${currentTier === 'pro'
          ? 'border-[#C9A84C] shadow-[0_0_32px_rgba(201,168,76,0.3)] bg-[#12121A]'
          : 'border-[#C9A84C]/50 bg-[#12121A]'
          }`}>
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-[#C9A84C] to-transparent" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-[#C9A84C] font-mono tracking-widest">TIER 2</p>
              <span className="text-xs bg-[#C9A84C]/20 text-[#C9A84C] px-2 py-0.5 rounded font-mono">RECOMMENDED</span>
            </div>
            <h2 className="font-['Orbitron'] text-2xl font-bold text-[#C9A84C]">PRO PASSPORT</h2>
            <p className="text-3xl font-black mt-2 text-white">380 THB <span className="text-sm font-normal text-gray-400">/ mo</span></p>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-gray-300 flex-1">
            <li className="flex items-center gap-2"><span className="text-[#C9A84C]">+</span> 1 Arena Ticket / day</li>
            <li className="flex items-center gap-2"><span className="text-[#C9A84C]">+</span> Leaderboard access</li>
            <li className="flex items-center gap-2"><span className="text-[#C9A84C]">+</span> Gold Passport frame</li>
            <li className="flex items-center gap-2"><span className="text-[#C9A84C]">+</span> AVE AI match analysis</li>
            <li className="flex items-center gap-2"><span className="text-[#C9A84C]">+</span> Point protection</li>
            <li className="flex items-center gap-2"><span className="text-[#C9A84C]">+</span> Priority matchmaking</li>
          </ul>
          {currentTier === 'pro' ? (
            <div className="w-full py-2 text-center text-xs font-mono text-[#C9A84C] border border-[#C9A84C] rounded-lg">
              CURRENT PLAN
            </div>
          ) : (
            <button onClick={handleUpgrade} disabled={loading}
              className="w-full py-2 text-xs font-mono text-black bg-[#C9A84C] rounded-lg hover:bg-[#E8C05A] transition-colors font-bold disabled:opacity-50">
              {loading ? 'UPGRADING...' : 'UPGRADE TO PRO'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs text-gray-600 font-mono text-center">
        75% of all revenue returns to the community Prize Pool — AVELAi PRECISION IS FREEDOM
      </p>
    </main>
  )
}