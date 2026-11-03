import factbookIndex from '../../data/factbook-index.json';
import { titleCase } from '../format';
import { fetchJsonFirst } from '../http';

/**
 * CIA World Factbook profiles, via the public-domain factbook/factbook.json mirror.
 * Raw profiles are free text with light HTML; this module turns the fields the app shows into
 * structured values and plain text (never HTML).
 */

const INDEX = factbookIndex as Record<string, string>;
const MIRRORS = [
  'https://cdn.jsdelivr.net/gh/factbook/factbook.json@master',
  'https://raw.githubusercontent.com/factbook/factbook.json/master',
];

export const hasFactbookProfile = (cca3: string) => cca3 in INDEX;
export const factbookPageUrl = (cca3: string) =>
  INDEX[cca3] ? `https://github.com/factbook/factbook.json/blob/master/${INDEX[cca3]}.json` : undefined;

export interface NamedValue {
  name: string;
  value?: number;
  detail?: string;
}

export interface FactbookProfile {
  background?: string;
  location?: string;
  coordinates?: [number, number];
  area?: { total?: string; land?: string; water?: string };
  landBoundaries?: { total?: string; borders: NamedValue[] };
  coastline?: string;
  climate?: string;
  terrain?: string;
  elevation?: { highest?: NamedValue; lowest?: NamedValue; mean?: string };
  naturalResources: string[];
  naturalHazards?: string;
  rivers: NamedValue[];
  lakes: NamedValue[];
  population?: { value: number; year?: string };
  nationality?: { noun?: string; adjective?: string };
  ethnicGroups?: string;
  languages?: string;
  religions: NamedValue[];
  religionsText?: string;
  medianAge?: string;
  lifeExpectancy?: string;
  urbanization?: string;
  cities: { name: string; value: number; capital: boolean }[];
  citiesYear?: string;
  governmentType?: string;
  capital?: { name?: string; coordinates?: [number, number]; timeDifference?: string };
  chiefOfState?: string;
  headOfGovernment?: string;
  independence?: string;
  nationalHoliday?: string;
  anthem?: { title?: string; composers?: string };
  economicOverview?: string;
  gdpPpp?: string;
  gdpOfficial?: string;
  gdpPerCapitaPpp?: string;
  gdpGrowth?: string;
  inflation?: string;
  unemployment?: string;
  industries: string[];
  industriesText?: string;
  agriculturalProducts: string[];
  exports?: string;
  exportPartners?: string;
}

export async function fetchFactbook(cca3: string, signal?: AbortSignal): Promise<FactbookProfile | null> {
  const path = INDEX[cca3];
  if (!path) return null;
  const raw = await fetchJsonFirst<RawNode>(
    MIRRORS.map((m) => `${m}/${path}.json`),
    { signal },
  );
  return parseProfile(raw);
}

// ---------------------------------------------------------------------------------------------
// Raw access helpers
// ---------------------------------------------------------------------------------------------

type RawNode = { text?: string; [key: string]: unknown };

/** Case- and whitespace-insensitive child lookup; a trailing '*' matches a key prefix. */
function child(node: unknown, key: string): RawNode | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const want = key.toLowerCase();
  const prefix = want.endsWith('*') ? want.slice(0, -1) : null;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const kk = k.trim().toLowerCase();
    if (prefix ? kk.startsWith(prefix) : kk === want) return v as RawNode;
  }
  return undefined;
}

function at(node: unknown, ...path: string[]): RawNode | undefined {
  return path.reduce<RawNode | undefined>((n, k) => child(n, k), node as RawNode);
}

/** For series keyed by year ("Real GDP per capita 2024"), returns the latest entry. */
function latest(node: RawNode | undefined): RawNode | undefined {
  if (!node) return undefined;
  if (typeof node.text === 'string') return node;
  let best: { year: number; v: RawNode } | undefined;
  for (const [k, v] of Object.entries(node)) {
    const year = Number(/(\d{4})\s*$/.exec(k)?.[1]);
    if (year && (!best || year > best.year)) best = { year, v: v as RawNode };
  }
  return best?.v;
}

const domParser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

/** Converts Factbook HTML fragments to plain text, keeping paragraph breaks. */
export function htmlToText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const marked = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '\n');
  const text = domParser
    ? domParser.parseFromString(marked, 'text/html').body.textContent ?? ''
    : marked.replace(/<[^>]+>/g, '');
  const clean = text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return clean && !/^(none|NA|na)$/.test(clean) ? clean : undefined;
}

const text = (node: RawNode | undefined) => htmlToText(node?.text);

/** Drops trailing "note:" paragraphs that the Factbook appends to many fields. */
const withoutNotes = (s: string | undefined) => s?.split(/\n+\s*notes?\s*\d*\s*:/i)[0].trim() || undefined;

/** Splits on commas (or another separator) that are not inside parentheses. */
function splitTopLevel(s: string, separators = ','): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (depth === 0 && separators.includes(ch)) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const toNumber = (s: string) => Number(s.replace(/,/g, ''));

/** "46 00 N, 2 00 E" -> [46, 2] */
function parseDms(s: string | undefined): [number, number] | undefined {
  const m = /(\d+)\s+(\d+)\s*([NS])\s*,\s*(\d+)\s+(\d+)\s*([EW])/.exec(s ?? '');
  if (!m) return undefined;
  const lat = (Number(m[1]) + Number(m[2]) / 60) * (m[3] === 'S' ? -1 : 1);
  const lng = (Number(m[4]) + Number(m[5]) / 60) * (m[6] === 'W' ? -1 : 1);
  return [lat, lng];
}

/** Uses the first segment of multi-territory text ("metropolitan France: …\n\nFrench Guiana: …"). */
function firstSegment(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const first = s.split(/\n{2,}/)[0];
  return first.replace(/^[^:\n]{2,40}:\s*/, (label) => (/\d/.test(label) ? label : '')).trim();
}

/** Factbook writes surnames in capitals ("Emmanuel MACRON"); restore normal casing. */
export function restoreNameCase(s: string): string {
  let depth = 0;
  return s.replace(/[()]|\b[A-Z][A-Z'’.-]*[A-Z]\b/g, (token) => {
    if (token === '(') depth++;
    else if (token === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && !/^[IVX]+$/.test(token)) return titleCase(token);
    return token;
  });
}

/** "640,427 sq km ; 549,970 sq km (metropolitan France)" -> "640,427 km²" */
function measure(s: string | undefined): string | undefined {
  return s?.split(/\s*;\s*/)[0].replace(/\bsq km\b/g, 'km²').trim() || undefined;
}

// ---------------------------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------------------------

function parseRivers(s: string | undefined): NamedValue[] {
  const body = withoutNotes(s);
  if (!body) return [];
  return splitTopLevel(firstSegment(body) ?? body, ';')
    .map((part) => {
      const m = /^(.*?)\s+-\s+([\d,.]+)\s*(?:sq\s*)?km/.exec(part);
      if (!m) return null;
      // Everything from "(shared with" / "(mouth shared with" onward describes other countries;
      // match loosely because the source occasionally has unbalanced parentheses.
      const sharedAt = m[1].search(/\((?:[a-z]+ )?shared with/i);
      const shared =
        sharedAt >= 0
          ? m[1]
              .slice(sharedAt)
              .replace(/^\(([a-z]+ )?shared with\s*/i, '')
              .replace(/\[[sm]\]|[()]/g, '')
              .replace(/\s+,/g, ',')
              .replace(/\s{2,}/g, ' ')
              .trim()
          : undefined;
      const name = (sharedAt >= 0 ? m[1].slice(0, sharedAt) : m[1])
        .replace(/\s+river\s+(mouth|source)\b/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return { name, value: toNumber(m[2]), detail: shared ? `Shared with ${shared}` : undefined };
    })
    .filter((r): r is { name: string; value: number; detail: string | undefined } => !!r && !!r.name);
}

function parseLakes(node: RawNode | undefined): NamedValue[] {
  if (!node) return [];
  const all = Object.entries(node)
    .filter(([k]) => k !== 'note')
    .map(([, v]) => htmlToText((v as RawNode)?.text))
    .filter(Boolean)
    .join('; ');
  return parseRivers(all);
}

function parseNamedMeasure(s: string | undefined): NamedValue | undefined {
  if (!s) return undefined;
  const m = /^(.*?)\s+(-?[\d,.]+)\s*(m\b)?(.*)$/.exec(s);
  if (!m) return { name: s };
  return { name: m[1].trim(), value: toNumber(m[2]), detail: m[4].trim().replace(/^\(|\)$/g, '') || undefined };
}

function parseBorders(s: string | undefined): NamedValue[] {
  const body = withoutNotes(s);
  if (!body) return [];
  return splitTopLevel(body.replace(/\n/g, ' '), ';').flatMap((part): NamedValue[] => {
    const m = /^(.*?)\s+([\d,.]+)\s*km(.*)$/.exec(part.replace(/^[^:]{2,40}:\s*/, ''));
    if (!m) return [];
    return [{ name: m[1].trim(), value: toNumber(m[2]), detail: m[3].trim().replace(/^\(|\)$/g, '') || undefined }];
  });
}

function parseReligions(s: string | undefined): NamedValue[] {
  const body = withoutNotes(firstSegment(s));
  if (!body) return [];
  const parts = splitTopLevel(body.replace(/\s*\((?:\d{4})[^)]*\)\s*$/, ''));
  const out: NamedValue[] = [];
  for (const part of parts) {
    const m = /^(.*?)\s+([\d.]+)%\s*(.*)$/.exec(part);
    if (!m) continue;
    const inline = /\(([^)]*)\)/.exec(m[1])?.[1];
    const name = m[1].replace(/\([^)]*\)/g, '').trim();
    const detail = [inline, m[3].replace(/^\(|\)$/g, '').replace(/\)\s*\(/g, '; ')].filter(Boolean).join('; ');
    out.push({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Number(m[2]), detail: detail || undefined });
  }
  return out.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

function parseCities(s: string | undefined): { cities: FactbookProfile['cities']; year?: string } {
  if (!s) return { cities: [] };
  const body = s.replace(/\n/g, ' ');
  // Figures can carry different years ("… (2018); … (2022)"); report the latest.
  const years = [...body.matchAll(/\((\d{4})\)/g)].map((m) => m[1]).sort();
  const items = body.split(/[,;]\s+(?=\d[\d.,]*\s*(?:million|thousand)?\s+\S)/);
  const cities = items
    .map((item) => {
      const m = /^([\d.,]+)\s*(million|thousand)?\s+(.+)$/.exec(item.trim());
      if (!m) return null;
      const mult = m[2] === 'million' ? 1e6 : m[2] === 'thousand' ? 1e3 : 1;
      const capital = /capital\)/i.test(m[3]);
      let name = m[3]
        .replace(/\s*\(\d{4}\)/g, '')
        .replace(/\s*\([^)]*(?:capital|seat of government)[^)]*\)/gi, '')
        .trim();
      if (name === name.toUpperCase()) name = titleCase(name);
      return { name, value: Math.round(toNumber(m[1]) * mult), capital };
    })
    .filter((c): c is { name: string; value: number; capital: boolean } => !!c && c.value > 0);
  return { cities: cities.sort((a, b) => b.value - a.value), year: years.at(-1) };
}

function parseList(s: string | undefined): string[] {
  const body = withoutNotes(firstSegment(s));
  if (!body) return [];
  return splitTopLevel(body.replace(/\s*\(\d{4}[^)]*\)\s*$/, ''), ',;')
    .map((item) => item.replace(/\.$/, '').trim())
    .filter((item) => item && item.length < 80);
}

function parsePopulation(s: string | undefined): FactbookProfile['population'] {
  const m = /^([\d,]+)\s*(?:\((?:[^)]*?)(\d{4})[^)]*\))?/.exec(s ?? '');
  return m ? { value: toNumber(m[1]), year: m[2] } : undefined;
}

function parseProfile(raw: RawNode): FactbookProfile {
  const geo = at(raw, 'Geography');
  const people = at(raw, 'People and Society');
  const gov = at(raw, 'Government');
  const econ = at(raw, 'Economy');

  const industriesText = withoutNotes(text(at(econ, 'Industries')));
  const industries = parseList(industriesText);
  const languagesNode = at(people, 'Languages');
  const anthemNode = at(gov, 'National anthem*');
  const cities = parseCities(text(at(people, 'Major urban areas - population')));
  const elevation = at(geo, 'Elevation');
  const religionsText = text(at(people, 'Religions'));
  const capital = at(gov, 'Capital');
  const executive = at(gov, 'Executive branch');

  return {
    background: text(at(raw, 'Introduction', 'Background')),
    location: firstSegment(text(at(geo, 'Location'))),
    coordinates: parseDms(text(at(geo, 'Geographic coordinates'))),
    area: {
      total: measure(firstSegment(text(at(geo, 'Area', 'total')))),
      land: measure(firstSegment(text(at(geo, 'Area', 'land')))),
      water: measure(firstSegment(text(at(geo, 'Area', 'water')))),
    },
    landBoundaries: {
      total: text(at(geo, 'Land boundaries', 'total')),
      borders: parseBorders(text(at(geo, 'Land boundaries', 'border countries*'))),
    },
    coastline: measure(withoutNotes(text(at(geo, 'Coastline')))),
    climate: withoutNotes(text(at(geo, 'Climate'))),
    terrain: withoutNotes(text(at(geo, 'Terrain'))),
    elevation: {
      highest: parseNamedMeasure(firstSegment(text(at(elevation, 'highest point')))),
      lowest: parseNamedMeasure(firstSegment(text(at(elevation, 'lowest point')))),
      mean: text(at(elevation, 'mean elevation')),
    },
    naturalResources: parseList(text(at(geo, 'Natural resources'))),
    naturalHazards: withoutNotes(text(at(geo, 'Natural hazards'))),
    rivers: parseRivers(text(at(geo, 'Major rivers*'))),
    lakes: parseLakes(at(geo, 'Major lakes*')),
    population: parsePopulation(text(at(people, 'Population', 'total')) ?? text(at(people, 'Population'))),
    nationality: {
      noun: text(at(people, 'Nationality', 'noun')),
      adjective: text(at(people, 'Nationality', 'adjective')),
    },
    ethnicGroups: withoutNotes(text(at(people, 'Ethnic groups'))),
    languages: withoutNotes(text(at(languagesNode, 'Languages')) ?? text(languagesNode)),
    religions: parseReligions(religionsText),
    religionsText: withoutNotes(religionsText),
    medianAge: text(at(people, 'Median age', 'total')),
    lifeExpectancy: text(at(people, 'Life expectancy at birth', 'total population')),
    urbanization: text(at(people, 'Urbanization', 'urban population')),
    cities: cities.cities,
    citiesYear: cities.year,
    governmentType: withoutNotes(text(at(gov, 'Government type'))),
    capital: {
      name: firstSegment(text(at(capital, 'name'))),
      coordinates: parseDms(text(at(capital, 'geographic coordinates'))),
      timeDifference: firstSegment(text(at(capital, 'time difference'))),
    },
    chiefOfState: withoutNotes(text(at(executive, 'chief of state'))),
    headOfGovernment: withoutNotes(text(at(executive, 'head of government'))),
    independence: withoutNotes(text(at(gov, 'Independence'))),
    nationalHoliday: withoutNotes(text(at(gov, 'National holiday*'))),
    anthem: anthemNode
      ? {
          title: firstSegment(text(at(anthemNode, 'title')) ?? text(at(anthemNode, 'name'))),
          composers: text(at(anthemNode, 'lyrics/music')),
        }
      : undefined,
    economicOverview: text(at(econ, 'Economic overview')),
    gdpPpp: text(latest(at(econ, 'Real GDP (purchasing power parity)'))),
    gdpOfficial: text(at(econ, 'GDP (official exchange rate)')),
    gdpPerCapitaPpp: text(latest(at(econ, 'Real GDP per capita'))),
    gdpGrowth: text(latest(at(econ, 'Real GDP growth rate'))),
    inflation: text(latest(at(econ, 'Inflation rate*'))),
    unemployment: text(latest(at(econ, 'Unemployment rate'))),
    industries: industries.some((i) => i.split(' ').length > 4) ? [] : industries,
    industriesText,
    agriculturalProducts: parseList(text(at(econ, 'Agricultural products'))),
    exports: firstSegment(text(at(econ, 'Exports - commodities'))),
    exportPartners: firstSegment(text(at(econ, 'Exports - partners'))),
  };
}
