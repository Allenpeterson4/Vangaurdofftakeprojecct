'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalHeader } from '@/components/portal-header';
import { RegisterForm } from '@/components/auth-form';
import { getCurrentPortalUser, PortalApiError } from '@/lib/portal-api';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getCurrentPortalUser().then((profile) => {
      router.replace(profile.role === 'admin' ? '/admin/' : '/manager/');
    }).catch((reason: unknown) => {
      if (!(reason instanceof PortalApiError && reason.status === 401) && active) {
        setError(reason instanceof Error ? reason.message : 'Unable to verify your session.');
      }
    });
    return () => { active = false; };
  }, [router]);
  return (
    <>
      <PortalHeader name="Manager registration" />
      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl place-items-center px-4 py-12 sm:px-6">
        <section className="surface w-full max-w-md p-6 sm:p-8">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-[var(--green)]">← Back to overview</Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Create a manager account</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Register with your work email. A platform administrator will assign your company before you can access allocations.</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="mt-7"><RegisterForm /></div>
        </section>
      </main>
    </>
  );
}
