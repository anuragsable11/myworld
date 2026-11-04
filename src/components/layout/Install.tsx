import { useState } from 'react';
import clsx from 'clsx';
import { Share, X } from 'lucide-react';
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
    <p className={clsx('text-[13px] font-semibold leading-relaxed text-slate-600', className)}>
      {mode === 'ios' ? (
        <>
          Tap <b className="text-ink">Share</b>{' '}
          <Share className="inline size-4 -translate-y-px text-sky-600" strokeWidth={2.6} /> (on newer
          iPhones it's in the <b className="text-ink">⋯</b> menu), then choose <b className="text-ink">Add to Home Screen</b> ➕
        </>
      ) : (
        <>
          In Safari's menu bar, choose <b className="text-ink">File → Add to Dock</b> 🚀
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
          'toon toon-press inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 font-display text-[17px] font-semibold text-ink hover:bg-sky-100',
          className,
        )}
      >
        <span aria-hidden className="text-[20px]">
          📲
        </span>
        Install app
      </button>
      {showSteps && mode !== 'prompt' && (
        <div className="toon-sm mt-3 w-full animate-pop rounded-2xl bg-white px-4 py-3">
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
    <div className="toon mt-4 rounded-2xl bg-amber-100 p-4">
      <div className="font-extrabold text-ink">📲 Install World Atlas</div>
      <p className="mt-1 text-[13.5px] font-semibold leading-relaxed text-ink/70">
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
        <div className="toon absolute bottom-full left-0 mb-3 w-[min(280px,calc(100vw-32px))] animate-pop rounded-2xl bg-white px-4 py-3">
          <div className="toon-title mb-1 text-[15px]">Add it to your home screen</div>
          <InstallSteps mode={mode} />
        </div>
      )}
      <div className="toon flex items-center gap-1 rounded-full bg-white p-1">
        <button
          type="button"
          aria-expanded={mode === 'prompt' ? undefined : showSteps}
          onClick={() => (mode === 'prompt' ? void promptInstall() : setShowSteps((s) => !s))}
          className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-sun px-3.5 py-1 font-display text-[14px] font-semibold text-ink transition-transform active:translate-y-px"
        >
          <span aria-hidden className="text-[16px]">
            📲
          </span>
          Install app
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide the install button"
          className="grid size-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-pink-100 hover:text-ink"
        >
          <X className="size-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
