import { useSyncExternalStore } from 'react';

/** The notch and home-indicator insets, in CSS px (zero outside an installed app on a phone with them). */
export interface SafeArea {
  top: number;
  bottom: number;
}

let probe: HTMLDivElement | null = null;
let cached: SafeArea = { top: 0, bottom: 0 };

function read(): SafeArea {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.append(probe);
  }
  const style = getComputedStyle(probe);
  const next = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
  if (next.top !== cached.top || next.bottom !== cached.bottom) cached = next;
  return cached;
}

export function useSafeArea(): SafeArea {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('resize', onChange);
      return () => window.removeEventListener('resize', onChange);
    },
    read,
    () => cached,
  );
}
