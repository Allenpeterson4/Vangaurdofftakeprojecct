'use client';

import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Unable to register the offline app worker.', error);
      });
    }
  }, []);

  return null;
}
