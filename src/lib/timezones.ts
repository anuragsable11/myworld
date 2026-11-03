import { getCountry, getTimezone } from 'countries-and-timezones';
import { normalizeText } from './format';

/** IANA time zones for a country, from the countries-and-timezones database. */
export function zonesFor(cca2: string): string[] {
  return getCountry(cca2)?.timezones ?? [];
}

/** UTC offsets ("UTC+05:30") derived from the IANA zones, with the DST variant when it differs. */
export function offsetsFor(cca2: string): string[] {
  const out = new Set<string>();
  for (const zone of zonesFor(cca2)) {
    const tz = getTimezone(zone);
    if (!tz) continue;
    out.add(`UTC${tz.utcOffsetStr}`);
  }
  return [...out].sort(compareOffsets);
}

function offsetMinutes(s: string): number {
  const m = /UTC([+\-−])(\d{2}):(\d{2})/.exec(s);
  if (!m) return 0;
  return (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3]));
}

export const compareOffsets = (a: string, b: string) => offsetMinutes(a) - offsetMinutes(b);

/**
 * Picks the zone that best represents the capital: a zone named after it, else one matching the
 * capital's UTC offset (from the Factbook), else the country's first zone.
 */
export function capitalZone(cca2: string, capital?: string, capitalOffset?: string): string | undefined {
  const zones = zonesFor(cca2);
  if (!zones.length) return undefined;
  if (capital) {
    const c = normalizeText(capital).replace(/ /g, '_');
    const named = zones.find((z) => normalizeText(z.split('/').pop() ?? '').replace(/ /g, '_') === c);
    if (named) return named;
  }
  const m = capitalOffset ? /UTC\s*([+-])?\s*(\d{1,2})(?::(\d{2}))?/.exec(capitalOffset) : null;
  if (m) {
    const minutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
    const match = zones.find((z) => getTimezone(z)?.utcOffset === minutes);
    if (match) return match;
  }
  return zones[0];
}
