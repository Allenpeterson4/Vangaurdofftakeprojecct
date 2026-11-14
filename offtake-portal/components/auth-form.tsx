'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/portal-api';
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
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const { user } = await apiRequest<{ user: PortalUser }>(`auth.php?action=${expectedRole === 'admin' ? 'admin_login' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      router.replace(user.role === 'admin' ? '/admin/' : '/manager/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
      setPending(false);
    }
  }
  return (
    <form method="post" action={`/api/auth.php?action=${expectedRole === 'admin' ? 'admin_login' : 'login'}`} onSubmit={submit} className="space-y-4">
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
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const { user } = await apiRequest<{ user: PortalUser }>('auth.php?action=register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: form.get('full_name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      router.replace(user.role === 'admin' ? '/admin/' : '/manager/');
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
      <label className="block space-y-1.5 text-sm font-semibold">Work email
        <input className="field" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">Password
        <input className="field" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={200} required />
        <span className="block text-xs font-normal text-slate-500">Use at least 10 characters.</span>
      </label>
      <AuthFeedback error={error} />
      <button className="button-primary w-full" disabled={pending}>{pending ? 'Creating account…' : 'Create manager account'}</button>
      <p className="text-center text-sm text-slate-600">Already registered? <Link className="font-bold text-[var(--green)] underline" href="/login">Sign in</Link></p>
    </form>
  );
}
