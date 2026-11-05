import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowLeftRight, Search, X } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, useFactbook, type CountryIndex } from '../../hooks/queries';
import { formatShortCount } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { searchCountries } from '../../lib/search';
import { sounds } from '../../lib/sounds';
import { capitalZone } from '../../lib/timezones';
import { Mascot } from '../game/Mascot';
import { Flag } from '../ui/Flag';

const REGION_EMOJI: Record<string, string> = {
  Africa: '🦁',
  Americas: '🦅',
  Asia: '🐼',
  Europe: '🏰',
  Oceania: '🦘',
  Antarctic: '🐧',
};

/** The two sides of every comparison: colour of the bars, the dots and the values. */
const SIDES = [
  { dot: 'bg-sky-400', bar: 'bg-sky-400', text: 'text-sky-700' },
  { dot: 'bg-pink-400', bar: 'bg-pink-400', text: 'text-pink-700' },
] as const;

/** Well-known countries offered after a country's neighbours. */
const FAMOUS = ['USA', 'CHN', 'IND', 'BRA', 'JPN', 'GBR', 'FRA', 'DEU', 'AUS', 'CAN', 'RUS', 'ZAF', 'MEX', 'EGY', 'ITA', 'KOR'];

/** Population, from the country record or else the Factbook. */
function usePopulation(country: Country | undefined) {
  const factbook = useFactbook(country && !country.population ? country.cca3 : undefined);
  return country?.population ?? factbook.data?.population?.value;
}

/** Minutes the capital's clock is ahead of UTC right now. */
function utcOffsetMinutes(country: Country): number | undefined {
  const zone = capitalZone(country.cca2, country.capitals[0]?.name);
  if (!zone) return undefined;
  try {
    const name = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const m = /GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?/.exec(name);
    if (!m) return undefined;
    if (!m[1]) return 0;
    return (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    return undefined;
  }
}

const times = (a: number, b: number) => {
  const r = a / b;
  return r >= 10 ? `${Math.round(r)}×` : `${r.toFixed(1).replace(/\.0$/, '')}×`;
};

function hoursText(minutes: number) {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''}`;
}

const side = (s: string | undefined) => (s ? s[0].toUpperCase() + s.slice(1) : undefined);

/**
 * Two countries side by side: a headline difference, bars for the sizes, and the everyday details.
 * Opened from a profile, with that country on the left; the other is picked here.
 */
export default function CompareDialog({
  open,
  first,
  index,
  onClose,
  onShowCountry,
}: {
  open: boolean;
  /** The country it was opened from. */
  first: string | null;
  index: CountryIndex;
  onClose: () => void;
  onShowCountry: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [left, setLeft] = useState<string | null>(first);
  const [right, setRight] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setLeft(first);
      setRight(null);
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open, first]);

  const a = left ? index.byId.get(left) : undefined;
  const b = right ? index.byId.get(right) : undefined;

  return (
    <dialog ref={ref} aria-label="Compare countries" className="quiz-dialog" onClose={() => open && onClose()}>
      <div className="dots-bg flex h-full animate-sheet-up flex-col bg-paper text-ink">
        <header className="mx-auto flex w-full max-w-2xl items-center gap-2.5 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
          <h2 className="toon-title flex-1 text-[28px]">
            Compare <span aria-hidden>⚖️</span>
          </h2>
          {a && b && (
            <button
              type="button"
              onClick={() => {
                setLeft(right);
                setRight(left);
                haptics.tap();
                sounds.pop();
              }}
              aria-label="Swap sides"
              title="Swap sides"
              className="toon-sm toon-press-sm grid size-10 place-items-center rounded-full bg-white hover:bg-sun"
            >
              <ArrowLeftRight className="size-[18px]" strokeWidth={2.6} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="toon-sm toon-press-sm grid size-10 place-items-center rounded-full bg-white hover:bg-pink-200"
          >
            <X className="size-5" strokeWidth={3} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-2xl min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          {a && !b && (
            <Picker
              index={index}
              exclude={a.cca3}
              suggested={a.borders}
              title={`Compare ${a.name} with…`}
              onPick={(id) => {
                setRight(id);
                haptics.select();
                sounds.select();
              }}
            />
          )}
          {a && b && <Comparison key={`${a.cca3}-${b.cca3}`} a={a} b={b} onChange={() => setRight(null)} onShowCountry={onShowCountry} />}
        </main>
      </div>
    </dialog>
  );
}

function Picker({
  index,
  exclude,
  suggested,
  title,
  onPick,
}: {
  index: CountryIndex;
  exclude: string;
  suggested: string[];
  title: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    if (query.trim()) return searchCountries(index.sorted, query).filter((c) => c.cca3 !== exclude).slice(0, 30);
    // Its neighbours first, then well-known countries of the world.
    const near = suggested.map((id) => index.byId.get(id)).filter((c): c is Country => !!c);
    const famous = FAMOUS.map((id) => index.byId.get(id)).filter((c): c is Country => !!c && c.cca3 !== exclude && !suggested.includes(c.cca3));
    return [...near, ...famous];
  }, [query, index, exclude, suggested]);

  return (
    <div className="pt-2">
      <label htmlFor="compare-search" className="toon-title block text-[19px]">
        {title}
      </label>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink" strokeWidth={2.8} />
        <input
          id="compare-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a country or capital…"
          autoComplete="off"
          spellCheck={false}
          className="toon-sm h-12 w-full rounded-2xl bg-white pl-11 pr-4 text-[16px] font-bold text-ink transition-all duration-200 placeholder:font-semibold placeholder:text-slate-400 focus:bg-amber-50 focus:outline-none"
        />
      </div>
      {!query.trim() && suggested.length > 0 && (
        <p className="mt-4 text-[11.5px] font-black uppercase tracking-wide text-slate-500">Neighbours, then well-known countries</p>
      )}
      <ul className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {results.map((c) => (
          <li key={c.cca3}>
            <button
              type="button"
              onClick={() => onPick(c.cca3)}
              className="toon-sm toon-press-sm flex w-full items-center gap-2 rounded-2xl bg-white px-2.5 py-2 text-left hover:bg-sky-50"
            >
              <Flag country={c} className="h-5 w-[30px] shrink-0 rounded-[4px] border-2 border-ink" />
              <span className="min-w-0 truncate text-[13.5px] font-extrabold">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {query.trim() && !results.length && (
        <div className="mt-6 flex flex-col items-center text-center">
          <Mascot mood="think" className="w-20" />
          <p className="mt-2 text-[14px] font-bold text-slate-500">No country matches “{query}”.</p>
        </div>
      )}
    </div>
  );
}

function Comparison({ a, b, onChange, onShowCountry }: { a: Country; b: Country; onChange: () => void; onShowCountry: (id: string) => void }) {
  const popA = usePopulation(a);
  const popB = usePopulation(b);
  const densA = popA && a.area ? popA / a.area : undefined;
  const densB = popB && b.area ? popB / b.area : undefined;
  const offA = utcOffsetMinutes(a);
  const offB = utcOffsetMinutes(b);

  // The headline: whichever difference is most striking.
  let headline: ReactNode;
  if (popA && popB && Math.max(popA, popB) / Math.min(popA, popB) >= 1.3) {
    const [big, small] = popA > popB ? [a, b] : [b, a];
    headline = (
      <>
        {big.name} has <b>{times(Math.max(popA, popB), Math.min(popA, popB))}</b> as many people as {small.name}!
      </>
    );
  } else if (a.area && b.area && Math.max(a.area, b.area) / Math.min(a.area, b.area) >= 1.3) {
    const [big, small] = a.area > b.area ? [a, b] : [b, a];
    headline = (
      <>
        {big.name} is <b>{times(Math.max(a.area, b.area), Math.min(a.area, b.area))}</b> the size of {small.name}!
      </>
    );
  } else headline = <>{a.name} and {b.name} are about the same size!</>;

  let clock: ReactNode = '—';
  if (offA !== undefined && offB !== undefined) {
    const diff = offB - offA;
    clock = diff === 0 ? 'Same time' : `${b.name} is ${hoursText(diff)} ${diff > 0 ? 'ahead' : 'behind'}`;
  }

  return (
    <div className="space-y-4 pb-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((c, i) => (
          <button
            key={c.cca3}
            type="button"
            onClick={() => onShowCountry(c.cca3)}
            title={`Open ${c.name}`}
            className={clsx(
              'toon toon-press flex animate-pop flex-col items-center rounded-3xl bg-white p-3 text-center',
              i === 0 ? '-rotate-1' : 'rotate-1',
            )}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <Flag country={c} variant="full" className="h-14 w-auto max-w-full rounded-md border-2 border-ink object-contain" />
            <span className="mt-2 flex items-center gap-1.5">
              <span aria-hidden className={clsx('size-2.5 shrink-0 rounded-full border border-ink', SIDES[i].dot)} />
              <span className="line-clamp-2 font-display text-[18px] font-bold leading-tight">{c.name}</span>
            </span>
            <span className="mt-1.5 rounded-full border-2 border-ink bg-sky-100 px-2 text-[11px] font-extrabold">
              {REGION_EMOJI[c.region] ?? '🌍'} {c.subregion ?? c.region}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onChange}
        className="mx-auto block text-[13.5px] font-extrabold text-indigo-600 underline decoration-2 underline-offset-2 hover:text-indigo-700"
      >
        Pick a different country
      </button>

      <p className="toon animate-rise rounded-2xl bg-sun px-4 py-3 text-center font-display text-[16px] font-semibold leading-snug text-ink">
        <span aria-hidden>💡 </span>
        {headline}
      </p>

      <div className="toon space-y-4 rounded-3xl bg-white p-4">
        <BarRow label="👥 People" a={popA} b={popB} countries={[a, b]} format={formatShortCount} />
        <BarRow label="📐 Area" a={a.area} b={b.area} countries={[a, b]} format={(v) => `${formatShortCount(v)} km²`} />
        <BarRow
          label="🏘️ People per km²"
          a={densA}
          b={densB}
          countries={[a, b]}
          format={(v) => (v >= 10 ? Math.round(v).toLocaleString('en') : v.toFixed(1))}
        />
      </div>

      <dl className="toon rounded-3xl bg-white px-4">
        <div className="grid grid-cols-2 gap-3 border-b-2 border-dashed border-indigo-100 py-2.5 text-center">
          {[a, b].map((c, i) => (
            <span key={c.cca3} className="flex min-w-0 items-center justify-center gap-1.5 text-[12.5px] font-extrabold">
              <span aria-hidden className={clsx('size-2.5 shrink-0 rounded-full border border-ink', SIDES[i].dot)} />
              <span className="truncate">{c.name}</span>
            </span>
          ))}
        </div>
        <div className="divide-y-2 divide-dashed divide-indigo-100">
          <TextRow label="🏛️ Capital" a={a.capitals[0]?.name} b={b.capitals[0]?.name} />
          <TextRow label="🗣️ Languages" a={a.languages.slice(0, 3).join(', ')} b={b.languages.slice(0, 3).join(', ')} />
          <TextRow label="💰 Money" a={a.currencies[0]?.name} b={b.currencies[0]?.name} />
          <TextRow label="🚗 Drives on the" a={side(a.drivingSide)} b={side(b.drivingSide)} />
          <TextRow label="🤝 Neighbours" a={String(a.borders.length)} b={String(b.borders.length)} />
          <TextRow label="🌊 Coast" a={a.landlocked ? 'None (landlocked)' : 'Yes'} b={b.landlocked ? 'None (landlocked)' : 'Yes'} />
          <TextRow label="🏳️ Status" a={isSovereign(a) ? 'Country' : 'Territory'} b={isSovereign(b) ? 'Country' : 'Territory'} />
          <div className="py-3 text-center">
            <dt className="text-[11.5px] font-black uppercase tracking-wide text-slate-500">🕐 Time difference</dt>
            <dd className="mt-0.5 text-[14.5px] font-extrabold">{clock}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

function BarRow({
  label,
  a,
  b,
  countries,
  format,
}: {
  label: string;
  a: number | undefined;
  b: number | undefined;
  countries: [Country, Country];
  format: (v: number) => string;
}) {
  const top = Math.max(a ?? 0, b ?? 0) || 1;
  return (
    <div>
      <p className="text-[11.5px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      {[a, b].map((v, i) => (
        <div key={i} className="mt-1.5 flex items-center gap-2">
          {/* Each bar names its country, so colour isn't the only clue. */}
          <Flag country={countries[i]} className="h-4 w-6 shrink-0 rounded-[3px] border border-ink" />
          <span className="sr-only">{countries[i].name}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
            <div
              className={clsx('h-full origin-left animate-grow rounded-full border-r-2 border-ink', SIDES[i].bar)}
              style={{ width: `${v ? Math.max(3, (v / top) * 100) : 0}%`, animationDelay: `${150 + i * 120}ms` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-[13.5px] font-extrabold tabular-nums">{v ? format(v) : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function TextRow({ label, a, b }: { label: string; a: string | undefined; b: string | undefined }) {
  return (
    <div className="py-3">
      <dt className="text-center text-[11.5px] font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 grid grid-cols-2 gap-3 text-center text-[14.5px] font-extrabold">
        <span className={clsx('min-w-0 break-words', SIDES[0].text)}>{a || '—'}</span>
        <span className={clsx('min-w-0 break-words', SIDES[1].text)}>{b || '—'}</span>
      </dd>
    </div>
  );
}
