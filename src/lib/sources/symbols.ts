import { fetchJson } from '../http';
import symbolsUrl from '../../data/symbols.json?url';

/**
 * National animal, bird, flower, tree and dish per country, read from Wikipedia's lists of
 * national symbols by scripts/build-data.mjs, each with its article's lead picture.
 */

export type SymbolKind = 'animal' | 'bird' | 'flower' | 'tree' | 'dish';

export interface NationalSymbol {
  name: string;
  /** English Wikipedia article. */
  page: string;
  /** 500px thumbnail on Wikimedia Commons. */
  image?: string;
  /** Commons file name of the picture. */
  file?: string;
}

export type CountrySymbols = Partial<Record<SymbolKind, NationalSymbol>>;

export type SymbolIndex = Record<string, CountrySymbols>;

export const fetchSymbols = (signal?: AbortSignal) => fetchJson<SymbolIndex>(symbolsUrl, { signal });
