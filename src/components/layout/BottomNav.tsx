import { forwardRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { quizIsNew } from '../game/stats';
import type { ViewMode } from '../map/MapStage';

interface BottomNavProps {
  view: ViewMode;
  /** Tapping the view that's already showing recentres it, like tapping an app's current tab. */
  onView: (view: ViewMode) => void;
  onShuffle: () => void;
  shuffling: boolean;
  canShuffle: boolean;
  onSearch: () => void;
  /** Opens the flag quiz. */
  onPlay: () => void;
  canPlay: boolean;
}

/** Phone tab bar: the two views, a big shuffle button in the middle, the flag quiz and search. */
export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(function BottomNav(
  { view, onView, onShuffle, shuffling, canShuffle, onSearch, onPlay, canPlay },
  ref,
) {
  const slot = view === 'globe' ? 0 : 1;
  return (
    <nav
      ref={ref}
      aria-label="Main"
      className="glass fixed inset-x-0 bottom-0 z-40 animate-rise rounded-t-[26px] border-x-2 border-t-2 border-ink pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(30,27,75,0.12)]"
    >
      <div className="relative mx-auto grid h-[66px] max-w-lg grid-cols-5">
        {/* Sliding highlight behind the active view */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-[8px] grid w-1/5 place-items-center transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ transform: `translateX(${slot * 100}%)` }}
        >
          <span className="h-7 w-14 rounded-full bg-sun shadow-[0_2px_8px_rgba(245,183,0,0.45)]" />
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
          <span className="absolute bottom-[7px] text-[11px] font-bold text-ink">{shuffling ? 'Spinning…' : 'Shuffle'}</span>
        </div>
        <Tab label="Play" emoji="🎮" onClick={onPlay} disabled={!canPlay} badge={quizIsNew() ? 'New' : undefined} />
        <Tab label="Search" emoji="🔍" onClick={onSearch} />
      </div>
    </nav>
  );
});

function Tab({
  label,
  emoji,
  active,
  disabled,
  badge,
  onClick,
}: {
  label: string;
  emoji: ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** A little sticker on the tab, such as "New". */
  badge?: string;
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
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-col items-center justify-start gap-1 pt-[11px] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 disabled:opacity-50"
    >
      {badge && (
        <span className="absolute right-[calc(50%-26px)] top-1 rotate-12 rounded-full border-2 border-ink bg-rose-400 px-1 text-[8.5px] font-bold uppercase leading-[12px] text-white">
          {badge}
        </span>
      )}
      <span aria-hidden className={clsx('text-[21px] leading-none transition-transform duration-300', active && 'scale-110')}>
        {emoji}
      </span>
      <span className={clsx('text-[11px] font-bold leading-none', active ? 'text-ink' : 'text-slate-500')}>{label}</span>
    </button>
  );
}
