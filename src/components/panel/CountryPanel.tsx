import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { Crosshair, X } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, useFactbook, useMountains, useWikidata, useWikipedia, useWorldBank, type CountryIndex } from '../../hooks/queries';
import { formatShortCount } from '../../lib/format';
import { scrollWithin } from '../../lib/scroll';
import { Flag } from '../ui/Flag';
import { Skeleton } from '../ui/primitives';
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
    <div className="flex h-full min-h-0 flex-col bg-ink-900">
      {sheetHeader}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {country && index ? (
          <CountryProfile key={country.cca3} country={country} index={index} onClose={onClose} onSelect={onSelect} onLocate={onLocate} scrollRef={scrollRef} />
        ) : index ? (
          <div className="p-8 text-center">
            <p className="text-sm text-mist-300">No country with the code “{id}” was found.</p>
            <button type="button" onClick={onClose} className="mt-3 text-sm text-brass-300 hover:text-brass-200">
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
    partial: 'Partially recognised state',
    territory: parent ? `Territory of ${parent.name}` : 'Dependent territory',
    disputed: 'Disputed territory',
  }[country.status];

  return (
    <article aria-label={`${country.name} profile`} className="animate-fade-in">
      <header className="relative overflow-hidden">
        <img
          src={country.flag.svg}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-[0.17] blur-3xl saturate-150"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900/20 via-ink-900/75 to-ink-900" />
        <div className="relative px-5 pb-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <Flag
              country={country}
              variant="full"
              eager
              className="h-[60px] w-auto max-w-[110px] rounded-md object-contain shadow-xl shadow-black/50 ring-1 ring-white/15"
            />
            <div className="flex gap-1">
              <IconButton label="Show on map" onClick={onLocate}>
                <Crosshair className="size-4" />
              </IconButton>
              <IconButton label="Close" onClick={onClose}>
                <X className="size-4" />
              </IconButton>
            </div>
          </div>
          <h2 className="mt-4 font-display text-[30px] font-medium leading-[1.08] tracking-tight text-mist-50">
            {country.name}
          </h2>
          {country.officialName !== country.name && (
            <p className="mt-1 text-[13.5px] leading-snug text-mist-400">{country.officialName}</p>
          )}
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            <Badge tone={isSovereign(country) ? 'accent' : 'muted'}>{statusLabel}</Badge>
            <Badge>{country.subregion ?? country.region}</Badge>
            <Badge mono>{country.cca3}</Badge>
          </div>
        </div>
      </header>

      <div className="px-5">
        <dl className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.07] bg-ink-850/80">
          <QuickStat label="Capital" value={country.capitals[0]?.name ?? '—'} />
          <QuickStat
            label="Population"
            value={population ? formatShortCount(population.value) : details.factbook.loading ? undefined : '—'}
          />
          <QuickStat label="Area" value={country.area ? `${formatShortCount(country.area)} km²` : '—'} />
        </dl>
      </div>

      <SectionNav scrollRef={scrollRef} />

      <div className="space-y-3 px-3 pb-6 sm:px-4">
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
      { root, rootMargin: '-60px 0px -55% 0px' },
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
      className="no-scrollbar sticky top-0 z-20 mt-4 flex gap-1 overflow-x-auto border-b border-white/[0.06] bg-ink-900/90 px-4 py-2 backdrop-blur-md"
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
            if (root && section) scrollWithin(root, section, { block: 'start', offset: 56, smooth: true });
          }}
          className={clsx(
            'shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
            active === id ? 'bg-brass-400/12 text-brass-200' : 'text-mist-400 hover:text-mist-100',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function QuickStat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-mist-500">{label}</dt>
      <dd className="tabular mt-1 truncate text-[15px] font-semibold text-mist-50" title={value}>
        {value ?? <Skeleton className="h-4 w-14" />}
      </dd>
    </div>
  );
}

function Badge({ children, tone = 'default', mono }: { children: ReactNode; tone?: 'default' | 'accent' | 'muted'; mono?: boolean }) {
  return (
    <span
      className={clsx(
        'rounded-full border px-2.5 py-0.5 text-[11.5px]',
        mono && 'font-mono tracking-wider',
        tone === 'accent' && 'border-brass-400/30 bg-brass-400/10 text-brass-200',
        tone === 'muted' && 'border-white/10 bg-white/[0.04] text-mist-300',
        tone === 'default' && 'border-white/[0.08] bg-white/[0.03] text-mist-300',
      )}
    >
      {children}
    </span>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-ink-900/60 text-mist-300 backdrop-blur transition-colors hover:border-white/15 hover:text-mist-50"
    >
      {children}
    </button>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-4 p-5" role="status" aria-label="Loading country">
      <Skeleton className="h-14 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
