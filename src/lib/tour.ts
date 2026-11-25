import { geoDistance } from 'd3-geo';
import type { Country } from '../types';
import { isSovereign, type CountryIndex } from '../hooks/queries';
import { discovered } from './discoveries';
import { clockAt, formatDuration } from './flight';
import { formatArea, formatInteger, formatPopulation, normalizeText, ordinal } from './format';
import type { World } from './geo';
import type { MountainIndex } from './sources/mountains';
import type { SymbolIndex, SymbolKind } from './sources/symbols';
import { capitalZone, zoneOffsetMinutes } from './timezones';

/**
 * Globy's tours: a trip round one continent, a handful of countries at a time, with something
 * worth knowing about each. Nothing here is written by hand for any country: every line is worked
 * out from the same records the profiles show (sizes and ranks, neighbours, languages, national
 * symbols, peaks, the clock), and the most striking ones are chosen.
 */

export const CONTINENTS = ['Asia', 'Africa', 'Europe', 'North America', 'South America', 'Oceania'] as const;
export type Continent = (typeof CONTINENTS)[number];

/** How many countries a tour calls at. */
const STOPS = 8;

export interface TourStop {
  /** The country's ISO alpha-3 code. */
  id: string;
  /** What Globy says there: a greeting, then a fact or two. */
  lines: string[];
  /** A picture to go with it (a national animal, a dish…). */
  picture?: { src: string; caption: string };
}

export interface Tour {
  /** New for every tour, so taking the same one again starts afresh. */
  key: number;
  continent: Continent;
  stops: TourStop[];
}

export const continentOf = (country: Country) => country.continents[0] ?? country.region;

/** The countries of a continent that a tour can call at. */
export const countriesOf = (index: CountryIndex, continent: Continent): Country[] =>
  index.sorted.filter((c) => isSovereign(c) && continentOf(c) === continent && !!c.latlng);

/** How much of a continent has been explored so far. */
export function continentProgress(index: CountryIndex, continent: Continent, explored: ReadonlySet<string>) {
  const all = countriesOf(index, continent);
  return { total: all.length, explored: all.filter((c) => explored.has(c.cca3)).length };
}

/** How long a line stays up before the tour moves on by itself, in ms: long enough to read it aloud. */
export const readingMs = (text: string) => Math.max(6000, Math.min(14_000, 3000 + text.length * 55));

// ----------------------------------------------------------------------------------- the facts

/** A thing worth saying about a country, how striking it is, and its kind (two of a kind are never said together). */
interface Fact {
  family: string;
  score: number;
  text: string;
  picture?: TourStop['picture'];
}

interface Context {
  index: CountryIndex;
  continent: Continent;
  /** The continent's record holders, by country code. */
  largest?: string;
  smallest?: string;
  populous?: string;
  symbols?: SymbolIndex;
  mountains?: MountainIndex;
}

/** National symbols, the most fun first. Their names are kept as their lists write them, so each line ends on the name. */
const SYMBOLS: [SymbolKind, number, (name: string) => string][] = [
  ['animal', 64, (name) => `Meet its national animal: ${name}!`],
  ['dish', 57, (name) => `Hungry? Its national dish is called ${name}.`],
  ['bird', 52, (name) => `Look up! Its national bird: ${name}.`],
  ['flower', 44, (name) => `Its national flower: ${name}.`],
  ['tree', 42, (name) => `Its national tree: ${name}.`],
];

const list = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

function factsFor(country: Country, ctx: Context): Fact[] {
  const { index, continent } = ctx;
  const facts: Fact[] = [];
  const add = (family: string, score: number, text: string, picture?: Fact['picture']) => facts.push({ family, score, text, picture });
  const rank = index.ranks.get(country.cca3);
  const { area, population, borders } = country;

  // How big it is
  if (area && rank?.area) {
    const { rank: r, of } = rank.area;
    if (r === 1) add('size', 95, `It is the biggest country in the world: ${formatArea(area)}.`);
    else if (r === of) add('size', 95, `It is the smallest country in the world: just ${formatArea(area)}.`);
    else if (r <= 10) add('size', 72 - r, `It is the ${ordinal(r)} biggest country in the world.`);
    else if (country.cca3 === ctx.largest) add('size', 72, `It is the biggest country in ${continent}.`);
    else if (country.cca3 === ctx.smallest) add('size', 68, `It is the smallest country in ${continent}: only ${formatArea(area)}.`);
    else if (r > of - 10) add('size', 62, `It is one of the ten smallest countries in the world: only ${formatArea(area)}.`);
    else add('size', 8, `It covers ${formatArea(area)}.`);
  }

  // How many people
  if (population && rank?.population) {
    const r = rank.population.rank;
    if (r === 1) add('people', 94, `More people live here than in any other country: ${formatPopulation(population)}.`);
    else if (r <= 10) add('people', 70 - r, `It has the ${ordinal(r)} most people of any country: ${formatPopulation(population)}.`);
    else if (country.cca3 === ctx.populous) add('people', 70, `No country in ${continent} has more people: ${formatPopulation(population)}.`);
    else if (population < 100_000) add('people', 60, `Only ${formatInteger(population)} people live here. They would all fit in one big stadium!`);
    else add('people', 18, `About ${formatPopulation(population)} people live here.`);
    if (area) {
      const density = population / area;
      if (density > 1000) add('people', 58, `It is one of the most crowded places on Earth: about ${formatInteger(density)} people on every square kilometre.`);
      else if (density < 4) add('people', 56, `There is lots of room here: only about ${Math.max(1, Math.round(density))} people on every square kilometre.`);
    }
  }

  // Its neighbours and its coast
  const neighbours = borders.map((id) => index.byId.get(id)).filter((c): c is Country => !!c);
  if (country.landlocked && neighbours.length && neighbours.every((c) => c.landlocked)) {
    add('borders', 88, 'It is “doubly landlocked”: it has no coast, and neither does any of its neighbours!');
  } else if (country.landlocked && neighbours.length === 1) {
    add('borders', 80, `It sits completely inside ${neighbours[0].name}, its only neighbour.`);
  } else if (neighbours.length >= 9) {
    add('borders', 60 + neighbours.length, `It touches ${neighbours.length} other countries. That is a lot of neighbours!`);
  } else if (neighbours.length === 1) {
    add('borders', 50, `It has only one neighbour: ${neighbours[0].name}.`);
  } else if (!borders.length && !country.landlocked) {
    add('borders', 40, 'It is an island country, with no land borders at all.');
  } else if (country.landlocked) {
    add('borders', 38, 'It has no coast at all: it is landlocked.');
  }

  // What is spoken
  const { languages } = country;
  if (languages.length >= 4) add('words', 50 + Math.min(20, languages.length), `It has ${languages.length} official languages, among them ${list(languages.slice(0, 3))}.`);
  else if (languages.length >= 2) add('words', 22, `Its official languages are ${list(languages)}.`);
  else if (languages.length === 1) add('words', 12, `Its official language is ${languages[0]}.`);
  const own = country.nativeNames.find((n) => n.common && normalizeText(n.common) !== normalizeText(country.name));
  if (own) add('words', 28, `At home, people call it “${own.common}”.`);

  // National symbols, with their pictures
  const symbols = ctx.symbols?.[country.cca3];
  for (const [kind, score, say] of SYMBOLS) {
    const symbol = symbols?.[kind];
    if (symbol) add('symbol', score + (symbol.image ? 6 : 0), say(symbol.name), symbol.image ? { src: symbol.image, caption: symbol.name } : undefined);
  }

  // Its highest peak on record
  const peak = ctx.mountains?.[country.cca3]?.peaks.reduce<{ name: string; elevation: number } | null>((top, p) => (!top || p.elevation > top.elevation ? p : top), null);
  if (peak && peak.elevation >= 3000) {
    add(
      'peak',
      40 + peak.elevation / 400,
      peak.elevation >= 8000
        ? `One of the highest mountains on Earth stands here: ${peak.name}, ${formatInteger(peak.elevation)} m.`
        : `${peak.name} rises ${formatInteger(peak.elevation)} m into the sky here.`,
    );
  }

  // The clock there, against the clock here
  const capital = country.capitals[0]?.name;
  const zone = capitalZone(country.cca2, capital);
  const clock = clockAt(zone, Date.now());
  if (zone && clock) {
    const there = zoneOffsetMinutes(zone);
    const ahead = there === undefined ? 0 : there + new Date().getTimezoneOffset();
    add(
      'time',
      34,
      `Right now it is ${clock.time} in ${capital ?? country.name}${ahead ? `, ${formatDuration(Math.abs(ahead))} ${ahead > 0 ? 'ahead of' : 'behind'} your clock` : ', the same as your clock'}.`,
    );
  }

  if (country.drivingSide === 'left') add('road', 30, 'Cars drive on the left side of the road here.');
  if (country.currencies[0]) add('money', 14, `People pay with the ${country.currencies[0].name}.`);
  if (capital) add('capital', 10, `Its capital is ${capital}.`);
  return facts;
}

// ------------------------------------------------------------------------------------ the tour

const GREETINGS = [
  (name: string) => `Welcome to ${name}!`,
  (name: string) => `Next stop: ${name}!`,
  (name: string) => `Here we are in ${name}!`,
  (name: string) => `Whee! This is ${name}.`,
  (name: string) => `Now we are over ${name}.`,
];

const shuffled = <T>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Plans a tour of a continent: its record holders, then countries not explored yet, then any
 * others, visited along a path that hops from each to the nearest one left.
 */
export function buildTour(
  continent: Continent,
  index: CountryIndex,
  extras: { world?: World; symbols?: SymbolIndex; mountains?: MountainIndex } = {},
): Tour | null {
  const pool = countriesOf(index, continent);
  if (!pool.length) return null;
  const top = (key: 'area' | 'population', dir: 1 | -1) =>
    pool.filter((c) => c[key]).sort((a, b) => dir * (b[key]! - a[key]!))[0]?.cca3;
  const ctx: Context = { index, continent, largest: top('area', 1), smallest: top('area', -1), populous: top('population', 1), ...extras };

  const explored = discovered();
  const anchors = [...new Set([ctx.populous, ctx.largest, ctx.smallest])].filter((id): id is string => !!id);
  const rest = shuffled(pool.filter((c) => !anchors.includes(c.cca3)));
  // The sort is stable, so within each group the shuffle stands.
  rest.sort((a, b) => Number(explored.has(a.cca3)) - Number(explored.has(b.cca3)));
  const chosen = [...anchors.map((id) => index.byId.get(id)!), ...rest].slice(0, STOPS);

  // From the country furthest out, hop to the nearest one left each time, so the tour sweeps across the continent.
  const centre = (c: Country): [number, number] => extras.world?.focus.get(c.cca3)?.centroid ?? [c.latlng![1], c.latlng![0]];
  const middle: [number, number] = [
    chosen.reduce((sum, c) => sum + centre(c)[0], 0) / chosen.length,
    chosen.reduce((sum, c) => sum + centre(c)[1], 0) / chosen.length,
  ];
  const left = [...chosen].sort((a, b) => geoDistance(centre(b), middle) - geoDistance(centre(a), middle));
  const route = [left.shift()!];
  while (left.length) {
    const here = centre(route[route.length - 1]);
    left.sort((a, b) => geoDistance(centre(a), here) - geoDistance(centre(b), here));
    route.push(left.shift()!);
  }

  // Two facts a stop, the most striking first; a kind of fact said at the last stop waits its turn.
  const said = new Map<string, number>();
  let lastFamilies: string[] = [];
  const stops = route.map((country, i): TourStop => {
    const worth = (f: Fact) => f.score - (lastFamilies.includes(f.family) ? 26 : 0) - (said.get(f.family) ?? 0) * 9 + Math.random() * 6;
    const ranked = factsFor(country, ctx)
      .map((f) => ({ f, worth: worth(f) }))
      .sort((a, b) => b.worth - a.worth)
      .map((x) => x.f);
    const first = ranked[0];
    const second = ranked.find((f) => f.family !== first?.family);
    const picked = [first, second].filter((f): f is Fact => !!f);
    lastFamilies = picked.map((f) => f.family);
    for (const f of picked) said.set(f.family, (said.get(f.family) ?? 0) + 1);
    const greeting =
      i === 0
        ? `Hi, I'm Globy! Our tour of ${continent} starts in ${country.name}.`
        : i === route.length - 1
          ? `Last stop: ${country.name}!`
          : GREETINGS[i % GREETINGS.length](country.name);
    return { id: country.cca3, lines: [greeting, ...picked.map((f) => f.text)], picture: picked.find((f) => f.picture)?.picture };
  });

  return { key: Date.now(), continent, stops };
}
