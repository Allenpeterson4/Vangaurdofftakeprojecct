'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Boxes, LogOut, Menu, X } from 'lucide-react';
import { apiRequest } from '@/lib/portal-api';
import { PwaInstallButton } from '@/components/pwa-install-button';

export function PortalHeader({ name, role }: { name: string; role?: 'admin' | 'manager' }) {
  const router = useRouter();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    const desktopViewport = window.matchMedia('(min-width: 1280px)');

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    desktopViewport.addEventListener('change', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      desktopViewport.removeEventListener('change', closeOnDesktop);
    };
  }, [menuOpen]);

  async function signOut() {
    setError('');
    setPending(true);
    try {
      await apiRequest('auth.php?action=logout', { method: 'POST', body: '{}' });
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign out.');
      setPending(false);
    }
  }
  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-2 py-2">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 xl:flex-none" onClick={() => setMenuOpen(false)}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--green)] text-white"><Boxes size={20} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold tracking-tight sm:text-sm">Vanguard Velocity Delivery</span>
              <span className="block whitespace-nowrap text-[9px] font-semibold tracking-[.1em] text-[var(--muted)] sm:text-[10px] sm:tracking-[.12em]">SUPPLY &amp; LOGISTICS</span>
            </span>
          </Link>
          {!role && (
            <nav aria-label="Main navigation" className="hidden shrink-0 items-center gap-5 xl:flex">
              <Link href="/" className="text-sm font-semibold text-[var(--ink)] hover:text-[var(--green)]">Home</Link>
              <Link href="/services/" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--green)]">Our Services</Link>
              <Link href="/about/" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--green)]">About Us</Link>
              <Link href="/mission/" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--green)]">Our Mission &amp; Value</Link>
            </nav>
          )}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <PwaInstallButton />
            {role && (
              <>
                <div className="hidden min-w-0 max-w-48 text-right sm:block">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{role === 'admin' ? 'Platform administrator' : 'Company manager'}</p>
                </div>
                <div className="relative">
                  <button type="button" aria-label="Sign out" onClick={() => void signOut()} disabled={pending} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)]"><LogOut size={17} /></button>
                  {error && <p role="alert" className="absolute right-0 mt-2 w-[min(16rem,calc(100vw-1.5rem))] rounded bg-rose-50 p-2 text-xs text-rose-800">{error}</p>}
                </div>
              </>
            )}
            {!role && (
              <>
                <div className="hidden shrink-0 items-center gap-2 xl:flex">
                  <Link href="/login/" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-[var(--green)] hover:bg-[var(--mint)]">Portal Login <ArrowUpRight size={15} /></Link>
                  <Link href="/register/" className="inline-flex items-center justify-center rounded-lg bg-[var(--green)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--green-dark)]">Partner Sign Up</Link>
                </div>
                <button
                  ref={menuButtonRef}
                  type="button"
                  aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={menuOpen}
                  aria-controls="portal-mobile-menu"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)] xl:hidden"
                >
                  {menuOpen ? <X size={19} /> : <Menu size={19} />}
                </button>
              </>
            )}
          </div>
        </div>
        {!role && (
          <nav id="portal-mobile-menu" aria-label="Mobile navigation" className={`${menuOpen ? 'grid' : 'hidden'} gap-1 border-t border-[var(--line)] py-3 xl:hidden`}>
            <Link href="/" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Home</Link>
            <Link href="/services/" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Our Services</Link>
            <Link href="/about/" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">About Us</Link>
            <Link href="/mission/" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Our Mission &amp; Value</Link>
            <div className="mt-2 grid grid-cols-1 gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
              <Link href="/login/" onClick={() => setMenuOpen(false)} className="rounded-lg border border-[var(--line)] px-3 py-3 text-center text-sm font-bold text-[var(--green)] hover:bg-[var(--mint)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Portal Login</Link>
              <Link href="/register/" onClick={() => setMenuOpen(false)} className="rounded-lg bg-[var(--green)] px-3 py-3 text-center text-sm font-bold text-white hover:bg-[var(--green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)]">Partner Sign Up</Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
