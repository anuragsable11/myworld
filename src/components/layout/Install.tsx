import { useState } from 'react';
import clsx from 'clsx';
import { Download, Share, X } from 'lucide-react';
import { useInstallMode } from '../../hooks/usePwa';
import { promptInstall, type InstallMode } from '../../lib/pwa';

const DISMISS_KEY = 'atlas:install-dismissed';
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

const canInstall = (mode: InstallMode) => mode === 'prompt' || mode === 'ios' || mode === 'safari';

function readDismissed() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_MS;
  } catch {
    return false;
  }
}

/** Browsers without an install dialog add web apps from their own menus. */
function InstallSteps({ mode, className }: { mode: InstallMode; className?: string }) {
  return (
    <p className={clsx('text-[14px] leading-relaxed text-secondary', className)}>
      {mode === 'ios' ? (
        <>
          Tap <b className="font-semibold text-label">Share</b>{' '}
          <Share className="inline size-4 -translate-y-px text-tint" strokeWidth={2.3} /> (on newer iPhones it's in the{' '}
          <b className="font-semibold text-label">⋯</b> menu), then choose <b className="font-semibold text-label">Add to Home Screen</b>.
        </>
      ) : (
        <>
          In Safari's menu bar, choose <b className="font-semibold text-label">File → Add to Dock</b>.
        </>
      )}
    </p>
  );
}

/** "Install app" button for the welcome card and the About dialog, with steps for Safari. */
export function InstallButton({ className }: { className?: string }) {
  const mode = useInstallMode();
  const [showSteps, setShowSteps] = useState(false);
  if (!canInstall(mode)) return null;

  return (
    <>
      <button
        type="button"
        aria-expanded={mode === 'prompt' ? undefined : showSteps}
        onClick={() => (mode === 'prompt' ? void promptInstall() : setShowSteps((s) => !s))}
        className={clsx(
          'ios-press inline-flex items-center gap-2 rounded-full bg-control px-5 py-2.5 text-[16px] font-semibold text-tint hover:bg-control-strong',
          className,
        )}
      >
        <Download aria-hidden className="size-[18px]" strokeWidth={2.3} />
        Install App
      </button>
      {showSteps && mode !== 'prompt' && (
        <div className="glass-soft mt-3 w-full animate-pop rounded-[18px] px-4 py-3">
          <InstallSteps mode={mode} />
        </div>
      )}
    </>
  );
}

/** Install box for the About dialog. */
export function InstallCard() {
  const mode = useInstallMode();
  if (!canInstall(mode)) return null;
  return (
    <div className="mt-4 rounded-[18px] bg-white/85 p-4">
      <div className="text-[16px] font-semibold text-label">Install World Atlas</div>
      <p className="mt-1 text-[14px] leading-relaxed text-secondary">
        Open it from your home screen or dock like any other app. Countries you've opened before keep working offline.
      </p>
      <div className="mt-3 flex flex-wrap">
        <InstallButton />
      </div>
    </div>
  );
}

/** Floating install pill for phones and tablets. It can be dismissed for a month. */
export function InstallPill() {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showSteps, setShowSteps] = useState(false);
  if (dismissed || !canInstall(mode)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // It will simply show again next time.
    }
  };

  return (
    <div className="relative animate-pop">
      {showSteps && mode !== 'prompt' && (
        <div className="glass absolute bottom-full left-0 mb-3 w-[min(280px,calc(100vw-32px))] animate-pop rounded-[20px] px-4 py-3">
          <div className="mb-1 text-[15px] font-semibold text-label">Add it to your Home Screen</div>
          <InstallSteps mode={mode} />
        </div>
      )}
      <div className="glass flex items-center gap-1 rounded-full p-1">
        <button
          type="button"
          aria-expanded={mode === 'prompt' ? undefined : showSteps}
          onClick={() => (mode === 'prompt' ? void promptInstall() : setShowSteps((s) => !s))}
          className="ios-press flex items-center gap-1.5 rounded-full bg-tint px-3.5 py-1.5 text-[14px] font-semibold text-white"
        >
          <Download aria-hidden className="size-4" strokeWidth={2.4} />
          Install App
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide the install button"
          className="grid size-8 place-items-center rounded-full text-secondary transition-colors hover:bg-control hover:text-label"
        >
          <X className="size-4" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
