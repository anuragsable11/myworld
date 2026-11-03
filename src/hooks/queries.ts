import { useQuery } from '@tanstack/react-query';
import type { Country, CountryDataset, RankedValue } from '../types';
import { loadCountries } from '../lib/sources/countries';
import { fetchFactbook, hasFactbookProfile } from '../lib/sources/factbook';
import { fetchMountains } from '../lib/sources/mountains';
import { fetchWikidataFacts } from '../lib/sources/wikidata';
import { fetchWikipediaSummary } from '../lib/sources/wikipedia';
import { fetchIndicators } from '../lib/sources/worldBank';
import { loadWorld } from '../lib/geo';

export interface CountryIndex extends CountryDataset {
  sorted: Country[];
  byId: Map<string, Country>;
  /** Rank among sovereign states by area and population. */
  ranks: Map<string, { area?: RankedValue; population?: RankedValue }>;
  sovereignCount: number;
}

export const isSovereign = (c: Country) => c.status === 'member' || c.status === 'observer' || c.status === 'partial';

function buildIndex(dataset: CountryDataset): CountryIndex {
  const sorted = [...dataset.countries].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const byId = new Map(sorted.map((c) => [c.cca3, c]));
  const sovereign = sorted.filter(isSovereign);
  const ranks = new Map<string, { area?: RankedValue; population?: RankedValue }>();
  for (const key of ['area', 'population'] as const) {
    const ranked = sovereign.filter((c) => c[key] != null).sort((a, b) => b[key]! - a[key]!);
    ranked.forEach((c, i) => ranks.set(c.cca3, { ...ranks.get(c.cca3), [key]: { rank: i + 1, of: ranked.length } }));
  }
  return { ...dataset, sorted, byId, ranks, sovereignCount: sovereign.length };
}

export function useCountryIndex() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: ({ signal }) => loadCountries(signal),
    select: buildIndex,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });
}

export function useWorld() {
  return useQuery({
    queryKey: ['world'],
    queryFn: ({ signal }) => loadWorld(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });
}

export function useMountains() {
  return useQuery({
    queryKey: ['mountains'],
    queryFn: ({ signal }) => fetchMountains(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useFactbook(cca3: string | undefined) {
  return useQuery({
    queryKey: ['factbook', cca3],
    queryFn: ({ signal }) => fetchFactbook(cca3!, signal),
    enabled: !!cca3 && hasFactbookProfile(cca3),
    staleTime: 6 * 60 * 60 * 1000,
  });
}

export function useWikidata(country: Country | undefined) {
  return useQuery({
    queryKey: ['wikidata', country?.cca3],
    queryFn: ({ signal }) => fetchWikidataFacts(country!.cca3, country!.cca2, signal),
    enabled: !!country,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function useWorldBank(cca3: string | undefined) {
  return useQuery({
    queryKey: ['worldbank', cca3],
    queryFn: ({ signal }) => fetchIndicators(cca3!, signal),
    enabled: !!cca3,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function useWikipedia(title: string | undefined) {
  return useQuery({
    queryKey: ['wikipedia', title],
    queryFn: ({ signal }) => fetchWikipediaSummary(title!, signal),
    enabled: !!title,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
}
