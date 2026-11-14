import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { PwaRegistration } from '@/components/pwa-registration';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Vanguard Velocity Delivery | Supply & Logistics',
    template: '%s | Vanguard Velocity Delivery',
  },
  description: 'Reliable bulk off-take partnerships and coordinated distribution for manufacturers and suppliers.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Offtake Portal', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/offtake-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/offtake-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/offtake-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#116149',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegistration />
        {children}
        <PwaInstallPrompt />
        <footer className="border-t border-[var(--line)] bg-[var(--canvas)]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>Vanguard Velocity Delivery · Supply and logistics partnerships</p>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/services/" className="hover:text-[var(--green)]">Services</Link>
              <Link href="/about/" className="hover:text-[var(--green)]">About us</Link>
              <Link href="/mission/" className="hover:text-[var(--green)]">Our mission</Link>
              <Link href="/login/" className="hover:text-[var(--green)]">Portal login</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
