import { geoDistance, geoInterpolate } from 'd3-geo';

/**
 * Flight paths: a plane flies between two countries along the shortest way over the globe, and the
 * trip is described in everyday terms (how far, how long in the air, what the clock says on landing).
 * This module is the arithmetic; lib/flightPlan.ts decides where in each country a flight starts
 * and ends, and the globe draws it.
 */

/** One end of a flight: a capital city, or the middle of a country that has no capital on record. */
export interface FlightStop {
  /** The country's ISO alpha-3 code. */
  id: string;
  /** The country's name. */
  country: string;
  /** What the flight leaves from or lands at: the capital's name, or else the country's. */
  place: string;
  /** Whether `place` is the capital; otherwise it is the middle of the country. */
  capital: boolean;
  lon: number;
  lat: number;
  /** The IANA time zone there, when it is known. */
  zone?: string;
}

export interface FlightPlan {
  /** When it took off (ms since the epoch). New for every take-off, so flying a route again replays it. */
  key: number;
  from: FlightStop;
  to: FlightStop;
}

/** The same trip, flown back again. */
export const returnFlight = (plan: FlightPlan): FlightPlan => ({ key: Date.now(), from: plan.to, to: plan.from });

/** The same trip once more. */
export const sameFlight = (plan: FlightPlan): FlightPlan => ({ ...plan, key: Date.now() });

// ------------------------------------------------------------------------------------- the trip

const EARTH_RADIUS_KM = 6371;
/** Once around the Earth. */
export const EARTH_AROUND_KM = 2 * Math.PI * EARTH_RADIUS_KM;
/** A typical airliner at cruising height. */
export const CRUISE_KMH = 850;
/** Taxiing out, climbing and coming in to land add about this much to any flight. */
const GROUND_MINUTES = 30;
/** No airliner flies further than about this without landing on the way. */
export const LONGEST_NONSTOP_KM = 15_500;

const point = (stop: FlightStop): [number, number] => [stop.lon, stop.lat];

/** How far apart the two ends are along the shortest way over the globe, in km. */
export const flightKm = (plan: FlightPlan) => geoDistance(point(plan.from), point(plan.to)) * EARTH_RADIUS_KM;

/** About how long an airliner takes to fly `km`, in minutes, to the nearest five. */
export const flightMinutes = (km: number) => Math.max(5, Math.round((GROUND_MINUTES + (km / CRUISE_KMH) * 60) / 5) * 5);

/** 495 -> "8 h 15 min"; long trips are given in days ("2 days 18 h", "55 days"). */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes - h * 60);
    return m === 60 ? `${h + 1} h` : m ? `${h} h ${m} min` : `${h} h`;
  }
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  if (days >= 10 || !rest) return `${rest >= 12 ? days + 1 : days} days`;
  return rest === 24 ? `${days + 1} days` : `${days} days ${rest} h`;
}

/** The clock and the day of the week somewhere at a moment: { time: "6:40 PM", day: "Thursday" }. */
export function clockAt(zone: string | undefined, at: number): { time: string; day: string } | undefined {
  if (!zone) return undefined;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', weekday: 'long' }).formatToParts(new Date(at));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
    const time = `${get('hour')}:${get('minute')} ${get('dayPeriod')}`.trim();
    return get('hour') ? { time, day: get('weekday') } : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------- the globe's view

/**
 * A flight opens with the camera gliding to the runway while the route draws itself, for this
 * long (ms); then the plane leaves.
 */
export const FLIGHT_PREP_MS = 1500;
/** The camera never looks straight down on a pole, where a north-up globe would spin wildly. */
const CAMERA_MAX_LATITUDE = 65;
/** Take-off and landing are watched from this close, near enough to know the country. */
const CLOSE_SCALE = 1.9;
/** Short hops are flown closer still, but no closer than this, so the countries around stay in view. */
const MAX_FLIGHT_SCALE = 9;
/** A long haul is watched from a little further back than the globe usually sits. */
const WIDE_SCALE = 0.92;

/** A flight as the globe flies it. */
export interface FlightRoute {
  /** Its length as an angle at the centre of the Earth, in radians (π is halfway round). */
  angle: number;
  /** The point a share `t` (0–1) of the way along, as [longitude, latitude]. */
  at: (t: number) => [number, number];
  /** How long the plane is in the air on screen, in ms: long hauls take longer. */
  airMs: number;
  /** The zoom at take-off and landing. */
  closeScale: number;
  /** The zoom in the middle of the flight: both ends in view when they fit, else the whole globe. */
  cruiseScale: number;
  /** How high the plane climbs at the middle of the flight, as a share of the globe's radius. */
  climb: number;
}

export function flightRoute(plan: FlightPlan): FlightRoute {
  const a = point(plan.from);
  const b = point(plan.to);
  const angle = geoDistance(a, b);
  const along = geoInterpolate(a, b);
  // The zoom at which the two ends sit about half a globe's width apart.
  const fit = Math.min(MAX_FLIGHT_SCALE, 0.5 / Math.max(Math.sin(angle / 2), 1e-6));
  const closeScale = Math.max(CLOSE_SCALE, fit);
  return {
    angle,
    at: (t) => {
      const p = along(Math.max(0, Math.min(1, t)));
      // Exactly opposite points have no single shortest way between them.
      return Number.isFinite(p[0]) && Number.isFinite(p[1]) ? p : a;
    },
    airMs: Math.max(3200, Math.min(9500, 2800 + angle * 2200)),
    closeScale,
    cruiseScale: Math.max(WIDE_SCALE, Math.min(closeScale, fit)),
    // A sixth as high as the flight is long, up to about a ninth of the globe's radius.
    climb: Math.min(0.115, angle * 0.17),
  };
}

/**
 * Where the globe's camera is when the plane is a share `progress` of the way. It travels with the
 * plane, looking straight down on it, close in for the take-off, pulling back as the plane climbs
 * and closing in again for the landing, like the opening and closing shots of a film.
 */
export function flightCamera(route: FlightRoute, progress: number): { lon: number; lat: number; scale: number } {
  const [lon, lat] = route.at(progress);
  // 1 at each end, 0 through the middle of the flight; zoom is felt in ratios, so it is blended in them.
  const close = Math.pow(Math.abs(Math.cos(Math.PI * progress)), 2.4);
  const scale = route.cruiseScale * Math.pow(route.closeScale / route.cruiseScale, close);
  return { lon, lat: Math.max(-CAMERA_MAX_LATITUDE, Math.min(CAMERA_MAX_LATITUDE, lat)), scale };
}

/** How high above the ground the route is a share `t` of the way along, from 0 to 1 at its top. */
export const flightHeight = (t: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
