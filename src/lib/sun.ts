import type { Feature, Polygon } from 'geojson';
import { geoCircle } from 'd3-geo';

const RAD = Math.PI / 180;

/**
 * The subsolar point — where the sun is directly overhead — as [longitude, latitude] in degrees.
 * Low-precision solar ephemeris (U.S. Naval Observatory approximation), good to about 0.01°.
 */
export function subsolarPoint(date: Date = new Date()): [number, number] {
  const d = date.getTime() / 86_400_000 - 10_957.5; // days since J2000.0 (2000-01-01 12:00 UTC)
  const g = (357.529 + 0.98560028 * d) * RAD; // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude, degrees
  const lambda = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // ecliptic longitude
  const epsilon = (23.439 - 0.00000036 * d) * RAD; // obliquity of the ecliptic
  const rightAscension = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;
  let lon = ((rightAscension / RAD / 15 - gmstHours) * 15) % 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return [lon, declination / RAD];
}

export const antipode = ([lon, lat]: [number, number]): [number, number] => [lon > 0 ? lon - 180 : lon + 180, -lat];

/**
 * Night as nested spherical caps around the anti-solar point: the sunset line (90°) and then civil,
 * nautical and astronomical twilight (6°, 12°, 18° below the horizon). Filling each with a low
 * opacity gives a soft dusk band that deepens into night.
 */
export const NIGHT_BANDS = [
  { radius: 90, alpha: 0.14 },
  { radius: 84, alpha: 0.12 },
  { radius: 78, alpha: 0.1 },
  { radius: 72, alpha: 0.08 },
] as const;

export function nightBands(date: Date = new Date()): { feature: Feature<Polygon>; alpha: number }[] {
  const center = antipode(subsolarPoint(date));
  return NIGHT_BANDS.map(({ radius, alpha }) => ({
    feature: { type: 'Feature', properties: {}, geometry: geoCircle().center(center).radius(radius).precision(2)() },
    alpha,
  }));
}

export const NIGHT_COLOR = '25, 20, 80';
