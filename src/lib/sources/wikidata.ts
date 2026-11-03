import { fetchJson } from '../http';

/**
 * Live political facts from Wikidata: current head of state and government (statements without an
 * end date), the national anthem with its recording, and the English Wikipedia article.
 */

export interface Person {
  id: string;
  name: string;
}

export interface WikidataFacts {
  id: string;
  headsOfState: Person[];
  headOfStateOffice?: string;
  headsOfGovernment: Person[];
  headOfGovernmentOffice?: string;
  anthem?: { title: string; audioUrl?: string };
  wikipediaTitle?: string;
}

const ENDPOINT = 'https://query.wikidata.org/sparql';
const PREFERRED = 'http://wikiba.se/ontology#PreferredRank';
const DEPRECATED = 'http://wikiba.se/ontology#DeprecatedRank';

type Binding = Record<string, { value: string } | undefined>;

const buildQuery = (match: string) => `
SELECT ?item ?hos ?hosLabel ?hosRank ?hosOfficeLabel ?hog ?hogLabel ?hogRank ?hogOfficeLabel
       ?anthem ?anthemLabel ?audio ?article WHERE {
  ${match}
  OPTIONAL { ?item p:P35 ?hs . ?hs ps:P35 ?hos ; wikibase:rank ?hosRank . FILTER NOT EXISTS { ?hs pq:P582 [] } }
  OPTIONAL { ?item p:P6 ?gs . ?gs ps:P6 ?hog ; wikibase:rank ?hogRank . FILTER NOT EXISTS { ?gs pq:P582 [] } }
  OPTIONAL { ?item wdt:P1906 ?hosOffice }
  OPTIONAL { ?item wdt:P1313 ?hogOffice }
  OPTIONAL { ?item wdt:P85 ?anthem . OPTIONAL { ?anthem wdt:P51 ?audio } }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  # Many people now carry only a language-neutral ("mul") label.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
} LIMIT 200`;

async function run(query: string, signal?: AbortSignal): Promise<Binding[]> {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const json = await fetchJson<{ results: { bindings: Binding[] } }>(url, {
    signal,
    headers: { Accept: 'application/sparql-results+json' },
  });
  return json.results.bindings;
}

const capitalizeFirst = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const entityId = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);
const isEntityLabel = (label: string) => /^Q\d+$/.test(label);

function collect(rows: Binding[], key: 'hos' | 'hog'): Person[] {
  const ranked = rows.filter((r) => r[key] && r[`${key}Rank`]?.value !== DEPRECATED);
  const preferred = ranked.filter((r) => r[`${key}Rank`]?.value === PREFERRED);
  const people = new Map<string, Person>();
  for (const r of preferred.length ? preferred : ranked) {
    const id = entityId(r[key]!.value);
    const name = r[`${key}Label`]?.value;
    if (name && !isEntityLabel(name)) people.set(id, { id, name });
  }
  return [...people.values()];
}

export async function fetchWikidataFacts(
  cca3: string,
  cca2: string,
  signal?: AbortSignal,
): Promise<WikidataFacts | null> {
  const alpha3 = cca3 === 'UNK' ? 'XKX' : cca3;
  let rows = await run(buildQuery(`?item wdt:P298 "${alpha3}" .`), signal);
  if (!rows.length && /^[A-Z]{2}$/.test(cca2)) rows = await run(buildQuery(`?item wdt:P297 "${cca2}" .`), signal);
  if (!rows.length) return null;

  // Several items can share a code (rare); keep the one with a Wikipedia article.
  const itemUri = (rows.find((r) => r.article) ?? rows[0]).item!.value;
  rows = rows.filter((r) => r.item?.value === itemUri);

  const first = (key: string) => rows.find((r) => r[key]?.value && !isEntityLabel(r[key]!.value))?.[key]?.value;
  const anthemTitle = first('anthemLabel');
  const audio = rows.find((r) => r.audio)?.audio?.value.replace(/^http:/, 'https:');
  const article = first('article');

  return {
    id: entityId(itemUri),
    headsOfState: collect(rows, 'hos'),
    headOfStateOffice: capitalizeFirst(first('hosOfficeLabel')),
    headsOfGovernment: collect(rows, 'hog'),
    headOfGovernmentOffice: capitalizeFirst(first('hogOfficeLabel')),
    anthem: anthemTitle ? { title: anthemTitle, audioUrl: audio } : undefined,
    wikipediaTitle: article ? decodeURIComponent(article.slice(article.lastIndexOf('/wiki/') + 6)) : undefined,
  };
}
