import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, type CountryIndex } from '../../hooks/queries';
import { searchCountries } from '../../lib/search';
import { CountryList } from './CountryList';

export type Scope = 'all' | 'sovereign' | 'territories';
export const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctic'] as const;

const REGION_EMOJI: Record<(typeof REGIONS)[number], string> = {
  Africa: '🦁',
  Americas: '🦅',
  Asia: '🐼',
  Europe: '🏰',
  Oceania: '🦘',
  Antarctic: '🐧',
};

interface SidebarProps {
  index: CountryIndex | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  region: string | null;
  onRegionChange: (region: string | null) => void;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  /** Brand row shown above the search box (desktop card). */
  header?: ReactNode;
}

export function filterCountries(countries: Country[], scope: Scope, region: string | null) {
  return countries.filter(
    (c) =>
      (scope === 'all' || (scope === 'sovereign') === isSovereign(c)) && (!region || c.region === region),
  );
}

export function Sidebar({
  index,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  region,
  onRegionChange,
  scope,
  onScopeChange,
  searchRef,
  autoFocus,
  header,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = 'country-results';

  const scoped = useMemo(() => filterCountries(index?.sorted ?? [], scope, region), [index, scope, region]);
  const results = useMemo(() => searchCountries(scoped, query), [scoped, query]);
  const counts = useMemo(() => {
    const all = index?.sorted ?? [];
    const inRegion = region ? all.filter((c) => c.region === region) : all;
    const sovereign = inRegion.filter(isSovereign).length;
    return { all: inRegion.length, sovereign, territories: inRegion.length - sovereign };
  }, [index, region]);

  useEffect(() => setActiveIndex(query ? 0 : -1), [query, scope, region]);

  useEffect(() => {
    if (autoFocus) searchRef.current?.focus();
  }, [autoFocus, searchRef]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const pick = results[Math.max(0, activeIndex)];
      if (pick) onSelect(pick.cca3);
    } else if (e.key === 'Escape' && query) {
      e.stopPropagation();
      setQuery('');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4">
        {header}
        <div className="group relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink" strokeWidth={2.8} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search countries, capitals…"
            aria-label="Search countries"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 && results[activeIndex] ? `country-${results[activeIndex].cca3}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="toon-sm h-12 w-full rounded-2xl bg-white pl-11 pr-14 text-[15px] font-bold text-ink transition-all duration-200 placeholder:font-semibold placeholder:text-slate-400 focus:-translate-x-px focus:-translate-y-px focus:bg-amber-50 focus:shadow-[4px_4px_0_0_var(--color-ink)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-pink-200 text-ink hover:bg-pink-300"
            >
              <X className="size-3.5" strokeWidth={3} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-lg border-2 border-ink bg-sun px-1.5 font-sans text-[11px] font-black text-ink shadow-[0_2px_0_0_var(--color-ink)] sm:block">
              /
            </kbd>
          )}
        </div>

        <div role="radiogroup" aria-label="Country type" className="grid grid-cols-3 gap-1 rounded-2xl border-2 border-ink bg-white p-1 text-[12px]">
          {(
            [
              ['all', 'All', counts.all],
              ['sovereign', 'Sovereign', counts.sovereign],
              ['territories', 'Territories', counts.territories],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => onScopeChange(value)}
              className={clsx(
                'flex items-baseline justify-center gap-1 whitespace-nowrap rounded-xl border-2 px-1 py-1 font-extrabold transition-all duration-300',
                scope === value ? 'border-ink bg-sun text-ink' : 'border-transparent text-slate-500 hover:text-ink',
              )}
            >
              {label}
              {index && <span className={clsx('tabular text-[10.5px] font-bold', scope === value ? 'text-ink/60' : 'text-slate-400')}>{count}</span>}
            </button>
          ))}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-28px),transparent)]" role="group" aria-label="Filter by region">
          {[null, ...REGIONS].map((r) => (
            <button
              key={r ?? 'all'}
              type="button"
              aria-pressed={region === r}
              onClick={() => onRegionChange(r)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12.5px] font-extrabold transition-all duration-200',
                region === r
                  ? 'border-ink bg-sun text-ink shadow-[2px_2px_0_0_var(--color-ink)]'
                  : 'border-ink/25 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-ink hover:text-ink',
              )}
            >
              <span aria-hidden className="text-[14px]">
                {r ? REGION_EMOJI[r] : '🌍'}
              </span>
              {r ?? 'Everywhere'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Country data could not be loaded.
            <button type="button" onClick={onRetry} className="mt-3 block w-full font-extrabold text-indigo-600 underline decoration-2 hover:text-indigo-700">
              Try again
            </button>
          </div>
        ) : loading ? (
          <ListSkeleton />
        ) : (
          <CountryList
            id={listId}
            countries={results}
            grouped={!query}
            selectedId={selectedId}
            activeId={activeIndex >= 0 ? results[activeIndex]?.cca3 : undefined}
            onSelect={onSelect}
            emptyMessage={query ? `No country matches “${query}”.` : 'No countries in this filter.'}
          />
        )}
      </div>

      {index && (
        <div className="border-t-2 border-dashed border-indigo-100 px-4 py-2.5 text-[12px] font-bold text-slate-500">
          {query || region || scope !== 'all'
            ? `${results.length} of ${index.sorted.length} shown`
            : `${index.sovereignCount} sovereign states · ${index.sorted.length - index.sovereignCount} territories`}
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-3" aria-label="Loading countries" role="status">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <span className="skeleton h-5 w-7 rounded-md" />
          <span className="flex-1 space-y-1.5">
            <span className="skeleton block h-3 rounded" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
            <span className="skeleton block h-2.5 w-1/4 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}
