import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, type CountryIndex } from '../../hooks/queries';
import { searchCountries } from '../../lib/search';
import { CountryList } from './CountryList';

export type Scope = 'all' | 'sovereign' | 'territories';
export const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctic'] as const;
const SCOPES: Scope[] = ['all', 'sovereign', 'territories'];

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
      e.preventDefault();
      e.stopPropagation();
      setQuery('');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4">
        {header}
        {/* iOS search field */}
        <div className="group relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-[17px] -translate-y-1/2 text-secondary" strokeWidth={2.3} />
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
            // 16px keeps iOS Safari from zooming in when the field is focused.
            className="h-10 w-full rounded-[11px] bg-control pl-9 pr-10 text-[16px] text-label transition-shadow duration-200 placeholder:text-secondary focus:shadow-[0_0_0_3px_rgb(0_122_255/0.25)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid size-[18px] -translate-y-1/2 place-items-center rounded-full bg-tertiary text-white hover:bg-secondary"
            >
              <X className="size-3" strokeWidth={3.2} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-[6px] bg-white/80 px-1.5 font-sans text-[11px] font-semibold text-secondary shadow-[0_0_0_0.5px_rgb(0_0_0/0.08)] sm:block">
              /
            </kbd>
          )}
        </div>

        {/* iOS segmented control: a white thumb slides along a grey track. */}
        <div role="radiogroup" aria-label="Country type" className="relative grid grid-cols-3 rounded-[10px] bg-control p-[2px] text-[13px]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-[2px] left-[2px] w-[calc((100%-4px)/3)] rounded-[8px] bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${SCOPES.indexOf(scope) * 100}%)` }}
          />
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
                'relative flex items-baseline justify-center gap-1 whitespace-nowrap rounded-[8px] px-1 py-[5px] text-label transition-colors',
                scope === value ? 'font-semibold' : 'font-medium hover:text-secondary',
              )}
            >
              {label}
              {index && <span className="tabular text-[11px] font-medium text-secondary">{count}</span>}
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
                'ios-press shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
                region === r ? 'bg-tint text-white shadow-[0_2px_8px_rgb(0_122_255/0.28)]' : 'bg-control text-label hover:bg-control-strong',
              )}
            >
              {r ?? 'Everywhere'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <div className="p-6 text-center text-[15px] text-secondary">
            Country data could not be loaded.
            <button type="button" onClick={onRetry} className="mt-3 block w-full font-semibold text-tint hover:opacity-70">
              Try Again
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
        <div className="border-t border-hairline px-4 py-2.5 text-center text-[12px] text-secondary">
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
