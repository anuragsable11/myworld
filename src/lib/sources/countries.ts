import type { Country, CountryDataset, CountryStatus, Currency } from '../../types';
import { fetchJson, fetchJsonFirst, HttpError } from '../http';
import { buildSearchText } from '../search';

/**
 * Country data providers.
 *
 * Primary: REST Countries v5 (https://restcountries.com), which requires an API key whose allowed
 * hostnames include this site. Set VITE_RESTCOUNTRIES_API_KEY to enable it.
 * Fallback: the open mledoze/countries dataset (ODbL) that the REST Countries API was originally
 * built on, with World Bank population figures.
 */

const REST_COUNTRIES_KEY = (import.meta.env.VITE_RESTCOUNTRIES_API_KEY as string | undefined)?.trim();
const REST_COUNTRIES_URL = 'https://api.restcountries.com/countries/v5';
const REST_COUNTRIES_FIELDS = [
  'names.common',
  'names.official',
  'names.alternates',
  'names.native',
  'codes',
  'capitals',
  'flag.emoji',
  'flag.url_png',
  'flag.url_svg',
  'flag.description',
  'region',
  'subregion',
  'continents',
  'landlocked',
  'borders',
  'area',
  'coordinates',
  'timezones',
  'population',
  'languages',
  'currencies',
  'calling_codes',
  'tlds',
  'demonyms',
  'government_type',
  'classification',
  'parent',
  'economy',
  'cars',
  'links',
  'descriptions',
].join(',');
// REST Countries' terms allow caching responses for up to three days.
const CACHE_KEY = 'atlas:restcountries:v5';
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

// jsDelivr first; GitHub directly if the CDN is unreachable (some mobile networks have blocked it).
const OPEN_DATASET_URLS = [
  'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json',
  'https://raw.githubusercontent.com/mledoze/countries/master/countries.json',
];
const WORLD_BANK_POPULATION_URL =
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400';

const FLAG_CDN = 'https://flags.restcountries.com/v5';
const flagUrls = (cca2: string) => ({
  png: `${FLAG_CDN}/w320/${cca2.toLowerCase()}.png`,
  svg: `${FLAG_CDN}/svg/${cca2.toLowerCase()}.svg`,
});

/** Kosovo has no ISO code; providers use either XKX or UNK. The boundaries use UNK. */
const canonicalCode = (code: string) => (code === 'XKX' ? 'UNK' : code);

export async function loadCountries(signal?: AbortSignal): Promise<CountryDataset> {
  let notice: string | undefined;
  if (REST_COUNTRIES_KEY) {
    try {
      return { countries: await loadFromRestCountries(REST_COUNTRIES_KEY, signal), provider: 'restcountries' };
    } catch (err) {
      if (signal?.aborted) throw err;
      notice = describeRestCountriesError(err);
      console.warn('[atlas] REST Countries unavailable, using the open dataset:', err);
    }
  } else {
    notice = 'No REST Countries API key is configured, so country records come from the open dataset it was built on.';
  }
  return { countries: await loadFromOpenDataset(signal), provider: 'open', notice };
}

function describeRestCountriesError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 401) return 'The REST Countries API key was rejected (401).';
    if (err.status === 403) return 'The REST Countries account is over its quota or frozen (403).';
    if (err.status === 429) return 'REST Countries is rate limiting requests (429).';
    return `REST Countries returned an error (${err.status}).`;
  }
  return 'REST Countries could not be reached — check that this hostname is allowed for the API key.';
}

// ---------------------------------------------------------------------------------------------
// REST Countries v5
// ---------------------------------------------------------------------------------------------

interface V5Name {
  common?: string;
  official?: string;
}

interface V5Country {
  names?: V5Name & { alternates?: string[]; native?: Record<string, V5Name> };
  codes?: { alpha_2?: string; alpha_3?: string; ccn3?: string };
  capitals?: { name?: string; coordinates?: { lat?: number; lng?: number }; attributes?: { primary?: boolean } }[];
  flag?: { emoji?: string; url_png?: string; url_svg?: string; description?: string };
  region?: string;
  subregion?: string;
  continents?: string[];
  landlocked?: boolean;
  borders?: string[];
  area?: { kilometers?: number };
  coordinates?: { lat?: number; lng?: number };
  timezones?: string[];
  population?: number;
  languages?: { name?: string }[];
  currencies?: { code?: string; name?: string; symbol?: string }[] | Record<string, { name?: string; symbol?: string }>;
  calling_codes?: string[];
  tlds?: string[];
  demonyms?: Record<string, { m?: string; f?: string }>;
  government_type?: string;
  classification?: {
    sovereign?: boolean;
    un_member?: boolean;
    un_observer?: boolean;
    disputed?: boolean;
    dependency?: boolean;
  };
  parent?: { alpha_3?: string };
  economy?: { gini_coefficient?: Record<string, number> };
  cars?: { driving_side?: string };
  links?: { wikipedia?: string };
  descriptions?: { long?: string; short?: string };
}

interface V5Page {
  data?: { objects?: V5Country[]; meta?: { more?: boolean; total?: number } };
}

async function loadFromRestCountries(key: string, signal?: AbortSignal): Promise<Country[]> {
  const cached = readCache();
  if (cached) return cached;

  const records: V5Country[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const url = `${REST_COUNTRIES_URL}?limit=100&offset=${offset}&response_fields=${REST_COUNTRIES_FIELDS}`;
    const page = await fetchJson<V5Page>(url, { signal, headers: { Authorization: `Bearer ${key}` } });
    records.push(...(page.data?.objects ?? []));
    if (!page.data?.meta?.more) break;
  }
  const countries = records.map(fromRestCountries).filter((c): c is Country => c !== null);
  if (countries.length < 150) throw new Error(`REST Countries returned only ${countries.length} records`);
  writeCache(countries);
  return countries;
}

function readCache(): Country[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { savedAt, countries } = JSON.parse(raw) as { savedAt: number; countries: Country[] };
    return Date.now() - savedAt < CACHE_TTL_MS && Array.isArray(countries) ? countries : null;
  } catch {
    return null;
  }
}

function writeCache(countries: Country[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), countries }));
  } catch {
    // Storage full or unavailable: the next visit simply refetches.
  }
}

function statusFromClassification(c: V5Country['classification']): CountryStatus {
  if (!c) return 'member';
  if (c.un_member) return 'member';
  if (c.un_observer) return 'observer';
  if (c.dependency) return 'territory';
  if (c.sovereign) return 'partial';
  if (c.disputed) return 'disputed';
  return 'territory';
}

function fromRestCountries(o: V5Country): Country | null {
  const cca3 = o.codes?.alpha_3 ? canonicalCode(o.codes.alpha_3) : undefined;
  const cca2 = o.codes?.alpha_2;
  const name = o.names?.common;
  if (!cca3 || !cca2 || !name) return null;

  const nativeNames = Object.entries(o.names?.native ?? {}).map(([lang, n]) => ({
    lang,
    common: n.common ?? '',
    official: n.official ?? '',
  }));
  const capitals = (o.capitals ?? [])
    .filter((c) => c.name)
    .sort((a, b) => Number(b.attributes?.primary ?? false) - Number(a.attributes?.primary ?? false))
    .map((c) => ({ name: c.name!, lat: c.coordinates?.lat, lng: c.coordinates?.lng }));
  const currencies: Currency[] = Array.isArray(o.currencies)
    ? o.currencies.filter((c) => c.code).map((c) => ({ code: c.code!, name: c.name ?? c.code!, symbol: c.symbol }))
    : Object.entries(o.currencies ?? {}).map(([code, c]) => ({ code, name: c.name ?? code, symbol: c.symbol }));
  const gini = Object.entries(o.economy?.gini_coefficient ?? {}).sort(([a], [b]) => b.localeCompare(a))[0];
  const lat = o.coordinates?.lat;
  const lng = o.coordinates?.lng;
  const fallbackFlag = flagUrls(cca2);
  const languages = (o.languages ?? []).map((l) => l.name).filter((n): n is string => !!n);

  return {
    cca3,
    cca2,
    ccn3: o.codes?.ccn3,
    name,
    officialName: o.names?.official ?? name,
    nativeNames,
    altNames: o.names?.alternates ?? [],
    capitals,
    region: o.region ?? 'Other',
    subregion: o.subregion || undefined,
    continents: o.continents ?? [],
    latlng: lat != null && lng != null ? [lat, lng] : undefined,
    area: o.area?.kilometers && o.area.kilometers > 0 ? o.area.kilometers : undefined,
    population: o.population && o.population > 0 ? o.population : undefined,
    populationSource: 'REST Countries',
    landlocked: o.landlocked,
    borders: (o.borders ?? []).map(canonicalCode),
    languages,
    currencies,
    callingCodes: (o.calling_codes ?? []).map((c) => (c.startsWith('+') ? c : `+${c}`)),
    tlds: o.tlds ?? [],
    timezones: o.timezones ?? [],
    demonym: o.demonyms?.eng?.m || o.demonyms?.eng?.f,
    governmentType: o.government_type || undefined,
    status: statusFromClassification(o.classification),
    parent: o.parent?.alpha_3 ? canonicalCode(o.parent.alpha_3) : undefined,
    flag: {
      emoji: o.flag?.emoji,
      png: o.flag?.url_png ?? fallbackFlag.png,
      svg: o.flag?.url_svg ?? fallbackFlag.svg,
      alt: o.flag?.description || undefined,
    },
    gini: gini ? { year: gini[0], value: gini[1] } : undefined,
    drivingSide: o.cars?.driving_side,
    description: o.descriptions?.long || o.descriptions?.short,
    wikipediaUrl: o.links?.wikipedia,
    searchText: buildSearchText([
      name,
      o.names?.official,
      ...(o.names?.alternates ?? []),
      ...nativeNames.flatMap((n) => [n.common, n.official]),
      ...capitals.map((c) => c.name),
      cca2,
      cca3,
    ]),
  };
}

// ---------------------------------------------------------------------------------------------
// Open dataset (mledoze/countries) + World Bank population
// ---------------------------------------------------------------------------------------------

interface OpenCountry {
  name: { common: string; official: string; nativeName?: Record<string, { common: string; official: string }> };
  tld?: string[];
  cca2: string;
  ccn3?: string;
  cca3: string;
  independent?: boolean;
  unMember?: boolean;
  currencies?: Record<string, { name: string; symbol?: string }>;
  idd?: { root?: string; suffixes?: string[] };
  capital?: string[];
  altSpellings?: string[];
  region: string;
  subregion?: string;
  languages?: Record<string, string>;
  latlng?: [number, number];
  landlocked?: boolean;
  borders?: string[];
  area?: number;
  flag?: string;
  demonyms?: Record<string, { f?: string; m?: string }>;
}

type WorldBankRow = { countryiso3code: string; value: number | null; date: string };

// The open dataset marks UN observer and partially recognised states as non-independent.
const OPEN_STATUS_OVERRIDES: Record<string, CountryStatus> = {
  VAT: 'observer',
  PSE: 'observer',
  UNK: 'partial',
  TWN: 'partial',
  ESH: 'disputed',
};

function continentsFor(region: string, subregion?: string): string[] {
  if (region === 'Americas') return [subregion === 'South America' ? 'South America' : 'North America'];
  if (region === 'Antarctic') return ['Antarctica'];
  return [region];
}

async function loadWorldBankPopulation(signal?: AbortSignal): Promise<Map<string, { value: number; year: string }>> {
  const json = await fetchJson<[unknown, WorldBankRow[] | null]>(WORLD_BANK_POPULATION_URL, { signal });
  const out = new Map<string, { value: number; year: string }>();
  for (const row of json[1] ?? []) {
    if (row.value != null && row.countryiso3code) {
      out.set(canonicalCode(row.countryiso3code), { value: row.value, year: row.date });
    }
  }
  return out;
}

async function loadFromOpenDataset(signal?: AbortSignal): Promise<Country[]> {
  const [records, population] = await Promise.all([
    fetchJsonFirst<OpenCountry[]>(OPEN_DATASET_URLS, { signal, timeoutMs: 30_000 }),
    loadWorldBankPopulation(signal).catch((err) => {
      if (signal?.aborted) throw err;
      console.warn('[atlas] World Bank population unavailable:', err);
      return new Map<string, { value: number; year: string }>();
    }),
  ]);
  return records.map((o) => fromOpenDataset(o, population.get(canonicalCode(o.cca3))));
}

function fromOpenDataset(o: OpenCountry, pop?: { value: number; year: string }): Country {
  const cca3 = canonicalCode(o.cca3);
  const nativeNames = Object.entries(o.name.nativeName ?? {}).map(([lang, n]) => ({ lang, ...n }));
  const suffixes = o.idd?.suffixes ?? [];
  const root = o.idd?.root;
  const callingCodes = root ? [suffixes.length === 1 ? `${root}${suffixes[0]}` : root] : [];
  const status: CountryStatus =
    OPEN_STATUS_OVERRIDES[cca3] ?? (o.unMember ? 'member' : o.independent ? 'partial' : 'territory');

  return {
    cca3,
    cca2: o.cca2,
    ccn3: o.ccn3,
    name: o.name.common,
    officialName: o.name.official,
    nativeNames,
    altNames: (o.altSpellings ?? []).filter((s) => s.length > 3),
    capitals: (o.capital ?? []).map((name) => ({ name })),
    region: o.region,
    subregion: o.subregion || undefined,
    continents: continentsFor(o.region, o.subregion),
    latlng: o.latlng,
    area: o.area && o.area > 0 ? o.area : undefined,
    population: pop?.value,
    populationSource: pop ? `World Bank, ${pop.year}` : undefined,
    landlocked: o.landlocked,
    borders: (o.borders ?? []).map(canonicalCode),
    languages: Object.values(o.languages ?? {}),
    currencies: Object.entries(o.currencies ?? {}).map(([code, c]) => ({ code, name: c.name, symbol: c.symbol })),
    callingCodes,
    tlds: o.tld ?? [],
    timezones: [],
    demonym: o.demonyms?.eng?.m || o.demonyms?.eng?.f,
    status,
    flag: { emoji: o.flag, ...flagUrls(o.cca2) },
    searchText: buildSearchText([
      o.name.common,
      o.name.official,
      ...(o.altSpellings ?? []),
      ...nativeNames.flatMap((n) => [n.common, n.official]),
      ...(o.capital ?? []),
      o.cca2,
      cca3,
    ]),
  };
}
