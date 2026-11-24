import type { Country } from '../types';
import capitalData from '../data/capitals.json';
import type { FlightPlan, FlightStop } from './flight';
import type { World } from './geo';
import { capitalZone } from './timezones';

/** Where each capital is: [name, latitude, longitude], from Natural Earth (see scripts/build-data.mjs). */
const CAPITALS = capitalData as unknown as Record<string, [name: string, lat: number, lng: number]>;

/**
 * Where a flight to or from a country starts or ends: its capital, or the middle of the country
 * when it has no capital on record (Antarctica, the smallest islands).
 */
function stopFor(country: Country, world: World | undefined): FlightStop | null {
  const base = { id: country.cca3, country: country.name };
  const known = CAPITALS[country.cca3];
  if (known) return { ...base, place: known[0], capital: true, lat: known[1], lon: known[2], zone: capitalZone(country.cca2, known[0]) };

  // The country dataset's own coordinates, when it has them.
  const listed = country.capitals.find((c) => c.lat != null && c.lng != null);
  if (listed) return { ...base, place: listed.name, capital: true, lat: listed.lat!, lon: listed.lng!, zone: capitalZone(country.cca2, listed.name) };

  const centre = world?.focus.get(country.cca3)?.centroid ?? (country.latlng ? ([country.latlng[1], country.latlng[0]] as [number, number]) : null);
  if (!centre) return null;
  return { ...base, place: country.name, capital: false, lon: centre[0], lat: centre[1], zone: capitalZone(country.cca2, country.capitals[0]?.name) };
}

/** A flight between two countries, taking off now; null if either can't be placed on the map. */
export function planFlight(from: Country, to: Country, world: World | undefined): FlightPlan | null {
  const a = stopFor(from, world);
  const b = stopFor(to, world);
  return a && b ? { key: Date.now(), from: a, to: b } : null;
}
