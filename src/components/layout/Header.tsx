import { useSyncExternalStore, type ReactNode } from 'react';
import clsx from 'clsx';
import { Earth, Info, Moon, Search, Sun, Volume2, VolumeX } from 'lucide-react';
import { haptics } from '../../lib/haptics';
import { setSoundEnabled, soundEnabled, sounds, subscribeSound } from '../../lib/sounds';

/** The app's icon, drawn the way iOS draws one: a rounded square with a soft gradient and a white glyph. */
function AppIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'grid shrink-0 place-items-center rounded-[23%] bg-[linear-gradient(165deg,#64d2ff_0%,#0a84ff_52%,#0040dd_100%)] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.55),0_1px_3px_rgb(0_0_0/0.18)]',
        className,
      )}
    >
      <Earth className="size-[64%]" strokeWidth={1.9} />
    </span>
  );
}

/** App icon and name: a large title in the desktop sidebar, a compact one in the floating top bar. */
export function Brand({ large }: { large?: boolean }) {
  return (
    <a href="#" className="flex min-w-0 items-center gap-2.5" aria-label="World Atlas home">
      <AppIcon className={large ? 'size-10' : 'size-8'} />
      {/* Very narrow phones show just the icon, to leave room for the buttons. */}
      <span className={clsx('ios-title truncate max-[379px]:hidden', large ? 'text-[24px]' : 'text-[17px] font-semibold')}>World Atlas</span>
    </a>
  );
}

/** A round icon button, as in an iOS navigation bar. `active` tints it, for a mode that is switched on. */
function BarButton({
  label,
  title,
  pressed,
  active,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  pressed?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? label}
      className={clsx(
        'ios-press grid size-10 shrink-0 place-items-center rounded-full transition-colors',
        active ? 'bg-tint/15 text-tint' : 'text-label hover:bg-control',
      )}
    >
      {children}
    </button>
  );
}

export function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <BarButton
      label="About this atlas and its data sources"
      title="About"
      // The dialog makes its own sound as it opens.
      onClick={() => {
        haptics.tap();
        onClick();
      }}
    >
      <Info className="size-[21px]" strokeWidth={2} />
    </BarButton>
  );
}

/** Turns the sound effects on and off. */
export function SoundButton() {
  const on = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  return (
    <BarButton
      label="Sound effects"
      title={on ? 'Mute sound effects' : 'Turn sound effects on'}
      pressed={on}
      onClick={() => {
        // The switch is heard either way: before muting, or once sound is back on.
        haptics.toggle();
        if (on) sounds.toggle(false);
        setSoundEnabled(!on);
        if (!on) sounds.toggle(true);
      }}
    >
      {on ? <Volume2 className="size-[21px]" strokeWidth={2} /> : <VolumeX className="size-[21px]" strokeWidth={2} />}
    </BarButton>
  );
}

/** Shows or hides the live night side of the Earth. */
export function NightButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <BarButton
      label="Live day and night"
      title={on ? 'Hide live day & night' : 'Show live day & night'}
      pressed={on}
      active={on}
      // Toggling night makes its own switch sound and tap.
      onClick={onClick}
    >
      {on ? <Moon className="size-[20px]" strokeWidth={2} /> : <Sun className="size-[21px]" strokeWidth={2} />}
    </BarButton>
  );
}

/**
 * Floating glass bar for tablet and phone layouts, as in iOS (phones search from the tab bar
 * instead, and get the day/night switch here).
 */
export function TopBar({
  onOpenSearch,
  onOpenAbout,
  night,
  onNight,
}: {
  onOpenSearch?: () => void;
  onOpenAbout: () => void;
  night?: boolean;
  onNight?: () => void;
}) {
  return (
    <header
      className="glass absolute inset-x-3 z-30 flex h-[52px] animate-rise items-center gap-1 rounded-full pl-2.5 pr-1.5"
      style={{ top: 'max(10px, env(safe-area-inset-top))' }}
    >
      {onOpenSearch && (
        <BarButton
          label="Search countries"
          onClick={() => {
            haptics.tap();
            onOpenSearch();
          }}
        >
          <Search className="size-[20px] text-tint" strokeWidth={2.2} />
        </BarButton>
      )}
      <div className={clsx('min-w-0', onOpenSearch && 'pl-1')}>
        <Brand />
      </div>
      <div className="ml-auto flex">
        {onNight && <NightButton on={!!night} onClick={onNight} />}
        <SoundButton />
        <InfoButton onClick={onOpenAbout} />
      </div>
    </header>
  );
}
