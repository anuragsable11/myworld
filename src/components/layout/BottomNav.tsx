import { forwardRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import type { ViewMode } from '../map/MapStage';

interface BottomNavProps {
  view: ViewMode;
  /** Tapping the view that's already showing recentres it, like tapping an app's current tab. */
  onView: (view: ViewMode) => void;
  onShuffle: () => void;
  shuffling: boolean;
  canShuffle: boolean;
  onSearch: () => void;
  night: boolean;
  onNight: () => void;
}

/** Phone tab bar: the two views, a big shuffle button in the middle, search and day/night. */
export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(function BottomNav(
  { view, onView, onShuffle, shuffling, canShuffle, onSearch, night, onNight },
  ref,
) {
  const slot = view === 'globe' ? 0 : 1;
  return (
    <nav
      ref={ref}
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 animate-rise rounded-t-[26px] border-x-[3px] border-t-[3px] border-ink bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_0_0_rgba(30,27,75,0.12)]"
    >
      <div className="relative mx-auto grid h-[66px] max-w-lg grid-cols-5">
        {/* Sliding highlight behind the active view */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-[8px] grid w-1/5 place-items-center transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ transform: `translateX(${slot * 100}%)` }}
        >
          <span className="h-7 w-14 rounded-full border-2 border-ink bg-sun" />
        </span>
        <Tab label="Globe" emoji="🌍" active={view === 'globe'} onClick={() => onView('globe')} />
        <Tab label="Map" emoji="🗺️" active={view === 'map'} onClick={() => onView('map')} />
        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={() => {
              // The spin itself whooshes, so no pop here.
              haptics.tap();
              onShuffle();
            }}
            disabled={!canShuffle || shuffling}
            aria-label="Shuffle: spin to a random country"
            className={clsx(
              'toon absolute -top-7 grid size-[66px] place-items-center rounded-full bg-sun transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90',
              !canShuffle && 'opacity-50',
            )}
          >
            <span aria-hidden className={clsx('text-[32px] leading-none', shuffling && 'animate-dice-roll')}>
              🎲
            </span>
          </button>
          <span className="absolute bottom-[7px] text-[11px] font-extrabold text-ink">{shuffling ? 'Spinning…' : 'Shuffle'}</span>
        </div>
        <Tab label="Search" emoji="🔍" onClick={onSearch} />
        <Tab label="Night" emoji={night ? '🌙' : '☀️'} pressed={night} onClick={onNight} />
      </div>
    </nav>
  );
});

function Tab({
  label,
  emoji,
  active,
  pressed,
  onClick,
}: {
  label: string;
  emoji: ReactNode;
  active?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptics.tap();
        sounds.pop();
        onClick();
      }}
      aria-current={active ? 'page' : undefined}
      aria-pressed={pressed}
      className="relative flex flex-col items-center justify-start gap-1 pt-[11px] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90"
    >
      <span aria-hidden className={clsx('text-[21px] leading-none transition-transform duration-300', active && 'scale-110')}>
        {emoji}
      </span>
      <span className={clsx('text-[11px] font-extrabold leading-none', active ? 'text-ink' : 'text-slate-500')}>{label}</span>
    </button>
  );
}
