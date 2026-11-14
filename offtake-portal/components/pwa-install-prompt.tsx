'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'offtake-install-prompt-dismissed';

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && navigator.standalone === true);
    let revealFrame = 0;
    try {
      if (!standalone && window.localStorage.getItem(DISMISSED_KEY) !== '1') {
        revealFrame = window.requestAnimationFrame(() => setVisible(true));
      }
    } catch (error) {
      console.warn('Unable to read the app install preference.', error);
      if (!standalone) revealFrame = window.requestAnimationFrame(() => setVisible(true));
    }

    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setVisible(false);
    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      if (revealFrame) window.cancelAnimationFrame(revealFrame);
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setHelpOpen((open) => !open);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setVisible(false);
      setInstallPrompt(null);
    } catch (error) {
      console.error('Unable to show the app installation prompt.', error);
      setHelpOpen(true);
    }
  }

  function dismiss() {
    setVisible(false);
    setHelpOpen(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch (error) {
      console.warn('Unable to save the app install preference.', error);
    }
  }

  if (!visible) return null;

  return (
    <aside aria-label="Install the portal app" className="border-t border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mint)] text-[var(--green)]"><Download size={19} /></span>
          <div>
            <p className="text-sm font-bold">Take the portal to the factory floor</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">Install it on your phone for one-tap access to dispatch updates and delivery tracking. The app shell also opens when your connection is limited.</p>
            {helpOpen && (
              <p role="status" className="mt-2 max-w-2xl rounded-lg bg-[var(--canvas)] p-3 text-xs leading-5 text-[var(--muted)]">
                In your browser menu, choose <strong className="text-[var(--ink)]">Install app</strong> or <strong className="text-[var(--ink)]">Add to Home Screen</strong>. On iPhone or iPad, open this page in Safari, tap Share, then choose Add to Home Screen.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
          <button type="button" onClick={() => void installApp()} className="rounded-lg bg-[var(--green)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--green-dark)]">
            {installPrompt ? 'Install app' : helpOpen ? 'Hide instructions' : 'Add to home screen'}
          </button>
          <button type="button" onClick={dismiss} aria-label="Dismiss install app message" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--canvas)]">
            <X size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
