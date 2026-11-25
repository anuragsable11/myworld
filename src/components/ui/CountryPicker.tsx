import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { Country } from '../../types';
import type { CountryIndex } from '../../hooks/queries';
import { searchCountries } from '../../lib/search';
import { Mascot } from '../game/Mascot';
import { Flag } from './Flag';

/** Well-known countries, offered when there is nothing closer to home to suggest. */
const FAMOUS = ['USA', 'CHN', 'IND', 'BRA', 'JPN', 'GBR', 'FRA', 'DEU', 'AUS', 'CAN', 'RUS', 'ZAF', 'MEX', 'EGY', 'ITA', 'KOR'];

/** `first`, then the well-known countries, without repeats and without `exclude`. */
export function withFamous(index: CountryIndex, first: string[], exclude?: string | null): Country[] {
  const ids = [...new Set([...first, ...FAMOUS])].filter((id) => id !== exclude);
  return ids.map((id) => index.byId.get(id)).filter((c): c is Country => !!c);
}

/**
 * Choosing a country inside a dialog (Compare, Flight Path): a search field over a grid of flags,
 * which shows suggestions until something is typed.
 */
export function CountryPicker({
  index,
  exclude,
  pool,
  suggestions,
  caption,
  title,
  inputId,
  action,
  onPick,
}: {
  index: CountryIndex;
  /** The country already chosen, which is left out. */
  exclude?: string | null;
  /** The countries that may be chosen, when not every one may. */
  pool?: Country[];
  /** Offered until something is typed. */
  suggestions: Country[];
  /** Says what the suggestions are. */
  caption?: string;
  title: string;
  inputId: string;
  /** Sits beside the caption, for example a "surprise me" button. */
  action?: ReactNode;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const searching = !!query.trim();
  const results = useMemo(
    () => (searching ? searchCountries(pool ?? index.sorted, query).filter((c) => c.cca3 !== exclude).slice(0, 30) : suggestions),
    [searching, query, index, pool, exclude, suggestions],
  );

  return (
    <div className="pt-2">
      <label htmlFor={inputId} className="block text-[20px] font-semibold tracking-[-0.015em] text-label">
        {title}
      </label>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-[17px] -translate-y-1/2 text-secondary" strokeWidth={2.3} />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a country or capital"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-[11px] bg-[rgb(118_118_128/0.12)] pl-9 pr-4 text-[16px] text-label transition-shadow duration-200 placeholder:text-secondary focus:shadow-[0_0_0_3px_rgb(0_122_255/0.25)] focus:outline-none"
        />
      </div>
      {!searching && (caption || action) && (
        <div className="ml-4 mt-5 flex min-h-7 items-center justify-between gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-secondary">{caption}</p>
          {action}
        </div>
      )}
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {results.map((c) => (
          <li key={c.cca3}>
            <button
              type="button"
              onClick={() => onPick(c.cca3)}
              className="ios-press flex w-full items-center gap-2.5 rounded-[14px] bg-white px-3 py-2.5 text-left hover:bg-white/70"
            >
              <Flag country={c} className="h-5 w-[30px] shrink-0 rounded-[4px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
              <span className="min-w-0 truncate text-[15px] font-medium">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {searching && !results.length && (
        <div className="mt-6 flex flex-col items-center text-center">
          <Mascot mood="think" className="w-20" />
          <p className="mt-2 text-[15px] text-secondary">No country matches “{query}”.</p>
        </div>
      )}
    </div>
  );
}
