'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const supabase = createClient();

  const handleSteamLogin = () => {
    // TODO: implement Steam OpenID login
    console.log('Steam login');
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: implement email/password login via Supabase
    console.log('Email login', { email, password });
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6 relative overflow-hidden font-mono">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Gold glow top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
          top: -100,
          right: -100,
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-100 rounded-xl p-10"
        style={{
          background: '#12121A',
          border: '0.5px solid rgba(201,168,76,0.25)',
        }}
      >
        {/* Top gold line */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-xl"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)',
          }}
        />

        {/* Logo */}
        <div className="text-center mb-7">
          <h1
            className="text-[26px] font-bold tracking-[4px]"
            style={{ fontFamily: "'Orbitron', monospace", color: '#E8E8F0' }}
          >
            AVEL<span style={{ color: '#C9A84C' }}>A</span>i
          </h1>
          <p
            className="text-[8px] tracking-[3px] mt-1"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(0,212,255,0.6)' }}
          >
            — PRECISION IS FREEDOM —
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: '#00D4FF',
              animation: 'pulse 2s infinite',
            }}
          />
          <span
            className="text-[9px] tracking-[2px]"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(0,212,255,0.45)' }}
          >
            AVE ONLINE // ARENA READY
          </span>
        </div>

        {/* Divider */}
        <div
          className="mb-6 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent)' }}
        />

        {/* Steam button */}
        <button
          onClick={handleSteamLogin}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md mb-3 transition-all cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(201,168,76,0.3)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.6)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)')}
        >
          <SteamIcon />
          <span
            className="flex-1 text-center text-[13px] font-medium mr-5"
            style={{ fontFamily: "'Inter', sans-serif", color: '#E8E8F0' }}
          >
            Continue with Steam
          </span>
        </button>

        {/* Google button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md mb-5 transition-all cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
        >
          <GoogleIcon />
          <span
            className="flex-1 text-center text-[13px] font-medium mr-5"
            style={{ fontFamily: "'Inter', sans-serif", color: '#E8E8F0' }}
          >
            Continue with Google
          </span>
        </button>

        {/* OR divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.12)' }} />
          <span
            className="text-[9px] tracking-[2px]"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(232,232,240,0.25)' }}
          >
            OR
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.12)' }} />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label
              className="block text-[9px] tracking-[2px] mb-1.5"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(0,212,255,0.5)' }}
            >
              {'// IDENTIFIER'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@avelai.gg"
              className="w-full px-4 py-2.5 rounded-md text-[13px] outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '0.5px solid rgba(201,168,76,0.15)',
                color: '#E8E8F0',
                fontFamily: "'Inter', sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)')}
            />
          </div>

          <div>
            <label
              className="block text-[9px] tracking-[2px] mb-1.5"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(0,212,255,0.5)' }}
            >
              {'// ACCESS KEY'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-md text-[13px] outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '0.5px solid rgba(201,168,76,0.15)',
                color: '#E8E8F0',
                fontFamily: "'Inter', sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)')}
            />
          </div>

          <div className="flex justify-end">
            <a
              href="/forgot-password"
              className="text-[11px]"
              style={{ color: 'rgba(201,168,76,0.6)', fontFamily: "'Inter', sans-serif" }}
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-md text-[11px] font-bold tracking-[3px] transition-opacity hover:opacity-85 cursor-pointer"
            style={{
              background: '#C9A84C',
              color: '#0A0A0F',
              fontFamily: "'Orbitron', monospace",
            }}
          >
            ENTER ARENA
          </button>
        </form>

        {/* Register link */}
        <p
          className="text-center text-[12px] mt-6"
          style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(232,232,240,0.25)' }}
        >
          New recruit?{' '}
          <a href="/register" style={{ color: '#C9A84C' }}>
            Register here
          </a>
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        input::placeholder { color: rgba(232,232,240,0.18); }
      `}</style>
    </main>
  );
}

function SteamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#1b2838" />
      <path
        d="M12 4.5C7.86 4.5 4.5 7.86 4.5 12c0 .23.01.46.03.68l4.22 1.74a2.25 2.25 0 011.25-.38c.04 0 .08 0 .12.01l1.88-2.72v-.04a3.38 3.38 0 013.37-3.37 3.38 3.38 0 010 6.75l-2.67 1.9c0 .03.01.07.01.1a2.25 2.25 0 01-4.5 0 2.25 2.25 0 01.06-.51L5.1 14.5A7.5 7.5 0 0019.5 12 7.5 7.5 0 0012 4.5z"
        fill="#c7d5e0"
      />
      <circle cx="14.62" cy="9.38" r="2.25" fill="#c7d5e0" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}