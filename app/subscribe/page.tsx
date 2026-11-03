'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js' // นำเข้า User type มาใช้ตรงๆ
import { FEATURES, FEATURE_DISABLED_MESSAGE } from '@/lib/featureFlags'

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
    if (!FEATURES.payments) return
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

  // K-AV-R: ปิดระบบจ่ายเงินด้วย feature flag — เก็บโค้ดเดิมด้านล่างไว้ทั้งหมด
  if (!FEATURES.payments) {
    return (
      <main className="min-h-screen text-ink px-4 py-24 flex flex-col items-center justify-center text-center">
        <p className="hud-chip mx-auto mb-3">ARENA ACCESS</p>
        <h1 className="hud-title text-2xl mb-3">COMING SOON</h1>
        <p className="text-ink-muted text-sm">{FEATURE_DISABLED_MESSAGE}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-ink px-4 py-16 flex flex-col items-center">
      <div className="text-center mb-12">
        <p className="hud-chip mx-auto mb-2">ARENA ACCESS</p>
        <h1 className="hud-title text-3xl sm:text-4xl mb-3">
          CHOOSE YOUR <span className="text-gold">PASSPORT</span>
        </h1>
        <p className="text-ink-muted text-sm">PRECISION IS FREEDOM</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">

        <div className={`flex-1 rounded-xl border p-6 flex flex-col gap-4 transition-all duration-300 ${currentTier === 'free'
          ? 'hud-panel ci-corners border-cyan shadow-glow-cyan'
          : 'hud-panel'
          }`}>
          <div>
            <p className="text-xs text-ink-muted font-mono tracking-widest mb-1">TIER 1</p>
            <h2 className="font-display text-2xl font-bold text-ink">FREE RECRUIT</h2>
            <p className="text-3xl font-black mt-2">0 <span className="text-sm font-normal text-ink-muted">/ mo</span></p>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-ink flex-1">
            <li className="flex items-center gap-2"><span className="text-cyan">+</span> 1 Arena Ticket / week</li>
            <li className="flex items-center gap-2"><span className="text-cyan">+</span> Leaderboard access</li>
            <li className="flex items-center gap-2"><span className="text-cyan">+</span> Standard Passport</li>
            <li className="flex items-center gap-2"><span className="text-ink-muted/60">-</span> <span className="text-ink-muted">Daily tickets</span></li>
            <li className="flex items-center gap-2"><span className="text-ink-muted/60">-</span> <span className="text-ink-muted">AVE AI analysis</span></li>
            <li className="flex items-center gap-2"><span className="text-ink-muted/60">-</span> <span className="text-ink-muted">Gold Passport frame</span></li>
          </ul>
          {currentTier === 'free' ? (
            <div className="w-full py-2 text-center text-xs font-mono text-cyan border border-cyan rounded-lg">
              CURRENT PLAN
            </div>
          ) : (
            <button onClick={handleDowngrade} disabled={loading}
              className="w-full py-2 text-xs font-mono text-ink-muted border border-line rounded-lg hover:border-cyan/40 transition-colors">
              DOWNGRADE
            </button>
          )}
        </div>

        <div className={`flex-1 rounded-xl border p-6 flex flex-col gap-4 transition-all duration-300 relative overflow-hidden ${currentTier === 'pro'
          ? 'hud-panel hud-panel-gold ci-corners'
          : 'hud-panel hud-panel-gold'
          }`}>
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-gold to-transparent" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-gold font-mono tracking-widest">TIER 2</p>
              <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded font-mono">RECOMMENDED</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-gold">PRO PASSPORT</h2>
            <p className="text-3xl font-black mt-2 text-ink">380 THB <span className="text-sm font-normal text-ink-muted">/ mo</span></p>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-ink flex-1">
            <li className="flex items-center gap-2"><span className="text-gold">+</span> 1 Arena Ticket / day</li>
            <li className="flex items-center gap-2"><span className="text-gold">+</span> Leaderboard access</li>
            <li className="flex items-center gap-2"><span className="text-gold">+</span> Gold Passport frame</li>
            <li className="flex items-center gap-2"><span className="text-gold">+</span> AVE AI match analysis</li>
            <li className="flex items-center gap-2"><span className="text-gold">+</span> Point protection</li>
            <li className="flex items-center gap-2"><span className="text-gold">+</span> Priority matchmaking</li>
          </ul>
          {currentTier === 'pro' ? (
            <div className="w-full py-2 text-center text-xs font-mono text-gold border border-gold rounded-lg">
              CURRENT PLAN
            </div>
          ) : (
            <button onClick={handleUpgrade} disabled={loading}
              className="w-full py-2 text-xs font-mono text-void bg-gold rounded-lg hover:bg-gold-hover transition-colors font-bold disabled:opacity-50">
              {loading ? 'UPGRADING...' : 'UPGRADE TO PRO'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs text-ink-muted/60 font-mono text-center">
        75% of all revenue returns to the community Prize Pool — AVELAi PRECISION IS FREEDOM
      </p>
    </main>
  )
}