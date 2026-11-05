import { useSyncExternalStore } from 'react';
import { Info, Search, Volume2, VolumeX } from 'lucide-react';
import { setSoundEnabled, soundEnabled, sounds, subscribeSound } from '../../lib/sounds';

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden>
      <circle cx="22" cy="22" r="19" fill="#5fbcf5" stroke="#1e1b4b" strokeWidth="2.8" />
      <path
        d="M12 15c3-3 7-2 8 0s-1 5 1 7 6 1 7 5-2 7-6 7c-2-2-1-6-5-7s-6-3-6-6 0-4 1-6Z"
        fill="#7ee2a8"
        stroke="#1e1b4b"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M27 9c3 1 6 3 7 7-3 1-5 0-6-1s-2-4-1-6Z" fill="#ffe27a" stroke="#1e1b4b" strokeWidth="1.8" strokeLinejoin="round" />
      <ellipse cx="13" cy="11" rx="4.5" ry="2.2" fill="#fff" opacity="0.8" transform="rotate(-35 13 11)" />
    </svg>
  );
}

export function Brand() {
  return (
    <a href="#" className="group flex items-center gap-2.5" aria-label="World Atlas home">
      <LogoMark className="size-10 transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-[360deg]" />
      <span className="relative leading-none">
        <span className="toon-title block text-[22px]">World Atlas</span>
        <span className="absolute -right-9 -top-3 rotate-12 rounded-full border-2 border-ink bg-sun px-1.5 py-px text-[9.5px] font-black uppercase tracking-wide text-ink shadow-[1.5px_1.5px_0_0_var(--color-ink)]">
          Explorer!
        </span>
      </span>
    </a>
  );
}

export function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="About this atlas and its data sources"
      className="toon-sm toon-press-sm grid size-10 place-items-center rounded-full bg-white text-ink hover:bg-sky-100"
    >
      <Info className="size-[18px]" strokeWidth={2.6} />
    </button>
  );
}

/** Turns the sound effects on and off. */
export function SoundButton() {
  const on = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  return (
    <button
      type="button"
      onClick={() => {
        setSoundEnabled(!on);
        if (!on) sounds.pop();
      }}
      aria-pressed={on}
      aria-label="Sound effects"
      title={on ? 'Mute sound effects' : 'Turn sound effects on'}
      className="toon-sm toon-press-sm grid size-10 place-items-center rounded-full bg-white text-ink hover:bg-sky-100"
    >
      {on ? <Volume2 className="size-[18px]" strokeWidth={2.6} /> : <VolumeX className="size-[18px]" strokeWidth={2.6} />}
    </button>
  );
}

/** Floating top bar for tablet and phone layouts (phones search from the tab bar instead). */
export function TopBar({ onOpenSearch, onOpenAbout }: { onOpenSearch?: () => void; onOpenAbout: () => void }) {
  return (
    <header
      className="toon absolute inset-x-3 z-30 flex h-14 animate-rise items-center gap-3 rounded-2xl bg-white px-2.5"
      style={{ top: 'max(12px, env(safe-area-inset-top))' }}
    >
      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search countries"
          className="toon-sm toon-press-sm grid size-10 place-items-center rounded-xl bg-sun text-ink"
        >
          <Search className="size-[18px]" strokeWidth={2.8} />
        </button>
      )}
      <div className={onOpenSearch ? undefined : 'pl-1.5'}>
        <Brand />
      </div>
      <div className="ml-auto flex gap-2">
        <SoundButton />
        <InfoButton onClick={onOpenAbout} />
      </div>
    </header>
  );
}
