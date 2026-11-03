import type { Country } from '../../types';
import type { CountryIndex } from '../../hooks/queries';
import type { FactbookProfile } from '../../lib/sources/factbook';
import type { CountryMountains } from '../../lib/sources/mountains';
import type { WikidataFacts } from '../../lib/sources/wikidata';
import type { WikipediaSummary } from '../../lib/sources/wikipedia';
import type { Indicators } from '../../lib/sources/worldBank';
import { normalizeText } from '../../lib/format';

export interface Loadable<T> {
  data: T | undefined;
  loading: boolean;
}

/** Everything the panel sections render, each source loading independently. */
export interface CountryDetails {
  country: Country;
  index: CountryIndex;
  factbook: Loadable<FactbookProfile | null>;
  wikidata: Loadable<WikidataFacts | null>;
  worldBank: Loadable<Indicators>;
  wikipedia: Loadable<WikipediaSummary | null>;
  mountains: Loadable<CountryMountains | null>;
  onSelect: (id: string) => void;
}

const nameLookupCache = new WeakMap<CountryIndex, Map<string, string>>();

/**
 * Resolves a country name as written by another source ("Korea, South", "Burma",
 * "Congo, Democratic Republic of the") to an ISO alpha-3 code.
 */
export function resolveCountryName(index: CountryIndex, name: string): string | undefined {
  let lookup = nameLookupCache.get(index);
  if (!lookup) {
    lookup = new Map();
    for (const c of index.sorted) {
      for (const n of [c.name, c.officialName, ...c.altNames]) {
        const key = normalizeText(n).replace(/^the /, '');
        if (key && !lookup.has(key)) lookup.set(key, c.cca3);
      }
    }
    nameLookupCache.set(index, lookup);
  }
  const variants = [name, name.replace(/^(.*), (.*)$/, '$2 $1')];
  for (const v of variants) {
    const hit = lookup.get(normalizeText(v).replace(/^the /, ''));
    if (hit) return hit;
  }
  return undefined;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
