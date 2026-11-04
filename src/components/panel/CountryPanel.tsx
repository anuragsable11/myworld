import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { Crosshair, X } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, useFactbook, useMountains, useWikidata, useWikipedia, useWorldBank, type CountryIndex } from '../../hooks/queries';
import { formatShortCount } from '../../lib/format';
import { scrollWithin } from '../../lib/scroll';
import { Flag } from '../ui/Flag';
import { Skeleton } from '../ui/primitives';
import { TONES, type Tone } from '../ui/tones';
import type { CountryDetails } from './details';
import { Basics, populationOf } from './sections/Basics';
import { Cities } from './sections/Cities';
import { Economy } from './sections/Economy';
import { Geography } from './sections/Geography';
import { Government } from './sections/Government';
import { Overview } from './sections/Overview';
import { People } from './sections/People';
import { Sources } from './sections/Sources';

const SECTIONS = [
  ['overview', 'Overview'],
  ['basics', 'Basics'],
  ['government', 'Government'],
  ['geography', 'Geography'],
  ['people', 'People'],
  ['economy', 'Economy'],
  ['cities', 'Cities'],
] as const;

interface CountryPanelProps {
  id: string;
  index: CountryIndex | undefined;
  onClose: () => void;
  onSelect: (id: string) => void;
  onLocate: () => void;
  /** Rendered in the mobile bottom sheet, where the header doubles as the drag handle. */
  sheetHeader?: ReactNode;
}

export function CountryPanel({ id, index, onClose, onSelect, onLocate, sheetHeader }: CountryPanelProps) {
  const country = index?.byId.get(id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [id]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      {sheetHeader}
      <div ref={scrollRef} className="dots-bg relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {country && index ? (
          <CountryProfile
            key={country.cca3}
            country={country}
            index={index}
            onClose={onClose}
            onSelect={onSelect}
            onLocate={onLocate}
            scrollRef={scrollRef}
          />
        ) : index ? (
          <div className="p-8 text-center">
            <p className="text-sm font-bold text-ink">Hmm, no country with the code “{id}”. 🤔</p>
            <button
              type="button"
              onClick={onClose}
              className="toon-sm toon-press-sm mt-3 rounded-full bg-sun px-4 py-1 text-sm font-extrabold text-ink"
            >
              Close
            </button>
          </div>
        ) : (
          <PanelSkeleton />
        )}
      </div>
    </div>
  );
}

function CountryProfile({
  country,
  index,
  onClose,
  onSelect,
  onLocate,
  scrollRef,
}: {
  country: Country;
  index: CountryIndex;
  onClose: () => void;
  onSelect: (id: string) => void;
  onLocate: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const factbook = useFactbook(country.cca3);
  const wikidata = useWikidata(country);
  const worldBank = useWorldBank(country.cca3);
  const mountains = useMountains();
  const wikidataSettled = !wikidata.isLoading && (wikidata.isError || wikidata.isSuccess);
  const wikiTitle =
    wikidata.data?.wikipediaTitle ??
    (wikidataSettled
      ? (country.wikipediaUrl ? decodeURIComponent(country.wikipediaUrl.split('/wiki/')[1] ?? '') : '') || country.name
      : undefined);
  const wikipedia = useWikipedia(wikiTitle);

  const details: CountryDetails = {
    country,
    index,
    factbook: { data: factbook.data, loading: factbook.isLoading },
    wikidata: { data: wikidata.data, loading: wikidata.isLoading },
    worldBank: { data: worldBank.data, loading: worldBank.isLoading },
    wikipedia: { data: wikipedia.data, loading: wikipedia.isLoading || (!wikiTitle && wikidata.isLoading) },
    mountains: { data: mountains.data ? (mountains.data[country.cca3] ?? null) : undefined, loading: mountains.isLoading },
    onSelect,
  };

  const population = populationOf(details);
  const parent = country.parent ? index.byId.get(country.parent) : undefined;
  const statusLabel = {
    member: 'UN member state',
    observer: 'UN observer state',
    partial: 'Partially recognised',
    territory: parent ? `Territory of ${parent.name}` : 'Dependent territory',
    disputed: 'Disputed territory',
  }[country.status];

  return (
    <article aria-label={`${country.name} profile`}>
      <header className="relative px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="group animate-pop">
            <Flag
              country={country}
              variant="full"
              eager
              className="h-[72px] w-auto max-w-[124px] -rotate-3 rounded-xl border-[3px] border-ink bg-white object-contain shadow-[4px_4px_0_0_var(--color-ink)] outline outline-4 -outline-offset-[7px] outline-white transition-transform duration-300 group-hover:rotate-3 group-hover:scale-105"
            />
          </div>
          <div className="flex gap-2">
            <IconButton label="Show on map" onClick={onLocate}>
              <Crosshair className="size-[18px]" strokeWidth={2.6} />
            </IconButton>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-[18px]" strokeWidth={2.8} />
            </IconButton>
          </div>
        </div>
        <h2 className="toon-title mt-5 animate-rise text-[38px] leading-[1]">{country.name}</h2>
        {country.officialName !== country.name && (
          <p className="mt-1.5 text-[14.5px] font-bold leading-snug text-slate-500">{country.officialName}</p>
        )}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Badge className={isSovereign(country) ? 'bg-sun' : 'bg-pink-200'}>
            {isSovereign(country) ? '⭐ ' : '🏝️ '}
            {statusLabel}
          </Badge>
          <Badge className="bg-white">🧭 {country.subregion ?? country.region}</Badge>
          <Badge className="bg-white font-mono tracking-wider">{country.cca3}</Badge>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2.5 px-4">
        <QuickStat tone="sky" emoji="🏛️" label="Capital" value={country.capitals[0]?.name ?? '—'} order={0} />
        <QuickStat
          tone="violet"
          emoji="👥"
          label="People"
          value={population ? formatShortCount(population.value) : details.factbook.loading ? undefined : '—'}
          order={1}
        />
        <QuickStat
          tone="emerald"
          emoji="📐"
          label="Area"
          value={country.area ? formatShortCount(country.area) : '—'}
          unit={country.area ? 'km²' : undefined}
          order={2}
        />
      </dl>

      <SectionNav scrollRef={scrollRef} />

      <div className="space-y-4 px-3 pb-6 sm:px-4">
        <Overview {...details} />
        <Basics {...details} />
        <Government {...details} />
        <Geography {...details} />
        <People {...details} />
        <Economy {...details} />
        <Cities {...details} />
        <Sources {...details} />
      </div>
    </article>
  );
}

function SectionNav({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.section!;
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
          else visible.delete(id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActive(top[0]);
      },
      { root, rootMargin: '-64px 0px -55% 0px' },
    );
    root.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollRef]);

  useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>(`[data-target="${active}"]`);
    if (nav && tab) nav.scrollTo({ left: tab.offsetLeft - nav.clientWidth / 2 + tab.clientWidth / 2, behavior: 'smooth' });
  }, [active]);

  return (
    <nav
      ref={navRef}
      aria-label="Profile sections"
      className="no-scrollbar sticky top-0 z-20 mt-4 flex gap-1.5 overflow-x-auto border-b-2 border-dashed border-indigo-100 bg-paper/95 px-4 py-2.5 backdrop-blur"
    >
      {SECTIONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          data-target={id}
          onClick={() => {
            setActive(id);
            const root = scrollRef.current;
            const section = root?.querySelector<HTMLElement>(`#section-${id}`);
            if (root && section) scrollWithin(root, section, { block: 'start', offset: 64, smooth: true });
          }}
          className={clsx(
            'shrink-0 rounded-full border-2 px-3.5 py-1 font-display text-[14px] font-semibold transition-all duration-300',
            active === id
              ? 'border-ink bg-sun text-ink shadow-[2px_2px_0_0_var(--color-ink)]'
              : 'border-transparent text-slate-500 hover:border-ink hover:bg-white hover:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function QuickStat({
  tone,
  emoji,
  label,
  value,
  unit,
  order,
}: {
  tone: Tone;
  emoji: string;
  label: string;
  value: string | undefined;
  unit?: string;
  order: number;
}) {
  const tilt = ['-rotate-2', 'rotate-1', '-rotate-1'][order];
  return (
    <div className="animate-pop" style={{ animationDelay: `${140 + order * 90}ms` }}>
      <div className={clsx('toon min-w-0 rounded-2xl px-3 py-2.5 transition-transform duration-300 hover:rotate-0 hover:scale-105', tilt, TONES[tone].soft)}>
        <span aria-hidden className="block text-[22px] leading-none">
          {emoji}
        </span>
        <dt className="mt-1.5 text-[10.5px] font-black uppercase tracking-[0.08em] text-ink/60">{label}</dt>
        <dd className="tabular toon-title mt-0.5 truncate text-[18px]" title={value}>
          {value ?? <Skeleton className="h-4 w-14" />}
          {value && unit && <span className="ml-0.5 text-[12px] font-bold text-ink/60">{unit}</span>}
        </dd>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('toon-sm rounded-full px-2.5 py-0.5 text-[12px] font-extrabold text-ink', className)}>{children}</span>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="toon-sm toon-press-sm grid size-10 place-items-center rounded-full bg-white text-ink hover:bg-sun"
    >
      {children}
    </button>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-4 p-5" role="status" aria-label="Loading country">
      <Skeleton className="h-16 w-28 rounded-xl" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
    </div>
  );
}
