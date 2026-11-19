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

const themeBootstrap = `(() => {
  const storageKey = 'vanguard-portal-theme';
  const root = document.documentElement;
  try {
    root.dataset.theme = localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.error('Unable to read the saved portal theme.', error);
    root.dataset.theme = 'light';
  }
  document.addEventListener('click', (event) => {
    const target = event.target;
    const button = target instanceof Element ? target.closest('[data-theme-toggle]') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = theme;
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme');
    button.title = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme';
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      console.error('Unable to save the portal theme preference.', error);
    }
    document.dispatchEvent(new Event('portal-theme-change'));
  });
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <PwaRegistration />
        {children}
        <PwaInstallPrompt />
        <footer className="site-footer">
          <div className="site-footer-inner mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="site-footer-main">
              <div className="site-footer-brand">
                <span aria-hidden="true" className="site-footer-mark">VV</span>
                <div>
                  <p className="site-footer-name">Vanguard Velocity Delivery</p>
                  <p className="site-footer-tagline">Supply chain coordination, built around you.</p>
                </div>
              </div>
              <nav aria-label="Footer navigation" className="site-footer-nav">
                <Link href="/services/" className="site-footer-link">Services</Link>
                <Link href="/about/" className="site-footer-link">About us</Link>
                <Link href="/mission/" className="site-footer-link">Our mission</Link>
                <Link href="/login/" className="site-footer-link">Portal login</Link>
              </nav>
            </div>
            <div className="site-footer-bottom">
              <span>Reliable off-take. Coordinated delivery.</span>
              <span>© {new Date().getFullYear()} Vanguard Velocity Delivery</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
