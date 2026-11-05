/**
 * Installable-app support: registers the service worker (src/sw.js), notices when a newer version
 * has arrived, and keeps track of whether, and how, this browser can install the app.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * - 'prompt': the browser can show its install dialog (Chrome, Edge, Samsung Internet…)
 * - 'ios': iPhone and iPad have no install dialog; the app is added from the Share menu
 * - 'safari': Safari on a Mac adds web apps to the Dock from its File menu
 * - 'installed': running as the installed app, or just installed
 * - 'none': this browser can't install it
 */
export type InstallMode = 'prompt' | 'ios' | 'safari' | 'installed' | 'none';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (!navigator.serviceWorker.controller) {
    // On the first visit the country data loads before the worker takes over, so it never passes
    // through it. Once it does take over, hand it the URLs so it can keep them for offline use.
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        const urls = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
          .filter((entry) => entry.initiatorType === 'fetch')
          .map((entry) => entry.name);
        navigator.serviceWorker.controller?.postMessage({ type: 'cache-urls', urls });
      },
      { once: true },
    );
  }
  // A newer version took over while this page still runs an older one (it was opened from the
  // offline copy, or left open for a while): offer to reload. The worker knows whether this page's
  // own script belongs to its version.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const wasControlled = controlled;
    controlled = true;
    const worker = navigator.serviceWorker.controller;
    if (!wasControlled || !worker) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data === false) setUpdateReady();
    };
    worker.postMessage({ type: 'is-current', url: import.meta.url }, [channel.port2]);
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        // An installed app is often resumed rather than reopened, so look for updates when it comes back.
        let lastCheck = Date.now();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60_000) return;
          lastCheck = Date.now();
          registration.update().catch(() => {});
        });
      })
      .catch((err) => console.warn('[atlas] Offline support is unavailable:', err));
  });
}

let updateReady = false;
const updateListeners = new Set<() => void>();

function setUpdateReady() {
  updateReady = true;
  updateListeners.forEach((fn) => fn());
}

/** True once a newer version is ready and this page should reload to show it. */
export const isUpdateReady = () => updateReady;

export function subscribeUpdate(fn: () => void) {
  updateListeners.add(fn);
  return () => updateListeners.delete(fn);
}

const ua = navigator.userAgent;
// iPadOS reports itself as a Mac, so also look for a touch screen.
const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const safariVersion = Number(/Version\/(\d+)[\d.]* Safari/.exec(ua)?.[1] ?? 0);
const isStandalone =
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installMode: InstallMode = isStandalone
  ? 'installed'
  : isIos
    ? 'ios'
    : /Macintosh/.test(ua) && safariVersion >= 17
      ? 'safari'
      : 'none';
const listeners = new Set<() => void>();

function setInstallMode(mode: InstallMode) {
  installMode = mode;
  listeners.forEach((listener) => listener());
}

// Listening at load time, not in a component: the browser can offer the prompt before React renders.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // the app shows its own install button instead of the browser's banner
  deferredPrompt = event as BeforeInstallPromptEvent;
  setInstallMode('prompt');
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  setInstallMode('installed');
});

export const getInstallMode = () => installMode;

export function subscribeInstallMode(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Shows the browser's install dialog. Each prompt can only be used once. */
export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return;
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  setInstallMode(outcome === 'accepted' ? 'installed' : 'none');
}
