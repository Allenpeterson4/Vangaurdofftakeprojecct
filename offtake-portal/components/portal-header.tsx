'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Boxes, Menu, X } from 'lucide-react';
import { PwaInstallButton } from '@/components/pwa-install-button';
import { TeamSwitcher } from '@/components/team-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AccountMenu } from '@/components/account-menu';

export function PortalHeader({
  name,
  email,
  role,
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
}: {
  name: string;
  email?: string;
  role?: 'admin' | 'manager';
  workspaces?: { id: string; name: string }[];
  activeWorkspaceId?: string | null;
  onWorkspaceChange?: () => void;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        closeMenu();
      }
    };
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeMenu();
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

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-2 py-2">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 xl:flex-none" onClick={() => setMenuOpen(false)}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--mint)] text-[var(--green)]"><Boxes size={19} strokeWidth={2.25} /></span>
            <span className={`min-w-0 ${role ? 'hidden sm:block' : ''}`}>
              <span className="block whitespace-nowrap text-[12px] font-bold tracking-tight sm:text-sm">Vanguard Velocity Delivery</span>
              <span className="block whitespace-nowrap text-[8px] font-semibold tracking-[.12em] text-[var(--muted)] sm:text-[10px] sm:tracking-[.12em]">SUPPLY &amp; LOGISTICS</span>
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
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {role === 'manager' && workspaces && activeWorkspaceId && onWorkspaceChange && (
              <TeamSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} onWorkspaceChange={onWorkspaceChange} />
            )}
            <ThemeSwitcher />
            {role ? <PwaInstallButton /> : <div className="hidden xl:block"><PwaInstallButton /></div>}
            {role && (
              <>
                <AccountMenu name={name} email={email} role={role} />
              </>
            )}
            {!role && (
              <>
                <div className="hidden shrink-0 items-center gap-2 xl:flex">
                  <Link href="/login/" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-[var(--green)] hover:bg-[var(--mint)]">Portal Login <ArrowUpRight size={15} /></Link>
                  <Link href="/register/" className="inline-flex items-center justify-center rounded-lg bg-[var(--green)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--green-dark)]">Partner Sign Up</Link>
                </div>
                <details
                  ref={mobileMenuRef}
                  open={menuOpen}
                  onToggle={(event) => setMenuOpen(event.currentTarget.open)}
                  className="mobile-menu relative xl:hidden"
                >
                  <summary
                    ref={menuButtonRef}
                    aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    aria-controls="portal-mobile-menu"
                    className="grid h-10 w-10 shrink-0 cursor-pointer list-none place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)]"
                  >
                    {menuOpen ? <X size={19} /> : <Menu size={19} />}
                  </summary>
                  <nav id="portal-mobile-menu" aria-label="Mobile navigation" className="absolute right-0 top-full z-50 mt-2 grid w-[min(24rem,calc(100vw-1.5rem))] gap-1 rounded-2xl border border-[var(--line)] bg-white px-2 py-3 shadow-xl xl:hidden">
                    <Link href="/" onClick={closeMenu} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Home</Link>
                    <Link href="/services/" onClick={closeMenu} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Our Services</Link>
                    <Link href="/about/" onClick={closeMenu} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">About Us</Link>
                    <Link href="/mission/" onClick={closeMenu} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Our Mission &amp; Value</Link>
                    <div className="px-3 pt-2">
                      <PwaInstallButton placement="menu" />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
                      <Link href="/login/" onClick={closeMenu} className="rounded-lg border border-[var(--line)] px-3 py-3 text-center text-sm font-bold text-[var(--green)] hover:bg-[var(--mint)] focus-visible:outline-2 focus-visible:outline-[var(--green)]">Portal Login</Link>
                      <Link href="/register/" onClick={closeMenu} className="rounded-lg bg-[var(--green)] px-3 py-3 text-center text-sm font-bold text-white hover:bg-[var(--green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)]">Partner Sign Up</Link>
                    </div>
                  </nav>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
