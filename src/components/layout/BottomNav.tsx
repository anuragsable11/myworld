import { forwardRef } from 'react';
import clsx from 'clsx';
import { Dices, Gamepad2, Globe, Map as MapIcon, Plane, Search, type LucideIcon } from 'lucide-react';
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
  /** Opens the flight planner. */
  onFly: () => void;
  /** A flight is being shown on the globe. */
  flying: boolean;
  canPlay: boolean;
}

/**
 * Phone tab bar, as in iOS 26: a floating glass capsule with the two views, shuffle, flights and
 * the flag quiz, and search in its own round button beside it. The page shows through behind it.
 */
export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(function BottomNav(
  { view, onView, onShuffle, shuffling, canShuffle, onSearch, onPlay, onFly, flying, canPlay },
  ref,
) {
  const slot = view === 'globe' ? 0 : 1;
  return (
    <nav
      ref={ref}
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex animate-rise items-end gap-2.5 px-3.5 pb-[max(10px,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="glass pointer-events-auto relative mx-auto grid h-[62px] max-w-md flex-1 grid-cols-5 rounded-full p-1">
        {/* The lens behind the view that is showing */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-8px)/5)] rounded-full bg-control transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ transform: `translateX(${slot * 100}%)` }}
        />
        {/* Switching views has its own whoosh (and tapping the current one, a zoom out). */}
        <Tab label="Globe" icon={Globe} active={view === 'globe'} quiet onClick={() => onView('globe')} />
        <Tab label="Map" icon={MapIcon} active={view === 'map'} quiet onClick={() => onView('map')} />
        <Tab
          label={shuffling ? 'Spinning' : 'Shuffle'}
          icon={Dices}
          spinning={shuffling}
          disabled={!canShuffle || shuffling}
          // The spin itself whooshes, so no pop here.
          quiet
          onClick={onShuffle}
        />
        {/* The planner makes its own sound as it slides open. */}
        <Tab label="Fly" icon={Plane} tinted={flying} quiet onClick={onFly} disabled={!canPlay} />
        <Tab label="Play" icon={Gamepad2} onClick={onPlay} disabled={!canPlay} badge={quizIsNew()} />
      </div>
      <button
        type="button"
        onClick={() => {
          // The drawer makes its own sound as it slides open.
          haptics.tap();
          onSearch();
        }}
        aria-label="Search countries"
        className="glass ios-press pointer-events-auto grid size-[62px] shrink-0 place-items-center rounded-full text-label"
      >
        <Search className="size-[23px]" strokeWidth={2.2} />
      </button>
    </nav>
  );
});

function Tab({
  label,
  icon: Icon,
  active,
  tinted,
  disabled,
  badge,
  spinning,
  quiet,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Coloured like the current tab without being it: something of its kind is under way. */
  tinted?: boolean;
  disabled?: boolean;
  /** A red dot on the tab, as iOS marks something new. */
  badge?: boolean;
  spinning?: boolean;
  /** No tap sound (the action makes its own). */
  quiet?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptics.tap();
        if (!quiet) sounds.tap();
        onClick();
      }}
      disabled={disabled && !spinning}
      aria-disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'relative flex flex-col items-center justify-center gap-[3px] rounded-full transition-[transform,color] duration-200 active:scale-90 disabled:opacity-40',
        active || tinted ? 'text-tint' : 'text-label',
        spinning && 'pointer-events-none',
      )}
    >
      <span className="relative">
        <Icon className={clsx('size-[23px]', spinning && 'animate-dice-roll')} strokeWidth={active ? 2.3 : 2} />
        {badge && <span className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-ios-red ring-2 ring-white/80" />}
      </span>
      <span className="text-[10.5px] font-medium leading-none tracking-[0.01em]">{label}</span>
    </button>
  );
}
