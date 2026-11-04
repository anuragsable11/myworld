import { useSyncExternalStore } from 'react';
import { getInstallMode, subscribeInstallMode } from '../lib/pwa';

export const useInstallMode = () => useSyncExternalStore(subscribeInstallMode, getInstallMode);

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** Whether the browser thinks it has a network connection. */
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine);
