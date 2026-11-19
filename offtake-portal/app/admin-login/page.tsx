'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/');
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <p className="text-sm text-[var(--muted)]">
        Administrator sign in is now at <Link href="/admin/" className="font-semibold text-[var(--green)] underline">/admin</Link>.
      </p>
    </main>
  );
}
