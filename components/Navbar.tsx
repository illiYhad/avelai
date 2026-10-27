'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bell, ChevronDown, Lock, Menu, X } from 'lucide-react';
import {
  DEFAULT_GAME_SLUG,
  GAME_MENU,
  GAME_STORAGE_KEY,
  gameFromPath,
  isGameLocked,
  isGameSlug,
  navFor,
  switchGamePath,
  type GameSlug,
} from '@/lib/nav';
import { signOutAction } from '@/app/auth/actions';

// K-AV-UX2A: หัวเว็บ — ข้อมูลผู้ใช้มาจาก app/layout.tsx (อ่าน session ครั้งเดียวต่อ request)
type Props = { signedIn: boolean; username?: string | null; isAdmin?: boolean };

function readStoredGame(): GameSlug {
  try {
    const v = window.localStorage.getItem(GAME_STORAGE_KEY);
    return isGameSlug(v) ? v : DEFAULT_GAME_SLUG;
  } catch {
    return DEFAULT_GAME_SLUG;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function gameLabel(slug: GameSlug) {
  return GAME_MENU.find((g) => g.slug === slug)?.label ?? slug.toUpperCase();
}

function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="font-display text-lg font-extrabold tracking-[0.08em] text-ink">
      AVEL<span className="text-gold">Ai</span>
    </Link>
  );
}

function GameSwitcher({ game, locked, pathname }: { game: GameSlug; locked: boolean; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (locked) {
    return (
      <span title="หน้านี้เป็นของเกมเดียว" className="flex min-h-11 items-center gap-1.5 rounded border border-line px-3 font-mono text-sm text-ink-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden /> {gameLabel(game)}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost flex min-h-11 items-center gap-1.5 rounded px-3 font-mono text-sm"
      >
        {gameLabel(game)} <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <ul role="menu" className="absolute left-0 top-full z-50 mt-2 w-48 rounded border border-line bg-surface-2 py-1">
          {GAME_MENU.map((g) => (
            <li key={g.slug} role="none">
              <Link
                role="menuitem"
                href={switchGamePath(pathname, g.slug)}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center justify-between border-l-2 px-3 font-mono text-sm ${
                  g.slug === game ? 'border-gold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {g.label}
                {g.soon ? <span className="text-xs text-ink-muted">เร็ว ๆ นี้</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function Navbar({ signedIn, username = null, isAdmin = false }: Props) {
  const pathname = usePathname() ?? '';
  // เกมที่จำไว้ (localStorage) · ฝั่ง server = ค่าเริ่ม ไม่ให้ hydration ไม่ตรง
  const stored = useSyncExternalStore(subscribeStorage, readStoredGame, () => DEFAULT_GAME_SLUG);
  const [drawer, setDrawer] = useState(false);
  const [account, setAccount] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    // เปลี่ยนหน้า = ปิดลิ้นชัก/เมนูบัญชี (ตั้งค่าระหว่าง render ตามแนวทาง React แทน effect)
    setLastPath(pathname);
    setDrawer(false);
    setAccount(false);
  }

  const fromPath = gameFromPath(pathname);
  const game = fromPath ?? stored;
  const locked = isGameLocked(pathname);
  const nav = navFor(signedIn, game, { locked, isAdmin, username });

  useEffect(() => {
    if (!fromPath) return;
    try { window.localStorage.setItem(GAME_STORAGE_KEY, fromPath); } catch { /* โหมดส่วนตัว */ }
  }, [fromPath]);

  useEffect(() => {
    if (!drawer && !account) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDrawer(false); setAccount(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer, account]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const initial = (username ?? '?').slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/90 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:h-16">
        <Logo href={nav.home} />
        {nav.showGameSwitcher ? <GameSwitcher game={game} locked={nav.gameLocked} pathname={pathname} /> : null}

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {nav.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className={`flex min-h-11 items-center border-b-2 px-3 text-sm ${
                isActive(l.href) ? 'border-gold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {signedIn ? (
          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <button type="button" disabled aria-label="การแจ้งเตือน" title="เร็ว ๆ นี้" className="flex h-11 w-11 items-center justify-center rounded text-ink-muted disabled:opacity-60">
              <Bell className="h-5 w-5" aria-hidden />
            </button>
            <div className="relative hidden md:block">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={account}
                onClick={() => setAccount((o) => !o)}
                className="flex min-h-11 items-center gap-2 rounded px-2 text-sm text-ink"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-3 font-display text-sm text-gold">{initial}</span>
                <span className="max-w-32 truncate">{username ?? 'บัญชี'}</span>
              </button>
              {account ? <AccountMenu items={nav.account} className="absolute right-0 top-full mt-2 w-52" /> : null}
            </div>
            <button
              type="button"
              aria-label="เมนู"
              aria-expanded={drawer}
              onClick={() => setDrawer((o) => !o)}
              className="flex h-11 w-11 items-center justify-center rounded text-ink md:hidden"
            >
              {drawer ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn-primary ml-auto flex min-h-11 items-center rounded px-4 text-sm">
            เข้าสู่ระบบ
          </Link>
        )}
      </nav>

      {drawer && signedIn ? (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 md:hidden" onClick={() => setDrawer(false)}>
          <div className="flex h-full flex-col bg-void" onClick={(e) => e.stopPropagation()}>
            <ul className="flex flex-col">
              {nav.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`flex h-13 items-center border-l-2 px-5 text-[17px] ${isActive(l.href) ? 'border-gold text-ink' : 'border-transparent text-ink-muted'}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto border-t border-line">
              <AccountMenu items={nav.account} big />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function AccountMenu({ items, className = '', big = false }: { items: { href: string; label: string }[]; className?: string; big?: boolean }) {
  const row = big ? 'h-13 px-5 text-[17px]' : 'min-h-11 px-3 text-sm';
  return (
    <ul role="menu" className={`z-50 rounded border border-line bg-surface-2 py-1 ${big ? 'rounded-none border-0 bg-transparent' : ''} ${className}`}>
      {items.map((i) => (
        <li key={i.href + i.label} role="none">
          <Link role="menuitem" href={i.href} className={`flex items-center text-ink-muted hover:text-ink ${row}`}>
            {i.label}
          </Link>
        </li>
      ))}
      <li role="none">
        <form action={signOutAction}>
          <button type="submit" role="menuitem" className={`flex w-full items-center text-left text-red-300 ${row}`}>
            ออกจากระบบ
          </button>
        </form>
      </li>
    </ul>
  );
}
