import { geoDistance } from 'd3-geo';
import type { Country } from '../types';
import { isSovereign, type CountryIndex } from '../hooks/queries';
import { formatArea, formatPopulation, ordinal } from './format';
import type { World } from './geo';

/**
 * Mystery Country: every day Globy hides in one country, the same one for everybody. Each guess is
 * answered with how far away and which way the right country is ("hot" or "cold"), and each wrong
 * guess opens another clue from the country's own record. Solving it on days in a row builds a
 * streak. This module is the game without its screen: which country it is today, what a guess
 * earns, the clues, and what this device remembers.
 */

export const MAX_GUESSES = 6;

const DAY_MS = 86_400_000;
/** Mystery no. 1 was on 1 November 2026. */
const FIRST_DAY = Date.UTC(2026, 10, 1) / DAY_MS;

/** Which mystery a date belongs to, by this device's calendar: a new one starts at each local midnight. */
export const mysteryDay = (date = new Date()) => Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS) - FIRST_DAY;

/** How long until the next mystery, in ms. */
export function untilNextMystery(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/** A small seeded random number generator (mulberry32), so every device shuffles alike. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The countries a mystery can be, and a guess can name: every sovereign state with a place on the map. */
export const mysteryPool = (index: CountryIndex): Country[] => index.sorted.filter((c) => isSovereign(c) && !!c.latlng);

/**
 * The country of the day. The pool is shuffled afresh for each trip through it, so no country
 * comes round again until every other has had its day.
 */
export function mysteryFor(day: number, index: CountryIndex): Country | undefined {
  const ids = mysteryPool(index)
    .map((c) => c.cca3)
    .sort();
  if (!ids.length) return undefined;
  const trip = Math.floor(day / ids.length);
  const random = seeded(trip * 7919 + 20261101);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return index.byId.get(ids[((day % ids.length) + ids.length) % ids.length]);
}

// ------------------------------------------------------------------------------- hot and cold

/** The middle of a country, as [longitude, latitude]: of its main landmass when the map is loaded. */
export function centreOf(country: Country, world: World | undefined): [number, number] | null {
  return world?.focus.get(country.cca3)?.centroid ?? (country.latlng ? [country.latlng[1], country.latlng[0]] : null);
}

/** How warm a guess is, from the distance left to go. */
export const HEAT = [
  { id: 'boiling', within: 500, label: 'Boiling', color: '#ff2d55' },
  { id: 'hot', within: 1500, label: 'Hot', color: '#ff3b30' },
  { id: 'warm', within: 3000, label: 'Warm', color: '#ff9500' },
  { id: 'lukewarm', within: 6000, label: 'Lukewarm', color: '#e6b400' },
  { id: 'cold', within: 10_000, label: 'Cold', color: '#32ade6' },
  { id: 'freezing', within: Infinity, label: 'Freezing', color: '#5856d6' },
] as const;

export type Heat = (typeof HEAT)[number];

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;

/** What a wrong guess is told. */
export interface Hint {
  /** From the middle of the guess to the middle of the mystery country, in km. */
  km: number;
  /** Which way to go from the guess: degrees clockwise from north, and in words. */
  bearing: number;
  direction: (typeof COMPASS)[number];
  heat: Heat;
  /** The guess shares a border with the mystery country. */
  neighbour: boolean;
}

export function hintFor(guess: Country, answer: Country, world: World | undefined): Hint {
  const a = centreOf(guess, world) ?? [0, 0];
  const b = centreOf(answer, world) ?? [0, 0];
  const km = Math.round(geoDistance(a, b) * 6371);
  const rad = Math.PI / 180;
  const [lon1, lat1, lon2, lat2] = [a[0] * rad, a[1] * rad, b[0] * rad, b[1] * rad];
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const bearing = ((Math.atan2(y, x) / rad) % 360 + 360) % 360;
  const neighbour = answer.borders.includes(guess.cca3) || guess.borders.includes(answer.cca3);
  return {
    km,
    bearing,
    direction: COMPASS[Math.round(bearing / 45) % 8],
    // Next door is as hot as it gets, however far apart the middles of two big countries are.
    heat: neighbour ? HEAT[0] : (HEAT.find((h) => km <= h.within) ?? HEAT[HEAT.length - 1]),
    neighbour,
  };
}

// ---------------------------------------------------------------------------------- the clues

export interface Clue {
  id: 'where' | 'continent' | 'size' | 'neighbours' | 'flag' | 'capital';
  title: string;
  text: string;
}

/**
 * The six clues, from vague to telling, all read from the country's record. The first is given;
 * each wrong guess opens the next.
 */
export function cluesFor(answer: Country, index: CountryIndex, world: World | undefined): Clue[] {
  const [lon, lat] = centreOf(answer, world) ?? [0, 0];
  const island = !answer.borders.length && !answer.landlocked;
  const continent = answer.continents[0] ?? answer.region;
  const rank = index.ranks.get(answer.cca3);
  const capital = answer.capitals[0]?.name;
  const letters = capital ? [...capital].filter((ch) => /\p{L}/u.test(ch)).length : 0;
  const n = answer.borders.length;

  const size = [
    rank?.area && answer.area ? `It is the ${ordinal(rank.area.rank)} biggest country in the world (${formatArea(answer.area)}).` : null,
    answer.population ? `About ${formatPopulation(answer.population)} people live there.` : null,
  ].filter(Boolean);

  return [
    {
      id: 'where',
      title: 'Where on Earth',
      text: `${lat >= 0 ? 'North' : 'South'} of the equator, in the ${lon >= 0 ? 'eastern' : 'western'} half of the world. ${
        answer.landlocked ? 'It has no coast.' : island ? 'It is an island country.' : 'It has a coast.'
      }`,
    },
    { id: 'continent', title: 'Continent', text: `It is in ${continent}.` },
    { id: 'size', title: 'Size', text: size.length ? size.join(' ') : 'Nobody has measured it for this atlas.' },
    {
      id: 'neighbours',
      title: 'Neighbours',
      text: `${n === 0 ? 'It has no land neighbours.' : n === 1 ? 'It has just one neighbour.' : `It touches ${n} other countries.`}${
        answer.subregion && answer.subregion !== continent ? ` It is in ${answer.subregion}.` : ''
      }`,
    },
    { id: 'flag', title: 'Flag', text: 'Its flag, badly out of focus.' },
    {
      id: 'capital',
      title: 'Capital',
      text: capital
        ? `Its capital starts with “${[...capital][0].toUpperCase()}” and has ${letters} letters.`
        : answer.languages.length
          ? `People there speak ${answer.languages[0]}.`
          : 'It has no capital city.',
    },
  ];
}

// ------------------------------------------------------------------------- what is remembered

const KEY = 'atlas:mystery';

export interface MysteryRecord {
  /** The day the guesses below belong to. */
  day: number;
  /** Country codes guessed that day, in order. */
  guesses: string[];
  /** How that day's game ended, once it has. */
  result: 'won' | 'lost' | null;
  /** Days solved in a row, up to the last day solved… */
  streak: number;
  /** …which was this day. */
  lastWon: number | null;
  best: number;
  played: number;
  won: number;
}

const EMPTY: MysteryRecord = { day: -1, guesses: [], result: null, streak: 0, lastWon: null, best: 0, played: 0, won: 0 };

let record: MysteryRecord = (() => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const r = { ...EMPTY, ...(saved as Partial<MysteryRecord>) };
      if (Array.isArray(r.guesses) && r.guesses.every((id) => typeof id === 'string')) return r;
    }
  } catch {
    // Nothing saved, or it can't be read.
  }
  return EMPTY;
})();
const listeners = new Set<() => void>();

/** What this device remembers; a new object each time it changes, so it can be watched with useSyncExternalStore. */
export const mysteryRecord = () => record;

export function subscribeMystery(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The game of a given day: its guesses so far and how it ended (nothing yet, on a new day). */
export function gameOn(day: number, r: MysteryRecord = record): { guesses: string[]; result: 'won' | 'lost' | null } {
  return r.day === day ? { guesses: r.guesses, result: r.result } : { guesses: [], result: null };
}

/** Days solved in a row as of a day: a day missed, or lost, breaks it. */
export const streakOn = (day: number, r: MysteryRecord = record) => (r.lastWon != null && r.lastWon >= day - 1 && r.lastWon <= day ? r.streak : 0);

/** 'new' until the first guess of the day, then 'playing', then how it ended. */
export function mysteryStatus(day: number, r: MysteryRecord = record): 'new' | 'playing' | 'won' | 'lost' {
  const game = gameOn(day, r);
  return game.result ?? (game.guesses.length ? 'playing' : 'new');
}

/** Records a guess for the day's mystery, ending the game if it's right or the last one. */
export function guess(day: number, id: string, answerId: string): MysteryRecord {
  const game = gameOn(day);
  if (game.result || game.guesses.includes(id)) return record;
  const guesses = [...game.guesses, id];
  const won = id === answerId;
  const lost = !won && guesses.length >= MAX_GUESSES;
  // Solved the day after the last one solved: the streak grows. After a gap, it starts again at one.
  const streak = won ? (record.lastWon === day - 1 ? record.streak + 1 : 1) : lost ? 0 : record.streak;
  record = {
    ...record,
    day,
    guesses,
    result: won ? 'won' : lost ? 'lost' : null,
    streak,
    lastWon: won ? day : record.lastWon,
    best: Math.max(record.best, streak),
    played: record.played + (won || lost ? 1 : 0),
    won: record.won + (won ? 1 : 0),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // It still counts for this visit; it just won't be remembered.
  }
  listeners.forEach((fn) => fn());
  return record;
}
