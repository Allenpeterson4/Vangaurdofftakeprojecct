'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function subscribeInstalled(callback: () => void) {
  const displayMode = window.matchMedia('(display-mode: standalone)');
  displayMode.addEventListener('change', callback);
  window.addEventListener('appinstalled', callback);
  return () => {
    displayMode.removeEventListener('change', callback);
    window.removeEventListener('appinstalled', callback);
  };
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && navigator.standalone === true);
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const installed = useSyncExternalStore(subscribeInstalled, isInstalled, () => false);

  useEffect(() => {
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setHelpOpen(false);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
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
      if (choice.outcome === 'accepted') setHelpOpen(false);
      setInstallPrompt(null);
    } catch (error) {
      console.error('Unable to open the app installation prompt.', error);
      setHelpOpen(true);
    }
  }

  if (installed) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void installApp()}
        aria-label="Download app"
        aria-expanded={helpOpen}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-2 py-2 text-sm font-bold text-[var(--green)] hover:bg-[var(--mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)] sm:h-auto sm:w-auto sm:px-3"
      >
        <Download size={16} />
        <span className="sr-only sm:not-sr-only">Download app</span>
      </button>
      {helpOpen && (
        <div role="status" className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--line)] bg-white p-4 text-xs leading-5 text-[var(--muted)] shadow-lg">
          In your browser menu choose <strong className="text-[var(--ink)]">Install app</strong> or <strong className="text-[var(--ink)]">Add to Home Screen</strong>. On iPhone or iPad, open this page in Safari, tap Share, then choose Add to Home Screen.
        </div>
      )}
    </div>
  );
}
