import Link from 'next/link';
import { LoginForm } from '@/components/auth-form';
import { PortalHeader } from '@/components/portal-header';

export default function AdminLoginPage() {
  return (
    <>
      <PortalHeader name="Platform administrator" />
      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl place-items-center px-4 py-12 sm:px-6">
        <section className="surface w-full max-w-md p-6 sm:p-8">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-[var(--green)]">← Back to overview</Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Administrator sign in</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Sign in with your platform administrator account to manage suppliers and allocations.</p>
          <div className="mt-7"><LoginForm allowRegistration={false} expectedRole="admin" /></div>
        </section>
      </main>
    </>
  );
}
