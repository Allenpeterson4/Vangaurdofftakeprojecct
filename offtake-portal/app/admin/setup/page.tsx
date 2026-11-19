import Link from 'next/link';
import { AdminSetupForm } from '@/components/auth-form';
import { PortalHeader } from '@/components/portal-header';

export default function AdminSetupPage() {
  return (
    <>
      <PortalHeader name="Administrator setup" />
      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl place-items-center px-4 py-12 sm:px-6">
        <section className="surface w-full max-w-md p-6 sm:p-8">
          <Link href="/admin/" className="text-xs font-bold uppercase tracking-wider text-[var(--green)]">← Administrator sign in</Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Set up administrator access</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Administrator privileges must be granted from the trusted Supabase SQL Editor. They cannot be created through the public login page.</p>
          <div className="mt-7"><AdminSetupForm /></div>
        </section>
      </main>
    </>
  );
}
