'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { PortalRole } from '@/lib/auth';
import { apiRequest } from '@/lib/portal-api';

export function AccountMenu({
  name,
  email,
  role,
}: {
  name: string;
  email?: string;
  role: PortalRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
        setSecurityOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setSecurityOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setSecurityOpen(false);
  }

  async function signOut() {
    setLogoutError('');
    setLogoutPending(true);
    try {
      await apiRequest('auth.php?action=logout', { method: 'POST', body: '{}' });
      router.replace('/');
    } catch (reason) {
      setLogoutError(reason instanceof Error ? reason.message : 'Unable to sign out.');
      setLogoutPending(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = form.get('current_password');
    const password = form.get('password');
    const passwordConfirmation = form.get('password_confirmation');
    setError('');
    setSuccess('');

    if (typeof password !== 'string' || password !== passwordConfirmation) {
      setError('The new passwords do not match.');
      return;
    }

    setPending(true);
    try {
      await apiRequest('auth.php?action=change_password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, password }),
      });
      formElement.reset();
      setSuccess('Password updated successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update your password.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Account settings for ${name}`}
        aria-expanded={open}
        aria-controls={open ? 'account-settings-panel' : undefined}
        onClick={() => {
          if (open) setSecurityOpen(false);
          setOpen((isOpen) => !isOpen);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] px-2 text-[var(--ink)] transition-colors hover:bg-[var(--mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)] sm:px-2.5"
      >
        <UserRound size={17} className="shrink-0 text-[var(--green)]" aria-hidden="true" />
        <span className="hidden min-w-0 max-w-36 text-right sm:block">
          <span className="block truncate text-xs font-semibold">{name}</span>
          <span className="block truncate text-[10px] text-[var(--muted)]">{role === 'admin' ? 'Platform administrator' : 'Company manager'}</span>
        </span>
        <ChevronDown size={14} className="hidden shrink-0 text-[var(--muted)] sm:block" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="account-settings-panel"
          role="dialog"
          aria-label="Account and security settings"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--line)] bg-white p-4 text-left shadow-xl sm:p-5"
        >
          <div className="flex items-start gap-3 border-b border-[var(--line)] pb-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><UserRound size={20} /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{name}</p>
              {email && <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{email}</p>}
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--green)]">{role === 'admin' ? 'Administrator account' : 'Manager account'}</p>
            </div>
          </div>

          {role === 'admin' && (
            <Link
              href="/admin/#manager-users"
              onClick={closeMenu}
              className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]"
            >
              <Users size={16} className="text-[var(--green)]" aria-hidden="true" />
              User management
            </Link>
          )}

          <button
            type="button"
            aria-expanded={securityOpen}
            onClick={() => {
              setSecurityOpen((isOpen) => !isOpen);
              setError('');
              setSuccess('');
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)]"
          >
            <ShieldCheck size={16} className="text-[var(--green)]" aria-hidden="true" />
            Security settings
          </button>

          {securityOpen && (
            <form onSubmit={(event) => void changePassword(event)} className="mt-3 space-y-3 border-t border-[var(--line)] pt-4">
              <p className="text-xs leading-5 text-[var(--muted)]">Verify your current password before choosing a new one.</p>
              <label className="block text-xs font-semibold text-[var(--ink)]">
                Current password
                <input className="field mt-1" name="current_password" type="password" autoComplete="current-password" maxLength={200} required />
              </label>
              <label className="block text-xs font-semibold text-[var(--ink)]">
                New password
                <input className="field mt-1" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={200} required />
              </label>
              <label className="block text-xs font-semibold text-[var(--ink)]">
                Confirm new password
                <input className="field mt-1" name="password_confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={200} required />
              </label>
              <button type="submit" className="button-primary w-full" disabled={pending}>
                {pending ? 'Updating password…' : 'Update password'}
              </button>
              {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800">{error}</p>}
              {success && <p role="status" className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800">{success}</p>}
            </form>
          )}

          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={logoutPending}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-[var(--green)] disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut size={16} className="text-[var(--green)]" aria-hidden="true" />
              {logoutPending ? 'Signing out…' : 'Sign out'}
            </button>
            {logoutError && <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800">{logoutError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
