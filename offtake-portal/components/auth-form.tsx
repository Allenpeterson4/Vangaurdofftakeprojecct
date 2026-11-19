'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getCurrentPortalUser, PortalApiError } from '@/lib/portal-api';
import type { PortalRole, PortalUser } from '@/lib/auth';

function AuthFeedback({ error }: { error: string }) {
  if (!error) return null;
  return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>;
}

export function LoginForm({
  allowRegistration = true,
  expectedRole,
}: {
  allowRegistration?: boolean;
  expectedRole?: PortalRole;
} = {}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setPending(true);
    try {
      const result = await apiRequest<{ user?: PortalUser }>(
        `auth.php?action=${expectedRole === 'admin' ? 'admin_login' : 'login'}`,
        {
          method: 'POST',
          body: JSON.stringify({
            email: form.get('email'),
            password: form.get('password'),
          }),
        },
      );
      if (!result.user) {
        throw new Error('Sign-in completed without returning an account. Please try again.');
      }

      try {
        const currentUser = await getCurrentPortalUser();
        if (currentUser.id !== result.user.id) {
          throw new Error('The active session did not match the signed-in account. Please try again.');
        }
      } catch (reason) {
        if (reason instanceof PortalApiError && reason.status === 401) {
          throw new Error('Sign-in succeeded, but this browser did not retain the session. Enable cookies for this site and try again.');
        }
        throw reason;
      }

      window.location.assign(result.user.role === 'admin' ? '/admin/' : '/manager/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in. Please try again.');
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      action={`/api/auth.php?action=${expectedRole === 'admin' ? 'admin_login' : 'login'}`}
      onSubmit={(event) => void submit(event)}
      className="space-y-4"
    >
      <label className="block space-y-1.5 text-sm font-semibold">Work email
        <input className="field" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">Password
        <input className="field" name="password" type="password" autoComplete="current-password" required />
      </label>
      <AuthFeedback error={error} />
      <button className="button-primary w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      {allowRegistration && <p className="text-center text-sm text-slate-600">New to the portal? <Link className="font-bold text-[var(--green)] underline" href="/register">Register an account</Link></p>}
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ user?: PortalUser; confirmation_required?: boolean }>('auth.php?action=register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: form.get('full_name'),
          company_name: form.get('company_name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      if (result.confirmation_required) {
        setMessage('Your account and company workspace are set up. Confirm your email to sign in.');
        setPending(false);
        return;
      }
      if (!result.user) throw new Error('The manager account was created, but no sign-in session was returned.');
      router.replace(result.user.role === 'admin' ? '/admin/' : '/manager/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the account.');
      setPending(false);
    }
  }
  return (
    <form method="post" action="/api/auth.php?action=register" onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5 text-sm font-semibold">Full name
        <input className="field" name="full_name" autoComplete="name" minLength={2} maxLength={160} required />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">Company name
        <input className="field" name="company_name" autoComplete="organization" minLength={2} maxLength={160} required />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">Work email
        <input className="field" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">Password
        <input className="field" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={200} required />
        <span className="block text-xs font-normal text-slate-500">Use at least 10 characters.</span>
      </label>
      <p className="text-xs leading-5 text-slate-500">Your company workspace is created and linked automatically when you register.</p>
      <AuthFeedback error={error} />
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message} <Link className="font-bold underline" href="/login">Sign in</Link></p>}
      <button className="button-primary w-full" disabled={pending}>{pending ? 'Creating account…' : 'Create manager account'}</button>
      <p className="text-center text-sm text-slate-600">Already registered? <Link className="font-bold text-[var(--green)] underline" href="/login">Sign in</Link></p>
    </form>
  );
}

export function AdminSetupForm() {
  return (
    <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
      <li>Create the account in Supabase Dashboard → Authentication → Users.</li>
      <li>In SQL Editor, delete its automatically-created manager profile and insert it into <code>offtake_v2_admins</code>. The schema file includes the exact SQL template.</li>
      <li>Sign in at <Link className="font-bold text-[var(--green)] underline" href="/admin/">/admin</Link>.</li>
    </ol>
  );
}
