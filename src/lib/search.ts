import type { Country } from '../types';
import { normalizeText } from './format';

export function buildSearchText(parts: (string | undefined)[]): string {
  return ` ${parts.filter(Boolean).map((p) => normalizeText(p!)).join(' | ')} `;
}

/**
 * Ranks countries against a free-text query. Matches on common/official/native/alternate names,
 * capitals and ISO codes; diacritics and case are ignored.
 */
export function searchCountries(countries: Country[], query: string): Country[] {
  const q = normalizeText(query);
  if (!q) return countries;

  const scored: { c: Country; score: number }[] = [];
  for (const c of countries) {
    const name = normalizeText(c.name);
    let score = -1;
    if (name === q || c.cca3.toLowerCase() === q || c.cca2.toLowerCase() === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(` ${q}`)) score = 2;
    else if (name.includes(q)) score = 3;
    else if (c.searchText.includes(` ${q}`)) score = 4;
    else if (c.searchText.includes(q)) score = 5;
    if (score >= 0) scored.push({ c, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name))
    .map((s) => s.c);
}
