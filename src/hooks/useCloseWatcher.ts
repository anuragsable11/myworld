import { useEffect, useRef } from 'react';

interface CloseWatcherLike {
  onclose: ((event: Event) => void) | null;
  destroy(): void;
}
type CloseWatcherConstructor = new () => CloseWatcherLike;

/**
 * While `active`, the Android back button (or Esc) calls `onClose` instead of leaving the page, the
 * way it closes an app's open menus and sheets. Browsers without CloseWatcher simply skip this.
 */
export function useCloseWatcher(active: boolean, onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    const Watcher = (window as unknown as { CloseWatcher?: CloseWatcherConstructor }).CloseWatcher;
    if (!active || typeof Watcher !== 'function') return;
    let watcher: CloseWatcherLike;
    try {
      watcher = new Watcher();
    } catch {
      return;
    }
    watcher.onclose = () => latest.current();
    return () => watcher.destroy();
  }, [active]);
}
