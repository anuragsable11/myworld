import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Flame, Plane, X } from 'lucide-react';
import type { Country } from '../../types';
import { useMountains, useSymbols, type CountryIndex } from '../../hooks/queries';
import { useChangeSound } from '../../hooks/useChangeSound';
import { discovered, subscribeDiscoveries } from '../../lib/discoveries';
import { formatDuration } from '../../lib/flight';
import type { World } from '../../lib/geo';
import { haptics } from '../../lib/haptics';
import { gameOn, MAX_GUESSES, mysteryDay, mysteryRecord, mysteryStatus, streakOn, subscribeMystery, untilNextMystery } from '../../lib/mystery';
import { sounds } from '../../lib/sounds';
import { buildTour, CONTINENTS, continentProgress, countriesOf, type Continent, type Tour } from '../../lib/tour';
import { Flag } from '../ui/Flag';
import { Mascot } from './Mascot';

export type PlayPage = 'games' | 'tour';

/**
 * Everything there is to play, in one place: today's Mystery Country, the flag quiz, Globy's tours
 * (which ask where to go first) and flight paths. Opened from the Play tab and the game button.
 */
export default function PlayMenu({
  open,
  page: startPage,
  index,
  world,
  onClose,
  onMystery,
  onQuiz,
  onFlight,
  onTour,
}: {
  open: boolean;
  /** Where it opens: the list of games, or straight at the choice of continent. */
  page: PlayPage;
  index: CountryIndex;
  world: World | undefined;
  onClose: () => void;
  onMystery: () => void;
  onQuiz: () => void;
  onFlight: () => void;
  /** A tour has been planned and can start. */
  onTour: (tour: Tour) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useChangeSound(open, sounds.open, sounds.close);
  const [page, setPage] = useState<PlayPage>(startPage);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setPage(startPage);
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open, startPage]);

  // What the tours' facts are drawn from, beyond the country records: both are files of the app itself.
  const symbols = useSymbols();
  const mountains = useMountains();
  const explored = useSyncExternalStore(subscribeDiscoveries, discovered);
  const record = useSyncExternalStore(subscribeMystery, mysteryRecord);
  const day = mysteryDay();
  const status = mysteryStatus(day, record);
  const streak = streakOn(day, record);
  const next = formatDuration(Math.max(1, Math.round(untilNextMystery() / 60_000)));

  const continents = useMemo(
    () =>
      CONTINENTS.map((continent) => {
        const countries = countriesOf(index, continent);
        // Its three most populous countries stand for it (its biggest, where populations aren't known).
        const faces = [...countries].sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || (b.area ?? 0) - (a.area ?? 0)).slice(0, 3);
        return { continent, faces, ...continentProgress(index, continent, explored) };
      }).filter((c) => c.total > 0),
    [index, explored],
  );

  const go = (action: () => void) => () => {
    haptics.tap();
    action();
  };
  const start = (continent: Continent) => {
    const tour = buildTour(continent, index, { world, symbols: symbols.data, mountains: mountains.data });
    if (!tour) return;
    haptics.select();
    onTour(tour);
  };

  return (
    <dialog
      ref={ref}
      aria-label="Play"
      onClose={() => open && onClose()}
      onCancel={(e) => {
        // Esc or back: from the continents, back to the games first.
        if (page === 'tour' && startPage === 'games') {
          e.preventDefault();
          setPage('games');
        }
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      // An iOS sheet with Settings-style grouped cards, like About.
      className="m-auto w-[min(92vw,440px)] animate-pop rounded-[30px] border-0 bg-[rgb(242_242_247/0.92)] p-0 text-label shadow-[0_24px_70px_rgb(0_0_0/0.3)] backdrop-blur-2xl backdrop-saturate-150 backdrop:bg-black/30 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[88dvh] overflow-y-auto p-4 sm:p-5">
        <div className="flex items-center gap-2">
          {page === 'tour' && startPage === 'games' && (
            <button
              type="button"
              onClick={() => {
                sounds.tap();
                setPage('games');
              }}
              aria-label="Back to the games"
              className="ios-press -ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
            >
              <ChevronLeft className="size-5" strokeWidth={2.6} />
            </button>
          )}
          <h2 className="ios-title min-w-0 flex-1 truncate pl-1 text-[28px]">{page === 'tour' ? "Globy's Tour" : 'Play'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ios-press grid size-9 shrink-0 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
          >
            <X className="size-[18px]" strokeWidth={2.6} />
          </button>
        </div>

        {page === 'games' ? (
          <ul key="games" className="mt-3 animate-fade-in space-y-2.5">
            <Row
              art={<Mascot mood="think" className="w-12" />}
              title="Mystery Country"
              text={
                status === 'new'
                  ? "Globy is hiding in a country. Today's hunt is on!"
                  : status === 'playing'
                    ? `${gameOn(day, record).guesses.length} of ${MAX_GUESSES} guesses used. Keep hunting!`
                    : status === 'won'
                      ? `Solved! A new mystery in ${next}.`
                      : `Missed it. A new mystery in ${next}.`
              }
              badge={
                status === 'new' ? (
                  <span className="rounded-full bg-ios-red px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.03em] text-white">New</span>
                ) : streak > 0 ? (
                  <span className="flex items-center gap-0.5 rounded-full bg-ios-orange/15 px-2 py-0.5 text-[12px] font-bold tabular-nums text-[#b25f00]">
                    <Flame aria-hidden className="size-3.5 fill-ios-orange text-ios-orange" strokeWidth={2} />
                    {streak}
                  </span>
                ) : null
              }
              onClick={go(onMystery)}
            />
            <Row art={<Mascot mood="happy" className="w-12" />} title="Flag Quiz" text="10 flags, from easy to impossible. How far can you get?" onClick={go(onQuiz)} />
            <Row
              art={<Mascot mood="idle" className="w-12" />}
              title="Globy's Tour"
              text="Sit back: Globy flies you round a continent, a fun fact at every stop."
              onClick={() => {
                sounds.tap();
                haptics.tap();
                setPage('tour');
              }}
            />
            <Row
              art={
                <span className="grid size-12 place-items-center rounded-[14px] bg-[linear-gradient(160deg,#64d2ff,#007aff)] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.5)]">
                  <Plane className="size-6" strokeWidth={1.9} />
                </span>
              }
              title="Flight Path"
              text="Pick two countries and watch the plane fly. How far is it?"
              onClick={go(onFlight)}
            />
          </ul>
        ) : (
          <div key="tour" className="animate-fade-in">
            <p className="mt-1 pl-1 text-[15px] leading-snug text-secondary">Where shall we go? Countries you haven't explored come first.</p>
            <ul className="mt-3 grid grid-cols-2 gap-2.5">
              {continents.map(({ continent, faces, total, explored: seen }) => (
                <li key={continent}>
                  <button
                    type="button"
                    onClick={() => start(continent)}
                    // The files with the national symbols and peaks are on their way.
                    disabled={symbols.isLoading || mountains.isLoading}
                    className="ios-press flex w-full flex-col rounded-[20px] bg-white p-3 text-left disabled:opacity-60"
                  >
                    <Faces countries={faces} />
                    <span className="mt-2.5 block truncate text-[17px] font-semibold tracking-[-0.01em]">{continent}</span>
                    <span className="tabular block text-[13px] text-secondary">
                      {seen} of {total} explored
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-control">
                      <span className="block h-full rounded-full bg-tint" style={{ width: `${(seen / total) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </dialog>
  );
}

/** One thing to play: a picture, what it is, and a way in. */
function Row({ art, title, text, badge, onClick }: { art: ReactNode; title: string; text: string; badge?: ReactNode; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="ios-press flex w-full items-center gap-3 rounded-[22px] bg-white p-3 pr-2.5 text-left">
        <span aria-hidden className="grid w-12 shrink-0 place-items-center">
          {art}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-label">{title}</span>
            {badge}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-secondary">{text}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-tertiary" strokeWidth={2.4} />
      </button>
    </li>
  );
}

/** A continent's best-known flags, overlapping like the faces of a group chat. */
function Faces({ countries }: { countries: Country[] }) {
  return (
    <span aria-hidden className="flex h-9 items-center">
      {countries.map((country, i) => (
        <Flag
          key={country.cca3}
          country={country}
          eager
          className={clsx('size-9 shrink-0 rounded-full shadow-[0_0_0_2px_#ffffff,0_1px_3px_rgb(0_0_0/0.2)]', i > 0 && '-ml-2.5')}
        />
      ))}
    </span>
  );
}
