'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState<'google' | 'steam' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleGoogleLogin() {
    setLoading('google')
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(null)
    }
    // ถ้าสำเร็จ browser จะ redirect ไป Google อัตโนมัติ
  }

  async function handleSteamLogin() {
    setLoading('steam')
    setError(null)

    // Steam ใช้ OpenID — redirect ไป Steam โดยตรง
    // Supabase ยังไม่รองรับ Steam native → ใช้ custom flow
    // TODO: implement Steam OpenID flow
    // สำหรับตอนนี้ redirect ไปหน้า coming soon
    setTimeout(() => {
      setError('Steam login coming soon — กำลังพัฒนาอยู่ค่ะ')
      setLoading(null)
    }, 500)
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span
              className="text-3xl font-black tracking-tight text-white"
              style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.04em' }}
            >
              AVEL<span style={{ color: '#C9A84C' }}>A</span>i
            </span>
          </div>
          <p className="text-sm text-zinc-500 tracking-widest uppercase">
            Esports Arena League Ai
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <h1 className="text-lg font-semibold text-white mb-1">ยินดีต้อนรับ</h1>
          <p className="text-sm text-zinc-500 mb-7">
            เข้าสู่ระบบเพื่อเริ่มแข่งขัน
          </p>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-lg px-4 py-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20">
              {error}
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-150 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: loading === 'google' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget.style.background = 'rgba(255,255,255,0.11)')
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')
            }}
          >
            {loading === 'google' ? (
              <Spinner />
            ) : (
              <GoogleIcon />
            )}
            {loading === 'google' ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}
          </button>

          {/* Steam */}
          <button
            onClick={handleSteamLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: loading === 'steam' ? 'rgba(23,47,79,0.5)' : 'rgba(23,47,79,0.4)',
              border: '1px solid rgba(59,130,246,0.2)',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget.style.background = 'rgba(23,47,79,0.65)')
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.currentTarget.style.background = 'rgba(23,47,79,0.4)')
            }}
          >
            {loading === 'steam' ? (
              <Spinner />
            ) : (
              <SteamIcon />
            )}
            {loading === 'steam' ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Steam'}
          </button>

          {/* Divider */}
          <div className="mt-7 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-zinc-600">
              การเข้าสู่ระบบถือว่าคุณยอมรับ{' '}
              <a href="/terms" className="text-zinc-400 hover:text-white transition-colors">
                เงื่อนไขการใช้งาน
              </a>
            </p>
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="mt-6 text-center text-xs text-zinc-700">
          Powered by AI · Built for Thai Esports
        </p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

function SteamIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.497 1.41-2.455 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
