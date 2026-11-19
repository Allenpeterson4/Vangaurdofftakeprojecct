'use client';

import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        const results = await Promise.all(registrations.map((registration) => registration.unregister()));
        if (results.some(Boolean) && navigator.serviceWorker.controller) window.location.reload();
      }).catch((error: unknown) => {
        console.error('Unable to disable the offline app worker during development.', error);
      });
      return;
    }

    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Unable to register the offline app worker.', error);
    });
  }, []);

  return null;
}
