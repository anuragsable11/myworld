import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowLeftRight, ArrowRight, Car, Clock, Earth, Footprints, Plane, PlaneLanding, RotateCcw, Ruler, Timer, TrainFront, X, type LucideIcon } from 'lucide-react';
import type { Country } from '../../types';
import type { CountryIndex } from '../../hooks/queries';
import { clockAt, CRUISE_KMH, EARTH_AROUND_KM, flightKm, flightMinutes, formatDuration, LONGEST_NONSTOP_KM, type FlightPlan, type FlightStop } from '../../lib/flight';
import { formatInteger } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { zoneOffsetMinutes } from '../../lib/timezones';
import { Mascot } from '../game/Mascot';
import { Flag } from '../ui/Flag';

export interface FlightCardHandle {
  /** How far along the plane is, from 0 to 1: the distance counts up with it. */
  progress: (share: number) => void;
}

interface FlightCardProps {
  plan: FlightPlan;
  index: CountryIndex | undefined;
  /** The plane has touched down. */
  landed: boolean;
  /** Phones get a short card above the tab bar; larger screens get the whole story. */
  compact?: boolean;
  onAgain: () => void;
  /** Fly the same route the other way. */
  onReturn: () => void;
  /** Choose two other countries. */
  onNew: () => void;
  /** Open a country's profile. */
  onExplore: (id: string) => void;
  onClose: () => void;
}

/** Other ways to cover the same ground, never stopping: what makes a plane seem fast. */
const OTHER_WAYS: { label: string; pace: string; kmh: number; icon: LucideIcon; color: string }[] = [
  { label: 'By fast train', pace: '300 km/h', kmh: 300, icon: TrainFront, color: '#34c759' },
  { label: 'By car', pace: '100 km/h', kmh: 100, icon: Car, color: '#ff9500' },
  { label: 'On foot', pace: '5 km/h', kmh: 5, icon: Footprints, color: '#af52de' },
];

/** A rough travelling time: to the hour for long trips, to five minutes for short ones. */
const roughly = (minutes: number) =>
  minutes >= 600 ? Math.round(minutes / 60) * 60 : minutes >= 20 ? Math.round(minutes / 5) * 5 : Math.max(1, Math.round(minutes));

/** Ends a sentence, unless the name it ends with already has ("Washington D.C."). */
const endSentence = (sentence: string) => (sentence.endsWith('.') ? sentence : `${sentence}.`);

/** Where the plane's badge sits on the card's little route, `share` of the way along it. */
const along = (share: number) => `calc(14px + (100% - 28px) * ${share})`;

/**
 * A flight between two countries, in everyday terms: where from and to, how far, how long in the
 * air and what the clock says on landing. While the plane is in the air on the globe, the distance
 * here counts up with it and a little plane crosses the card.
 */
export const FlightCard = forwardRef<FlightCardHandle, FlightCardProps>(function FlightCard(
  { plan, index, landed, compact, onAgain, onReturn, onNew, onExplore, onClose },
  ref,
) {
  const { from, to } = plan;
  const destination = index?.byId.get(to.id);
  const km = flightKm(plan);
  const minutes = flightMinutes(km);
  const landing = clockAt(to.zone, plan.key + minutes * 60_000);
  const kmRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const planeRef = useRef<HTMLSpanElement>(null);

  // The plane's place is painted straight onto the page, frame by frame, without rendering.
  const share = useRef(0);
  const paint = (s: number) => {
    if (kmRef.current) kmRef.current.textContent = formatInteger(Math.round(km * s));
    if (planeRef.current) planeRef.current.style.left = along(s);
    if (fillRef.current) fillRef.current.style.width = along(s);
  };
  useImperativeHandle(ref, () => ({
    progress: (s) => {
      share.current = s;
      paint(s);
    },
  }));
  // A new take-off starts from nothing; and whatever else re-renders the card, it stays where the plane is.
  const flown = useRef(plan.key);
  useLayoutEffect(() => {
    if (flown.current !== plan.key) {
      flown.current = plan.key;
      share.current = 0;
    }
    paint(landed ? 1 : share.current);
  });

  const press = (action: () => void) => () => {
    haptics.tap();
    action();
  };

  const tiles = (
    <dl className={clsx('grid grid-cols-3 gap-2', compact ? 'mt-2.5' : 'mt-5')}>
      <Tile icon={Ruler} color="#007aff" label="Distance" compact={compact}>
        <span ref={kmRef} aria-hidden />
        <span className="sr-only">{formatInteger(Math.round(km))}</span>
        <span className="ml-0.5 text-[12px] font-medium text-secondary">km</span>
      </Tile>
      <Tile icon={Timer} color="#ff9500" label="Flight time" compact={compact}>
        {formatDuration(minutes)}
      </Tile>
      <Tile icon={Clock} color="#af52de" label="Lands at" compact={compact}>
        {landing?.time ?? '—'}
      </Tile>
    </dl>
  );

  const route = (
    <div className={clsx('flex items-start gap-1.5', compact ? 'mt-2.5' : 'mt-5')}>
      <Stop stop={from} country={index?.byId.get(from.id)} compact={compact} onOpen={press(() => onExplore(from.id))} />
      {/* As tall as the flags, so the plane crosses from one flag to the other */}
      <div aria-hidden className={clsx('relative min-w-12 flex-1', compact ? 'h-7' : 'h-10')}>
        <span className="absolute inset-x-3.5 top-1/2 -mt-px border-t-2 border-dotted border-tertiary" />
        <span ref={fillRef} className="absolute left-0 top-1/2 -mt-[1.5px] h-[3px] rounded-full bg-tint" style={{ width: along(0) }} />
        <span
          ref={planeRef}
          className="absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-tint shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_2px_6px_rgb(0_0_0/0.18)]"
          style={{ left: along(0) }}
        >
          <Plane className="size-4 rotate-45" strokeWidth={2.3} />
        </span>
      </div>
      <Stop stop={to} country={destination} compact={compact} end onOpen={press(() => onExplore(to.id))} />
    </div>
  );

  const status = (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={clsx(
          'grid shrink-0 place-items-center rounded-[9px] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.5)] transition-colors duration-500',
          compact ? 'size-7' : 'size-[30px]',
          landed ? 'bg-ios-green' : 'bg-tint',
        )}
      >
        {landed ? <PlaneLanding className="size-[18px]" strokeWidth={2.2} /> : <Plane className="size-[17px]" strokeWidth={2.2} />}
      </span>
      <p role="status" className="min-w-0 flex-1 truncate text-[13px] font-semibold uppercase tracking-[0.05em] text-secondary">
        {landed ? `Landed in ${to.place}` : `Flying to ${to.place}`}
      </p>
      <button
        type="button"
        onClick={press(onClose)}
        aria-label="Close the flight"
        title="Close"
        className="ios-press grid size-9 shrink-0 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
      >
        <X className="size-[18px]" strokeWidth={2.6} />
      </button>
    </div>
  );

  if (compact) {
    return (
      <section aria-label={`Flight from ${from.place} to ${to.place}`} className="px-3.5 pb-3.5 pt-3">
        {status}
        {route}
        {tiles}
        <div className="mt-2.5 flex gap-2">
          <Pill icon={RotateCcw} onClick={press(onAgain)} label="Fly the same route again">
            Again
          </Pill>
          <Pill icon={ArrowLeftRight} onClick={press(onReturn)} label={`Fly back to ${from.place}`}>
            Return
          </Pill>
          <button
            type="button"
            onClick={press(() => onExplore(to.id))}
            aria-label={`Explore ${to.country}`}
            className="ios-press flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-tint px-3 py-2 text-[15px] font-semibold text-white shadow-[0_3px_10px_rgb(0_122_255/0.28)]"
          >
            {/* The flag says where, so a long name never has to be cut short. */}
            {destination && <Flag country={destination} className="h-4 w-6 shrink-0 rounded-[3px] shadow-[0_0_0_0.5px_rgb(255_255_255/0.6)]" />}
            Explore
            <ArrowRight aria-hidden className="size-4 shrink-0" strokeWidth={2.6} />
          </button>
        </div>
      </section>
    );
  }

  // What the clocks do: the time on landing, and how far apart the two places' clocks are.
  const offsets = [from.zone, to.zone].map((zone) => (zone ? zoneOffsetMinutes(zone, new Date(plan.key)) : undefined));
  const ahead = offsets[0] !== undefined && offsets[1] !== undefined ? offsets[1] - offsets[0] : undefined;
  const clocks =
    ahead === undefined
      ? undefined
      : ahead === 0
        ? endSentence(`${to.place} keeps the same time as ${from.place}`)
        : endSentence(`Clocks in ${to.place} are ${formatDuration(Math.abs(ahead))} ${ahead > 0 ? 'ahead of' : 'behind'} ${from.place}`);
  const around = (km / EARTH_AROUND_KM) * 100;
  const fact =
    km < 25
      ? `So close that you could walk it in about ${formatDuration(roughly((km / 5) * 60))}.`
      : km > LONGEST_NONSTOP_KM
        ? 'Farther than any airliner flies in one go, so a real trip stops on the way.'
        : around >= 45
          ? 'About as far apart as two places on Earth can be: halfway around the world!'
          : `That is ${around < 1 ? 'less than 1' : Math.round(around)}% of the way around the Earth.`;

  return (
    // Fills the desktop card; on a tablet the card is only as tall as this, up to the card's own limit.
    <section aria-label={`Flight from ${from.place} to ${to.place}`} className="h-full max-h-[inherit] overflow-y-auto px-5 pb-7 pt-5">
      {status}
      {route}
      {tiles}

      <ul className="glass-soft mt-3 space-y-2.5 rounded-[20px] px-3.5 py-3 text-[14px] leading-snug text-label">
        {landing && (
          <Note icon={Clock} color="#af52de">
            Take off now and you land on {landing.day} at {landing.time}, {to.place} time.{clocks ? ` ${clocks}` : ''}
          </Note>
        )}
        <Note icon={Earth} color="#007aff">
          {fact}
        </Note>
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={press(() => onExplore(to.id))}
          className="ios-press col-span-2 flex items-center justify-center gap-2 rounded-full bg-tint px-5 py-2.5 text-[16px] font-semibold text-white shadow-[0_4px_14px_rgb(0_122_255/0.3)]"
        >
          <span className="truncate">Explore {to.country}</span>
          <ArrowRight aria-hidden className="size-[18px] shrink-0" strokeWidth={2.5} />
        </button>
        <Pill icon={RotateCcw} onClick={press(onAgain)} label="Fly the same route again" wide>
          Fly Again
        </Pill>
        <Pill icon={ArrowLeftRight} onClick={press(onReturn)} label={`Fly back to ${from.place}`} wide>
          Fly Back
        </Pill>
      </div>
      <button type="button" onClick={press(onNew)} className="mx-auto mt-3 block text-[15px] font-semibold text-tint hover:opacity-70">
        Plan Another Flight
      </button>

      <h3 className="ios-title mb-2.5 mt-7 text-[20px]">The same trip, never stopping</h3>
      {/* An iOS inset grouped list */}
      <ul className="glass-soft overflow-hidden rounded-[22px]">
        <Way icon={Plane} color="#007aff" label="By plane" pace={`${CRUISE_KMH} km/h`} first>
          {formatDuration(minutes)}
        </Way>
        {OTHER_WAYS.map((way) => (
          <Way key={way.label} icon={way.icon} color={way.color} label={way.label} pace={way.pace}>
            {formatDuration(roughly((km / way.kmh) * 60))}
          </Way>
        ))}
      </ul>

      <div className="mt-6 flex items-end gap-2.5">
        <Mascot mood={landed ? 'happy' : 'idle'} className="w-14 shrink-0" />
        <p className="glass-soft mb-2 min-w-0 flex-1 rounded-[18px] rounded-bl-[6px] px-3.5 py-2.5 text-[14px] leading-snug text-label">
          <b className="font-semibold">Why does the path bend?</b> The Earth is round, so the shortest way between two places curves over it.
          {!from.capital || !to.capital ? ' Flights here go from capital to capital, or from the middle of a place that has none.' : ''}
        </p>
      </div>
    </section>
  );
});

/** One end of the flight: the flag, the city and the country. Tapping it opens the country. */
function Stop({ stop, country, compact, end, onOpen }: { stop: FlightStop; country: Country | undefined; compact?: boolean; end?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open ${stop.country}`}
      className={clsx('ios-press flex w-[34%] min-w-0 flex-col', end ? 'items-end text-right' : 'items-start text-left')}
    >
      {country && (
        <Flag
          country={country}
          variant="full"
          eager
          className={clsx(
            'w-auto max-w-full rounded-[7px] bg-white object-contain shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_3px_10px_rgb(0_0_0/0.12)]',
            compact ? 'h-7' : 'h-10',
          )}
        />
      )}
      <span className={clsx('line-clamp-2 max-w-full font-semibold leading-tight tracking-[-0.015em] text-label', compact ? 'mt-1.5 text-[15px]' : 'mt-2.5 text-[18px]')}>
        {stop.place}
      </span>
      {/* Short phones have no room for this line; the flag says as much. */}
      <span className={clsx('max-w-full truncate text-secondary', compact ? 'text-[12px] [@media(max-height:720px)]:hidden' : 'mt-0.5 text-[13px]')}>
        {stop.capital ? stop.country : 'Middle of the country'}
      </span>
    </button>
  );
}

/** A small widget-like tile: a tinted glyph, a caption and the figure. */
function Tile({ icon: Icon, color, label, compact, children }: { icon: LucideIcon; color: string; label: string; compact?: boolean; children: ReactNode }) {
  return (
    <div className={clsx('glass-soft min-w-0 rounded-[16px]', compact ? 'px-2 py-2 min-[380px]:px-2.5' : 'px-2.5 py-2.5')}>
      {!compact && <Icon aria-hidden className="mb-1.5 size-[18px]" style={{ color }} strokeWidth={2.2} />}
      <dt className={clsx('flex items-center gap-1 truncate text-[11px] font-semibold uppercase text-secondary', compact ? 'tracking-[0.02em]' : 'tracking-[0.04em]')}>
        {/* The narrowest phones have room for the caption or its glyph, not both. */}
        {compact && <Icon aria-hidden className="size-3 shrink-0 max-[379px]:hidden" style={{ color }} strokeWidth={2.6} />}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="tabular mt-0.5 truncate text-[15px] font-semibold tracking-[-0.015em] text-label">{children}</dd>
    </div>
  );
}

/** A quiet button: again, back. */
function Pill({ icon: Icon, label, wide, onClick, children }: { icon: LucideIcon; label: string; wide?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx(
        'ios-press flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-control font-semibold text-tint hover:bg-control-strong',
        wide ? 'px-4 py-2.5 text-[15px]' : 'px-3 py-2 text-[14px]',
      )}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.4} />
      {children}
    </button>
  );
}

function Note({ icon: Icon, color, children }: { icon: LucideIcon; color: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon aria-hidden className="mt-px size-[18px] shrink-0" style={{ color }} strokeWidth={2.2} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** A row of the "same trip" list: a way of travelling and how long it would take. */
function Way({ icon: Icon, color, label, pace, first, children }: { icon: LucideIcon; color: string; label: string; pace: string; first?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 pl-3.5">
      <span aria-hidden className="grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white" style={{ backgroundColor: color }}>
        <Icon className="size-[18px]" strokeWidth={2.2} />
      </span>
      {/* The separator starts after the icon, as iOS insets it. */}
      <span className={clsx('flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4', !first && 'border-t border-hairline')}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-label">{label}</span>
          <span className="block text-[12px] text-secondary">{pace}</span>
        </span>
        <span className="tabular shrink-0 text-[15px] font-semibold text-label">{children}</span>
      </span>
    </li>
  );
}
