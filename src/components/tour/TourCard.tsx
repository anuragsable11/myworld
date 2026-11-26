import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { ArrowRight, ChevronLeft, ChevronRight, Map as MapIcon, Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import type { CountryIndex } from '../../hooks/queries';
import { discovered, subscribeDiscoveries } from '../../lib/discoveries';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { continentProgress, readingMs, type Tour } from '../../lib/tour';
import { Mascot } from '../game/Mascot';
import { Bubble } from '../game/shared';
import { Flag } from '../ui/Flag';
import { WavingFlag } from '../ui/WavingFlag';

interface TourCardProps {
  tour: Tour;
  index: CountryIndex | undefined;
  /** Which stop is showing; one past the last is the end of the tour. */
  step: number;
  /** Moving on by itself, a stop at a time. */
  playing: boolean;
  /** The map is covered (a dialog is open): the tour waits. */
  paused: boolean;
  /** Countries this tour has added to the world map so far. */
  fresh: number;
  /** Phones get a short card above the tab bar. */
  compact?: boolean;
  onStep: (step: number) => void;
  onPlaying: (playing: boolean) => void;
  /** Open a country's profile (which ends the tour). */
  onExplore: (id: string) => void;
  /** Choose another continent. */
  onAnother: () => void;
  /** The same continent again, by another route. */
  onAgain: () => void;
  onClose: () => void;
}

/**
 * Globy's tour, a stop at a time: the country the map has flown to, and what Globy has to say about
 * it. It moves on by itself once there has been time to read (a bar along the top shows how long is
 * left), and can be paused, stepped through by hand, or left for a country's profile.
 */
export function TourCard({ tour, index, step, playing, paused, fresh, compact, onStep, onPlaying, onExplore, onAnother, onAgain, onClose }: TourCardProps) {
  const { stops } = tour;
  const done = step >= stops.length;
  const stop = stops[Math.min(step, stops.length - 1)];
  const country = index?.byId.get(stop.id);
  const text = stop.lines.join(' ');
  const ms = readingMs(text);
  const running = playing && !paused && !done;

  // Moves on when the time to read is up. Pausing keeps what is left, as the bar along the top does.
  const left = useRef(ms);
  const [first] = useState(() => `${tour.key}-${step}`);
  const timed = useRef(first);
  const latest = useRef(onStep);
  latest.current = onStep;
  useEffect(() => {
    const id = `${tour.key}-${step}`;
    if (timed.current !== id) {
      timed.current = id;
      left.current = ms;
    }
    if (!running) return;
    const started = performance.now();
    const timer = window.setTimeout(() => latest.current(step + 1), left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(600, left.current - (performance.now() - started));
    };
  }, [tour.key, step, ms, running]);

  // Globy's voice, once for each thing it says (remembered, so a doubled effect in development stays quiet).
  const spoken = useRef('');
  useEffect(() => {
    const id = `${tour.key}-${step}`;
    if (spoken.current === id) return;
    spoken.current = id;
    if (done) return sounds.land();
    // On to the next country, then Globy pipes up.
    if (step > 0) sounds.swish();
    sounds.babble(text.split(' ').length / 3);
  }, [tour.key, step, done, text]);

  const explored = useSyncExternalStore(subscribeDiscoveries, discovered);
  const progress = index ? continentProgress(index, tour.continent, explored) : null;

  const press = (action: () => void) => () => {
    haptics.tap();
    sounds.tap();
    action();
  };

  /** The tour's stops as a row of bars, like the stories on a phone: done, under way (filling as its time runs), to come. */
  const bars = (
    <div aria-hidden className="flex gap-1">
      {stops.map((s, i) => (
        <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-control-strong">
          {i < step ? (
            <span className="block h-full bg-tint" />
          ) : i === step ? (
            <span
              key={`${tour.key}-${step}`}
              className="block h-full origin-left bg-tint"
              style={{ animation: `grow ${ms}ms linear both`, animationPlayState: running ? 'running' : 'paused' }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );

  const status = (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className={clsx('grid shrink-0 place-items-center rounded-[9px] bg-tint text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.5)]', compact ? 'size-7' : 'size-[30px]')}>
        <MapIcon className="size-[17px]" strokeWidth={2.2} />
      </span>
      <p role="status" className="min-w-0 flex-1 truncate text-[13px] font-semibold uppercase tracking-[0.05em] text-secondary">
        {done ? `${tour.continent} · tour over` : `Globy's tour · ${tour.continent} · ${step + 1} of ${stops.length}`}
      </p>
      {!done && (
        <button
          type="button"
          onClick={press(() => onPlaying(!playing))}
          aria-label={playing ? 'Pause the tour' : 'Carry on with the tour'}
          title={playing ? 'Pause' : 'Play'}
          className="ios-press grid size-9 shrink-0 place-items-center rounded-full bg-control text-tint hover:bg-control-strong"
        >
          {playing ? <Pause className="size-[17px] fill-current" strokeWidth={2} /> : <Play className="size-[17px] fill-current" strokeWidth={2} />}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onClose();
        }}
        aria-label="End the tour"
        title="Close"
        className="ios-press grid size-9 shrink-0 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
      >
        <X className="size-[18px]" strokeWidth={2.6} />
      </button>
    </div>
  );

  const ending = (
    <div key="end" className={clsx('animate-rise text-center', compact ? 'mt-2' : 'mt-6')}>
      {!compact && <Mascot mood="party" className="mx-auto w-28" />}
      <p className={clsx('ios-title', compact ? 'text-[20px]' : 'mt-3 text-[26px]')}>That was {tour.continent}!</p>
      <p className="mt-1 text-[15px] leading-snug text-secondary">
        We called at {stops.length} countries
        {fresh > 0 ? (
          <>
            {' '}
            and added <b className="font-semibold text-tint">{fresh} new</b> to your world map
          </>
        ) : null}
        .
      </p>
      {progress && (
        <div className={clsx('glass-soft rounded-[18px] px-3.5 py-3 text-left', compact ? 'mt-2.5' : 'mt-4')}>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-label">
            <Sparkles aria-hidden className="size-4 text-ios-orange" strokeWidth={2.4} />
            <span className="flex-1">{tour.continent} explored</span>
            <span className="tabular text-tint">
              {progress.explored} / {progress.total}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-control">
            <div className="h-full rounded-full bg-tint transition-[width] duration-700 ease-out" style={{ width: `${(progress.explored / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}
      <div className={clsx('flex gap-2', compact ? 'mt-2.5' : 'mt-4 flex-col')}>
        <button
          type="button"
          onClick={press(onAnother)}
          className="ios-press flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-tint px-4 py-2.5 text-[16px] font-semibold text-white shadow-[0_4px_14px_rgb(0_122_255/0.3)]"
        >
          <span className="truncate">{compact ? 'Another Tour' : 'Tour Another Continent'}</span>
          <ArrowRight aria-hidden className="size-[18px] shrink-0" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={press(onAgain)}
          className="ios-press flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-control px-4 py-2.5 text-[15px] font-semibold text-tint hover:bg-control-strong"
        >
          <RotateCcw aria-hidden className="size-4" strokeWidth={2.4} />
          {compact ? 'Again' : `More of ${tour.continent}`}
        </button>
      </div>
    </div>
  );

  const stepper = (
    <div className={clsx('flex items-center gap-2', compact ? 'mt-1' : 'mt-4')}>
      <button
        type="button"
        onClick={press(() => onStep(step - 1))}
        disabled={step === 0}
        aria-label="Back to the last country"
        className="ios-press grid size-11 shrink-0 place-items-center rounded-full bg-control text-tint hover:bg-control-strong disabled:opacity-40"
      >
        <ChevronLeft className="size-5" strokeWidth={2.6} />
      </button>
      <button
        type="button"
        onClick={press(() => onStep(step + 1))}
        className="ios-press flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-tint px-4 text-[16px] font-semibold text-white shadow-[0_3px_10px_rgb(0_122_255/0.28)]"
      >
        <span className="truncate">{step === stops.length - 1 ? 'Finish the Tour' : 'Next Country'}</span>
        <ChevronRight aria-hidden className="size-5 shrink-0" strokeWidth={2.6} />
      </button>
    </div>
  );

  if (compact) {
    return (
      <section aria-label={`Globy's tour of ${tour.continent}`} className="px-3.5 pb-3.5 pt-3">
        {status}
        <div className="mt-2.5">{bars}</div>
        {done ? (
          ending
        ) : (
          <div key={stop.id} className="animate-rise">
            <button type="button" onClick={press(() => onExplore(stop.id))} title={`Open ${country?.name ?? 'this country'}`} className="ios-press mt-2.5 flex w-full items-center gap-2.5 text-left">
              {country && <Flag country={country} variant="full" eager className="h-7 w-auto max-w-[56px] rounded-[6px] bg-white object-contain shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.12)]" />}
              <span className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-[-0.015em] text-label">{country?.name}</span>
              <span className="shrink-0 text-[13px] font-semibold text-tint">Open</span>
            </button>
            <div className="mt-2 flex items-end gap-1.5">
              <Mascot mood={step % 3 === 2 ? 'happy' : 'idle'} talking className="w-14 shrink-0" />
              <Bubble small text={text} />
              {stop.picture && <Picture picture={stop.picture} className="mb-4 size-16 shrink-0 rounded-[14px]" />}
            </div>
            {stepper}
          </div>
        )}
      </section>
    );
  }

  return (
    // Fills the desktop card; on a tablet the card is only as tall as this, up to the card's own limit.
    <section aria-label={`Globy's tour of ${tour.continent}`} className="h-full max-h-[inherit] overflow-y-auto px-5 pb-7 pt-5">
      {status}
      <div className="mt-4">{bars}</div>
      {done ? (
        ending
      ) : (
        <div key={stop.id} className="animate-rise">
          <button type="button" onClick={press(() => onExplore(stop.id))} title={`Open ${country?.name ?? 'this country'}`} className="ios-press mt-5 flex w-full items-center gap-3.5 text-left">
            {country && <WavingFlag country={country} height={52} maxWidth={96} radius={10} className="shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="ios-title line-clamp-2 block text-[28px] leading-[1.08]">{country?.name}</span>
              <span className="mt-0.5 block truncate text-[14px] text-secondary">
                {[country?.capitals[0]?.name, country?.subregion ?? country?.region].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>

          <div className="mt-5 flex items-end gap-2">
            <Mascot mood={step % 3 === 2 ? 'happy' : 'idle'} talking className="w-[84px] shrink-0" />
            <Bubble text={text} />
          </div>
          {stop.picture && (
            <figure className="glass-soft overflow-hidden rounded-[20px]">
              <Picture picture={stop.picture} className="h-40 w-full" />
              <figcaption className="px-3.5 py-2 text-[13px] font-medium text-secondary">{stop.picture.caption}</figcaption>
            </figure>
          )}
          {stepper}
          <button type="button" onClick={press(() => onExplore(stop.id))} className="mx-auto mt-3 block max-w-full truncate text-[15px] font-semibold text-tint hover:opacity-70">
            Open {country?.name ?? 'this country'}
          </button>
        </div>
      )}
    </section>
  );
}

/** The picture that goes with a fact; it steps aside if it can't be loaded. */
function Picture({ picture, className }: { picture: NonNullable<Tour['stops'][number]['picture']>; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={picture.src}
      alt={picture.caption}
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={clsx('animate-fade-in bg-control object-cover', className)}
    />
  );
}
