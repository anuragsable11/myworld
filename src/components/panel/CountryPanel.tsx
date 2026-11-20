import { memo, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { ArrowLeftRight, Crosshair, Landmark, Ruler, Users, X, type LucideIcon } from 'lucide-react';
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
import { Photos } from './sections/Photos';
import { Sources } from './sections/Sources';

const SECTIONS = [
  ['overview', 'Overview'],
  ['photos', 'Photos'],
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
  /** Opens Compare with this country on one side. */
  onCompare: (id: string) => void;
  /** Rendered in the mobile bottom sheet, where the header doubles as the drag handle. */
  sheetHeader?: ReactNode;
}

export function CountryPanel({ id, index, onClose, onSelect, onLocate, onCompare, sheetHeader }: CountryPanelProps) {
  const country = index?.byId.get(id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {sheetHeader}
      <div
        ref={scrollRef}
        data-sheet-scroll
        className={clsx(
          'relative min-h-0 flex-1 overflow-y-auto overscroll-contain',
          // In the sheet: room to scroll the last lines clear of the floating tab bar, plus the 40px
          // of sheet that reaches below the screen.
          sheetHeader && 'pb-[calc(136px+env(safe-area-inset-bottom))]',
        )}
      >
        {country && index ? (
          <CountryProfile
            key={country.cca3}
            country={country}
            index={index}
            onClose={onClose}
            onSelect={onSelect}
            onLocate={onLocate}
            onCompare={onCompare}
            scrollRef={scrollRef}
          />
        ) : index ? (
          <div className="p-8 text-center">
            <p className="text-[15px] font-medium text-label">There's no country with the code “{id}”.</p>
            <button
              type="button"
              onClick={onClose}
              className="ios-press mt-3 rounded-full bg-tint px-5 py-2 text-[15px] font-semibold text-white"
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

/**
 * The profile itself. Memoised: opening or closing the phone sheet re-renders the panel around it,
 * and redrawing every section then would hold up the sheet's slide.
 */
const CountryProfile = memo(function CountryProfile({
  country,
  index,
  onClose,
  onSelect,
  onLocate,
  onCompare,
  scrollRef,
}: {
  country: Country;
  index: CountryIndex;
  onClose: () => void;
  onSelect: (id: string) => void;
  onLocate: () => void;
  onCompare: (id: string) => void;
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
              className="h-[68px] w-auto max-w-[120px] rounded-[12px] bg-white object-contain shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_6px_18px_rgb(0_0_0/0.14)] transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex gap-2">
            <IconButton label="Show on map" onClick={onLocate}>
              <Crosshair className="size-[18px]" strokeWidth={2.3} />
            </IconButton>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-[18px]" strokeWidth={2.6} />
            </IconButton>
          </div>
        </div>
        <h2 className="ios-title mt-4 animate-rise text-[34px] leading-[1.06]">{country.name}</h2>
        {country.officialName !== country.name && (
          <p className="mt-1 text-[15px] leading-snug text-secondary">{country.officialName}</p>
        )}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          <Badge className={isSovereign(country) ? 'bg-tint/12 text-tint' : 'bg-ios-orange/15 text-[#b25f00]'}>{statusLabel}</Badge>
          <Badge className="bg-control text-label">{country.subregion ?? country.region}</Badge>
          <Badge className="bg-control font-mono text-label">{country.cca3}</Badge>
          <button
            type="button"
            onClick={() => onCompare(country.cca3)}
            title={`Compare ${country.name} with another country`}
            className="ios-press inline-flex items-center gap-1 rounded-full bg-tint px-3 py-1 text-[13px] font-semibold text-white"
          >
            <ArrowLeftRight aria-hidden className="size-3.5" strokeWidth={2.4} />
            Compare
          </button>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2.5 px-4">
        <QuickStat icon={Landmark} color="#007aff" label="Capital" value={country.capitals[0]?.name ?? '—'} order={0} />
        <QuickStat
          icon={Users}
          color="#af52de"
          label="People"
          value={population ? formatShortCount(population.value) : details.factbook.loading ? undefined : '—'}
          order={1}
        />
        <QuickStat
          icon={Ruler}
          color="#34c759"
          label="Area"
          value={country.area ? formatShortCount(country.area) : '—'}
          unit={country.area ? 'km²' : undefined}
          order={2}
        />
      </dl>

      <SectionNav scrollRef={scrollRef} />

      <div className="space-y-4 px-3 pb-6 sm:px-4">
        <Overview {...details} />
        <Photos {...details} />
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
});

function SectionNav({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  const navRef = useRef<HTMLDivElement>(null);
  /** A tapped tab stays lit while the panel scrolls to its section, until the next scroll by hand. */
  const holding = useRef(false);

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
        if (top && !holding.current) setActive(top[0]);
      },
      { root, rootMargin: '-64px 0px -55% 0px' },
    );
    root.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    const release = () => {
      holding.current = false;
    };
    root.addEventListener('pointerdown', release, { passive: true });
    root.addEventListener('wheel', release, { passive: true });
    root.addEventListener('keydown', release);
    return () => {
      observer.disconnect();
      root.removeEventListener('pointerdown', release);
      root.removeEventListener('wheel', release);
      root.removeEventListener('keydown', release);
    };
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
      className="no-scrollbar sticky top-0 z-20 mt-4 flex gap-1.5 overflow-x-auto border-b border-hairline bg-white/30 px-4 py-2.5 backdrop-blur-xl backdrop-saturate-150"
    >
      {SECTIONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          data-target={id}
          onClick={() => {
            setActive(id);
            holding.current = true;
            const root = scrollRef.current;
            const section = root?.querySelector<HTMLElement>(`#section-${id}`);
            if (root && section) scrollWithin(root, section, { block: 'start', offset: 64, smooth: true });
          }}
          className={clsx(
            'shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors duration-300 active:scale-95',
            active === id ? 'bg-tint text-white shadow-[0_2px_8px_rgb(0_122_255/0.28)]' : 'text-label hover:bg-control',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

/** A small widget-like tile: a tinted glyph, a caption and the figure. */
function QuickStat({
  icon: Icon,
  color,
  label,
  value,
  unit,
  order,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string | undefined;
  unit?: string;
  order: number;
}) {
  return (
    <div className="animate-pop" style={{ animationDelay: `${140 + order * 90}ms` }}>
      <div className="glass-soft min-w-0 rounded-[18px] px-3 py-2.5">
        <Icon aria-hidden className="size-[19px]" style={{ color }} strokeWidth={2.2} />
        <dt className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-secondary">{label}</dt>
        <dd className="tabular mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em] text-label" title={value}>
          {value ?? <Skeleton className="h-4 w-14" />}
          {value && unit && <span className="ml-0.5 text-[12px] font-medium text-secondary">{unit}</span>}
        </dd>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx('rounded-full px-3 py-1 text-[13px] font-semibold', className)}>{children}</span>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="ios-press grid size-9 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
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
