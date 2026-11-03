import { useEffect, useMemo, useState, type RefObject } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, type CountryIndex } from '../../hooks/queries';
import { searchCountries } from '../../lib/search';
import { CountryList } from './CountryList';

export type Scope = 'all' | 'sovereign' | 'territories';
export const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctic'] as const;

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
      <div className="space-y-3 border-b border-white/[0.06] px-4 pb-4 pt-4">
        <div className="group relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500 transition-colors group-focus-within:text-brass-300" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search countries, capitals, codes…"
            aria-label="Search countries"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 && results[activeIndex] ? `country-${results[activeIndex].cca3}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-ink-800/80 pl-9 pr-16 text-[14px] text-mist-50 placeholder:text-mist-500 transition-colors focus:border-brass-400/50 focus:bg-ink-800 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-mist-400 hover:bg-white/5 hover:text-mist-100"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 px-1.5 py-0.5 font-sans text-[11px] text-mist-500 sm:block">
              /
            </kbd>
          )}
        </div>

        <div role="radiogroup" aria-label="Country type" className="grid grid-cols-3 rounded-lg bg-ink-800/70 p-0.5 text-[12px]">
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
                'flex items-baseline justify-center gap-1 whitespace-nowrap rounded-md px-1 py-1.5 font-medium transition-colors',
                scope === value ? 'bg-ink-600/80 text-mist-50 shadow-sm' : 'text-mist-400 hover:text-mist-200',
              )}
            >
              {label}
              {index && <span className="tabular text-[10.5px] text-mist-500">{count}</span>}
            </button>
          ))}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Filter by region">
          {[null, ...REGIONS].map((r) => (
            <button
              key={r ?? 'all'}
              type="button"
              aria-pressed={region === r}
              onClick={() => onRegionChange(r)}
              className={clsx(
                'shrink-0 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                region === r
                  ? 'border-brass-400/40 bg-brass-400/12 text-brass-200'
                  : 'border-white/[0.07] text-mist-400 hover:border-white/15 hover:text-mist-200',
              )}
            >
              {r ?? 'All regions'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <div className="p-6 text-center text-sm text-mist-400">
            Country data could not be loaded.
            <button type="button" onClick={onRetry} className="mt-3 block w-full text-brass-300 hover:text-brass-200">
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
        <div className="border-t border-white/[0.06] px-4 py-2.5 text-[11.5px] text-mist-500">
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
          <span className="skeleton h-4 w-6 rounded-[3px]" />
          <span className="flex-1 space-y-1.5">
            <span className="skeleton block h-3 rounded" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
            <span className="skeleton block h-2.5 w-1/4 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}
