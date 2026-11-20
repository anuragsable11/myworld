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
        className="ios-press pointer-events-auto animate-pop rounded-full bg-tint px-4 py-2 text-[14px] font-semibold text-white shadow-[0_6px_20px_rgb(0_122_255/0.35)]"
      >
        A new version is ready. Tap to update
      </button>
    </div>
  );
}
