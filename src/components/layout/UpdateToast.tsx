import { useSyncExternalStore } from 'react';
import { isUpdateReady, subscribeUpdate } from '../../lib/pwa';

/** Shown when a newer version of the app has arrived while an older one is running. */
export function UpdateToast({ top }: { top: number }) {
  const ready = useSyncExternalStore(subscribeUpdate, isUpdateReady, () => false);
  if (!ready) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top }}>
      <button
        type="button"
        onClick={() => location.reload()}
        className="toon toon-press pointer-events-auto animate-pop rounded-full bg-sun px-4 py-2 font-display text-[14px] font-semibold text-ink"
      >
        ✨ A new version is here! Tap to update
      </button>
    </div>
  );
}
