'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'vanguard-portal-theme';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function getServerThemeSnapshot(): Theme {
  return 'light';
}

function readSavedTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch (reason) {
    console.error('Unable to read the saved portal theme.', reason);
    return 'light';
  }
}

function notifyThemeChange() {
  document.dispatchEvent(new Event('portal-theme-change'));
}

function subscribeToTheme(listener: () => void) {
  document.addEventListener('portal-theme-change', listener);
  return () => {
    document.removeEventListener('portal-theme-change', listener);
  };
}

function syncStoredTheme(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  applyTheme(event.newValue === 'dark' ? 'dark' : 'light');
  notifyThemeChange();
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    applyTheme(readSavedTheme());
    notifyThemeChange();
    window.addEventListener('storage', syncStoredTheme);
    return () => window.removeEventListener('storage', syncStoredTheme);
  }, []);

  return (
    <button
      type="button"
      data-theme-toggle
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-xl border border-[var(--line)] text-[var(--green)] transition-colors hover:bg-[var(--mint)] active:bg-[var(--mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green)]"
    >
      <Moon size={18} aria-hidden="true" className="theme-icon-moon" />
      <Sun size={18} aria-hidden="true" className="theme-icon-sun" />
    </button>
  );
}
