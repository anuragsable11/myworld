/**
 * Generates the static geographic assets the app loads at runtime:
 *
 *   src/data/world.topo.json      Natural Earth 1:50m boundaries (via world-atlas), keyed by ISO 3166-1 alpha-3,
 *                                 with India drawn as the Government of India's official map shows it
 *   src/data/mountains.json       Notable peaks and mountain ranges per country (Natural Earth 1:10m)
 *   src/data/factbook-index.json  ISO alpha-3 -> CIA World Factbook profile path (factbook/factbook.json)
 *   src/data/symbols.json         National animal, bird, flower, tree and dish per country, read from
 *                                 Wikipedia's lists of national symbols, with each article's lead picture
 *
 * Usage: npm run data            (everything)
 *        npm run data -- symbols (only the named steps: boundaries, mountains, factbook, symbols)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import polygonClipping from 'polygon-clipping';
import { geoArea, geoCentroid, geoContains, geoDistance } from 'd3-geo';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COUNTRIES_URL = 'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json';
const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const FACTBOOK_TREE = 'https://api.github.com/repos/factbook/factbook.json/git/trees/master?recursive=1';
const FACTBOOK_CDN = 'https://cdn.jsdelivr.net/gh/factbook/factbook.json@master';

// Natural Earth features that carry no ISO numeric id.
const UNCODED_FEATURES = {
  Kosovo: 'UNK',
  'N. Cyprus': 'CYP',
  Somaliland: 'SOM',
};

// Natural Earth draws these overseas areas inside their parent country's geometry, while the
// country datasets list them as separate entries. Polygon parts near each territory are split out.
const TERRITORY_SPLITS = {
  FRA: ['GUF', 'GLP', 'MTQ', 'MYT', 'REU'],
  NOR: ['SJM'],
  NLD: ['BES'],
  'Indian Ocean Ter.': ['CXR', 'CCK'],
};
const SPLIT_RADIUS_KM = 450;

// Factbook profiles whose names differ too much from any name/alt-spelling in the country dataset.
const FACTBOOK_OVERRIDES = {
  'Congo, Democratic Republic of the': 'COD',
  'Congo, Republic of the': 'COG',
  'Korea, North': 'PRK',
  'Korea, South': 'KOR',
  'Gambia, The': 'GMB',
  'Bahamas, The': 'BHS',
  'Micronesia, Federated States of': 'FSM',
  'Holy See (Vatican City)': 'VAT',
  'Saint Helena, Ascension, and Tristan da Cunha': 'SHN',
  'Heard Island and McDonald Islands': 'HMD',
  'Burma': 'MMR',
  'Cabo Verde': 'CPV',
  'Czechia': 'CZE',
  'Eswatini': 'SWZ',
  'Timor-Leste': 'TLS',
  'Turkey (Turkiye)': 'TUR',
  'Turkiye': 'TUR',
  "Cote d'Ivoire": 'CIV',
  'Gaza Strip': null,
  'West Bank': 'PSE',
  'Svalbard': 'SJM',
  'Jan Mayen': null,
  'Saint Barthelemy': 'BLM',
  'Saint Martin': 'MAF',
  'Sint Maarten': 'SXM',
  'Curacao': 'CUW',
  'Aruba': 'ABW',
  'Virgin Islands': 'VIR',
  'British Virgin Islands': 'VGB',
  'Pitcairn Islands': 'PCN',
  'Falkland Islands (Islas Malvinas)': 'FLK',
  'French Southern and Antarctic Lands': 'ATF',
  'South Georgia and South Sandwich Islands': 'SGS',
  'Wallis and Futuna': 'WLF',
  'Macau': 'MAC',
  'Hong Kong': 'HKG',
  'Taiwan': 'TWN',
  'Kosovo': 'UNK',
  'Western Sahara': 'ESH',
  'United States Pacific Island Wildlife Refuges': 'UMI',
  'Wake Island': null,
  'Midway Islands': null,
};

// Factbook profiles keyed by file, where the profile name is a list of places.
const FACTBOOK_FILE_OVERRIDES = {
  'australia-oceania/um.json': 'UMI',
};

const decodeEntities = (s) =>
  String(s ?? '')
    .replace(/&([a-zA-Z])(acute|grave|circ|uml|tilde|cedil|ring|slash);/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

const norm = (s) =>
  decodeEntities(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&[a-z]+;/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function getJson(url, init) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 3) throw new Error(`GET ${url} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------------------------
async function buildBoundaries(countries) {
  const topo = await withIndiaOfficialBoundaries(
    JSON.parse(await fs.readFile(path.join(root, 'node_modules/world-atlas/countries-50m.json'), 'utf8')),
  );
  const byNumeric = new Map(countries.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));
  const byCode = new Map(countries.map((c) => [c.cca3, c]));
  const object = topo.objects.countries;
  const geometries = [];

  const polygonsOf = (g) => (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []);
  const asFeature = (arcs) => feature(topo, { type: 'MultiPolygon', arcs });

  for (const g of object.geometries) {
    const name = g.properties?.name;
    let code = g.id != null ? byNumeric.get(g.id)?.cca3 : undefined;
    if (code === undefined && name in UNCODED_FEATURES) code = UNCODED_FEATURES[name];
    if (code === undefined && name in TERRITORY_SPLITS) code = null;
    if (code === undefined) {
      console.warn(`  ! unmatched boundary feature: ${name} (${g.id})`);
      continue;
    }

    const splitKey = code && TERRITORY_SPLITS[code] ? code : TERRITORY_SPLITS[name] ? name : null;
    if (!splitKey) {
      geometries.push({ ...g, id: code ?? undefined, properties: { name } });
      continue;
    }

    // Partition polygon parts between the parent and nearby territories.
    const territories = TERRITORY_SPLITS[splitKey].map((t) => byCode.get(t)).filter(Boolean);
    const buckets = new Map();
    const polys = polygonsOf(g);
    const largest = polys.reduce(
      (best, arcs, i) => {
        const a = geoArea(asFeature([arcs]));
        return a > best.a ? { a, i } : best;
      },
      { a: -1, i: 0 },
    ).i;
    polys.forEach((arcs, i) => {
      const centroid = geoCentroid(asFeature([arcs]));
      let owner = splitKey === code && i === largest ? code : null;
      if (!owner) {
        let bestKm = Infinity;
        for (const t of territories) {
          const km = geoDistance(centroid, [t.latlng[1], t.latlng[0]]) * 6371;
          if (km < bestKm && km < SPLIT_RADIUS_KM) {
            bestKm = km;
            owner = t.cca3;
          }
        }
      }
      owner ??= code;
      if (!buckets.has(owner)) buckets.set(owner, []);
      buckets.get(owner).push(arcs);
    });
    for (const [owner, arcs] of buckets) {
      geometries.push({
        type: 'MultiPolygon',
        arcs,
        id: owner,
        properties: { name: owner === code ? name : byCode.get(owner)?.name.common ?? name },
      });
    }
  }

  object.geometries = geometries;
  const out = path.join(root, 'src/data/world.topo.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(topo));

  const covered = new Set(geometries.map((g) => g.id).filter(Boolean));
  const without = countries.filter((c) => !covered.has(c.cca3)).map((c) => c.cca3);
  console.log(`  boundaries: ${geometries.length} geometries, ${covered.size} countries`);
  console.log(`  no polygon (rendered as markers): ${without.join(', ')}`);
  return feature(topo, object).features;
}

/**
 * Natural Earth's de facto boundaries give Pakistan-administered Kashmir and Gilgit-Baltistan to
 * Pakistan, Aksai Chin and the Shaksgam valley to China, and leave the Siachen glacier on its own.
 * India's official map shows all of them as part of India (Jammu and Kashmir, and Ladakh). Natural
 * Earth's disputed-area polygons record each country's official view, so the areas India's view
 * assigns to it move from the countries administering them into India. Other borders are unchanged.
 */
async function withIndiaOfficialBoundaries(base) {
  const disputed = await getJson(`${NE_BASE}/ne_50m_admin_0_breakaway_disputed_areas.geojson`);
  const { features } = feature(base, base.objects.countries);
  const named = (name) => features.find((f) => f.properties.name === name);
  const [india, pakistan, china, siachen] = ['India', 'Pakistan', 'China', 'Siachen Glacier'].map(named);

  // The disputed areas come from a newer Natural Earth release than world-atlas. Snapping them to
  // world-atlas's quantization grid lines up the borders the two releases draw identically.
  const [kx, ky] = base.transform.scale;
  const [tx, ty] = base.transform.translate;
  const snap = ([x, y]) => [Math.round((x - tx) / kx) * kx + tx, Math.round((y - ty) / ky) * ky + ty];
  const claimed = polygonClipping.union(
    ...disputed.features
      .filter((f) => f.properties.ADM0_A3_IN === 'IND' && f.properties.ADM0_A3 !== 'IND')
      .map((f) => polygonCoords(f.geometry).map((poly) => poly.map((ring) => ring.map(snap)))),
  );
  const claimBox = coordsBox(claimed.flat(2));

  const gained = [polygonCoords(india.geometry), polygonCoords(siachen.geometry)];
  for (const f of [pakistan, china]) {
    const coords = polygonCoords(f.geometry);
    const kept = [];
    for (const poly of polygonClipping.difference(coords, claimed)) {
      // Where the two releases' lines differ slightly, slivers of a few km² are left behind.
      if (clippedArea(poly) < 50 && boxesOverlap(coordsBox(poly[0]), claimBox)) gained.push([poly]);
      else kept.push(poly);
    }
    gained.push(polygonClipping.intersection(coords, claimed));
    f.geometry = clippedGeometry(kept);
  }
  india.geometry = clippedGeometry(polygonClipping.union(...gained));

  const total = (polys) => Math.round(polys.reduce((sum, poly) => sum + clippedArea(poly), 0));
  console.log(`  India's official boundaries: ${total(gained.slice(2).flat())} km² added from Pakistan and China`);
  return topology({ countries: { type: 'FeatureCollection', features: features.filter((f) => f !== siachen) } }, 1e5);
}

const polygonCoords = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
// polygon-clipping winds outer rings anticlockwise; d3 and world-atlas wind them clockwise.
const clockwise = (poly) => poly.map((ring) => [...ring].reverse());
const clippedGeometry = (polys) => ({ type: 'MultiPolygon', coordinates: polys.map(clockwise) });
const clippedArea = (poly) => geoArea({ type: 'Polygon', coordinates: clockwise(poly) }) * 6371 ** 2;

function coordsBox(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const boxesOverlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

// ---------------------------------------------------------------------------------------------
// Mountains
// ---------------------------------------------------------------------------------------------
async function buildMountains(features) {
  const [points, regions] = await Promise.all([
    getJson(`${NE_BASE}/ne_10m_geography_regions_elevation_points.geojson`),
    getJson(`${NE_BASE}/ne_10m_geography_regions_polys.geojson`),
  ]);
  const selectable = features.filter((f) => f.id).map((f) => ({ f, box: lonLatBox(f) }));
  const BORDER = 1.5 / 6371; // peaks within ~1.5 km of a boundary belong to both countries
  const COAST = 25 / 6371; // coastal points can fall just outside 1:50m polygons

  const containing = (pt) => {
    const near = selectable.filter(({ box }) => inBox(box, pt, 0.5));
    const hits = new Set(near.filter(({ f }) => geoContains(f, pt)).map(({ f }) => f.id));
    let nearest = null;
    let nearestD = COAST;
    for (const { f } of near) {
      if (hits.has(f.id)) continue;
      const d = nearestEdge(f, pt);
      if (hits.size && d < BORDER) hits.add(f.id);
      if (d < nearestD) {
        nearestD = d;
        nearest = f.id;
      }
    }
    if (!hits.size && nearest) hits.add(nearest);
    return [...hits];
  };

  const result = {};
  const entry = (code) => (result[code] ??= { peaks: [], ranges: [] });
  const mountains = points.features.filter(
    (f) => f.properties.featurecla === 'mountain' && f.properties.elevation > 0,
  );
  const peakCountries = await wikidataCountries(mountains.map((f) => f.properties.wikidataid));

  for (const f of mountains) {
    const p = f.properties;
    const name = p.name_en || p.name;
    if (!name) continue;
    const [lon, lat] = f.geometry.coordinates;
    // Geometry decides the owner; Wikidata adds countries sharing the summit (e.g. Mont Blanc),
    // but not distant sovereigns of overseas territories (e.g. the UK for Tristan da Cunha).
    const codes = new Set(containing([lon, lat]));
    for (const code of peakCountries.get(p.wikidataid) ?? []) {
      const owner = selectable.find(({ f: c }) => c.id === code);
      if (owner && nearestEdge(owner.f, [lon, lat]) < 30 / 6371) codes.add(code);
    }
    if (peakCountries.has(p.wikidataid)) {
      const wd = peakCountries.get(p.wikidataid);
      for (const code of [...codes]) if (!wd.includes(code) && codes.size > 1) codes.delete(code);
    }
    for (const code of codes) {
      entry(code).peaks.push({
        name,
        elevation: Math.round(p.elevation),
        lat: +lat.toFixed(3),
        lng: +lon.toFixed(3),
        ...(p.wikidataid ? { wikidata: p.wikidataid } : {}),
      });
    }
  }

  for (const f of regions.features) {
    const p = f.properties;
    if (p.FEATURECLA !== 'Range/mtn' || !p.NAME) continue;
    const codes = new Map();
    for (const pt of samplePoints(f.geometry, 60)) {
      const candidates = selectable.filter(({ box }) => inBox(box, pt, 0));
      for (const code of candidates.filter(({ f: c }) => geoContains(c, pt)).map(({ f: c }) => c.id)) {
        codes.set(code, (codes.get(code) ?? 0) + 1);
      }
    }
    for (const [code] of codes) {
      entry(code).ranges.push({ name: p.NAME_EN || p.NAME, rank: p.SCALERANK ?? 9 });
    }
  }

  for (const code of Object.keys(result)) {
    const e = result[code];
    const seen = new Set();
    e.peaks = e.peaks
      .sort((a, b) => b.elevation - a.elevation)
      .filter((pk, _, all) => pk.elevation >= all[0].elevation * 0.1)
      .filter((pk) => !seen.has(pk.name) && seen.add(pk.name))
      .slice(0, 8);
    const seenR = new Set();
    e.ranges = e.ranges
      .sort((a, b) => a.rank - b.rank)
      .filter((r) => !seenR.has(r.name) && seenR.add(r.name))
      .slice(0, 8)
      .map((r) => r.name);
  }

  await fs.writeFile(path.join(root, 'src/data/mountains.json'), JSON.stringify(result));
  console.log(`  mountains: ${Object.keys(result).length} countries with peaks or ranges`);
}

/** Country (P17) of each Wikidata item, as ISO alpha-3 codes. Boundary geometry is the fallback. */
async function wikidataCountries(ids) {
  const qids = [...new Set(ids.filter((id) => /^Q\d+$/.test(id ?? '')))];
  const out = new Map();
  for (let i = 0; i < qids.length; i += 150) {
    const values = qids.slice(i, i + 150).map((q) => `wd:${q}`).join(' ');
    const query = `SELECT ?m ?iso WHERE { VALUES ?m { ${values} } ?m wdt:P17 ?c . ?c wdt:P298 ?iso . }`;
    try {
      const data = await getJson('https://query.wikidata.org/sparql', {
        method: 'POST',
        headers: {
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'world-atlas-explorer/1.0 (build script)',
        },
        body: new URLSearchParams({ query }),
      });
      for (const b of data.results.bindings) {
        const q = b.m.value.split('/').pop();
        const iso = b.iso.value === 'XKX' ? 'UNK' : b.iso.value;
        if (!out.has(q)) out.set(q, []);
        if (!out.get(q).includes(iso)) out.get(q).push(iso);
      }
    } catch (err) {
      console.warn(`  ! wikidata lookup failed, using geometry for this batch: ${err.message}`);
    }
  }
  return out;
}

function lonLatBox(feat) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const g = feat.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys)
    for (const [x, y] of poly[0]) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  return box;
}

function inBox(box, [x, y], pad) {
  return x >= box[0] - pad && x <= box[2] + pad && y >= box[1] - pad && y <= box[3] + pad;
}

/** Distance in radians from a point to a polygon boundary, using a local equirectangular plane. */
function nearestEdge(feat, [px, py]) {
  const kx = Math.cos((py * Math.PI) / 180);
  let best = Infinity;
  const visit = (ring) => {
    for (let i = 1; i < ring.length; i++) {
      const ax = (ring[i - 1][0] - px) * kx;
      const ay = ring[i - 1][1] - py;
      const bx = (ring[i][0] - px) * kx;
      const by = ring[i][1] - py;
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  };
  const g = feat.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  polys.forEach((poly) => poly.forEach(visit));
  return (best * Math.PI) / 180;
}

function samplePoints(geometry, max) {
  const coords = [];
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) for (const p of poly[0]) coords.push(p);
  const step = Math.max(1, Math.floor(coords.length / max));
  const pts = coords.filter((_, i) => i % step === 0);
  for (const poly of polys) pts.push(geoCentroid({ type: 'Polygon', coordinates: poly }));
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Factbook index
// ---------------------------------------------------------------------------------------------
async function buildFactbookIndex(countries) {
  const tree = await getJson(FACTBOOK_TREE, { headers: { 'User-Agent': 'world-atlas-explorer' } });
  const files = tree.tree
    .map((t) => t.path)
    .filter((p) => /^[a-z-]+\/[a-z]{2}\.json$/.test(p) && !p.startsWith('meta/'));

  const lookup = new Map();
  for (const c of countries) {
    const names = [
      c.name.common,
      c.name.official,
      ...(c.altSpellings ?? []),
      ...Object.values(c.name.nativeName ?? {}).flatMap((n) => [n.common, n.official]),
    ];
    for (const n of names) if (n && !lookup.has(norm(n))) lookup.set(norm(n), c.cca3);
  }

  const index = {};
  const unmatched = [];
  await mapLimit(files, 12, async (file) => {
    const data = await getJson(`${FACTBOOK_CDN}/${file}`);
    const cn = data?.Government?.['Country name'] ?? {};
    const short = decodeEntities(cn['conventional short form']?.text).trim();
    const long = decodeEntities(cn['conventional long form']?.text).trim();
    const label = (short && short !== 'none' ? short : long).replace(/\s*\(sometimes.*\)$/, '');
    if (!label || label === 'none') return;
    let code = FACTBOOK_FILE_OVERRIDES[file];
    if (code === undefined && label in FACTBOOK_OVERRIDES) code = FACTBOOK_OVERRIDES[label];
    if (code === undefined) code = lookup.get(norm(label)) ?? lookup.get(norm(long));
    if (code === null) return;
    if (!code) {
      unmatched.push(`${file} (${label})`);
      return;
    }
    if (!index[code]) index[code] = file.replace(/\.json$/, '');
  });

  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  await fs.mkdir(path.join(root, 'src/data'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/data/factbook-index.json'), JSON.stringify(sorted, null, 0));
  const missing = countries.filter((c) => !index[c.cca3]).map((c) => `${c.cca3} ${c.name.common}`);
  console.log(`  factbook: ${Object.keys(index).length} profiles mapped`);
  if (unmatched.length) console.log(`  factbook profiles not matched (non-country entities): ${unmatched.join('; ')}`);
  if (missing.length) console.log(`  countries without a factbook profile: ${missing.join('; ')}`);
}

// ---------------------------------------------------------------------------------------------
// National symbols
// ---------------------------------------------------------------------------------------------
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_HEADERS = { 'User-Agent': 'world-atlas-explorer/1.0 (build script; https://github.com/anuragsable11/myworld)' };

/** English Wikipedia lists the national symbols are read from, and how each one is laid out. */
const SYMBOL_LISTS = [
  ['animal', 'List of national animals', 'table'],
  ['bird', 'List of national birds', 'table'],
  ['flower', 'List of national flowers', 'headings'],
  ['tree', 'List of national trees', 'table'],
  ['dish', 'National dish', 'bullets'],
];

/** One Wikipedia API request at a time, backing off when the API asks us to slow down. */
let wikiQueue = Promise.resolve();
function wiki(params) {
  const request = async () => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(WIKI_API, {
        method: 'POST',
        headers: { ...WIKI_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ format: 'json', formatversion: '2', ...params }),
      });
      if (res.ok) return res.json();
      if (attempt >= 5 || (res.status !== 429 && res.status < 500)) throw new Error(`Wikipedia API ${res.status} ${res.statusText}`);
      const wait = Number(res.headers.get('retry-after')) || 5 * 2 ** attempt;
      console.log(`  (Wikipedia asked us to wait ${wait}s)`);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  };
  const result = wikiQueue.then(request);
  wikiQueue = result.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1000)));
  return result;
}

const stripRefs = (s) => s.replace(/<ref[^>/]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<!--[\s\S]*?-->/g, '');

/**
 * Wiki links in a piece of wikitext, leaving out files and categories. A scientific name written
 * after a common one, as in "the lotus (''[[Nelumbo nucifera]]'')", is shown by its common name.
 */
const wikiLinks = (text) =>
  [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g)]
    .map((m) => {
      const common = text.slice(Math.max(0, m.index - 60), m.index).match(/\b(?:the|a|an)\s+([a-z][a-z' -]{2,40}?)\s*\(\s*'*\s*$/i)?.[1];
      return { target: m[1].trim(), text: (common ?? m[2] ?? m[1]).replace(/'{2,}/g, '').trim() };
    })
    .filter((l) => l.text && !/^(file|image|category|wikt|wiktionary):/i.test(l.target));

/**
 * What an article's short description must (or must not) say for it to be taken as each kind of
 * symbol, so that a link to, say, the president who chose a flower isn't mistaken for the flower.
 */
const SYMBOL_CHECKS = {
  animal: { not: /dynasty|president|politician|monarch|king|queen|empire|city|country|language|people|ethnic|religio|deity|battle|novel|film|song|flag of/i },
  bird: { not: /dynasty|president|politician|monarch|empire|city|country|language|people|ethnic|religio|novel|film|song|flag of/i },
  flower: { is: /plant|flower|tree|species|genus|shrub|herb|cultivar|orchid|lily|rose|lotus|tulip|blossom|botan|famil(y|ies) of|vine|cactus|palm/i, not: /dynasty|president|politician|city|country|language|people|religio/i },
  tree: { is: /plant|tree|species|genus|shrub|palm|conifer|famil(y|ies) of|oak|pine|cedar|blossom/i, not: /dynasty|president|politician|city|country|language|people|religio/i },
  dish: { not: /city|country|region|people|ethnic|language|restaurant|chef|politician|president|province|island/i },
};

/** Country names as the lists write them ("Georgia (country)", "The Gambia") to ISO alpha-3. */
function countryResolver(countries) {
  // The dataset now names Turkey "Türkiye" only.
  const lookup = new Map([['turkey', 'TUR']]);
  for (const c of countries) {
    for (const n of [c.name.common, c.name.official, ...(c.altSpellings ?? [])]) if (n && !lookup.has(norm(n))) lookup.set(norm(n), c.cca3);
  }
  return (name) => {
    const plain = name
      .replace(/\[\[|\]\]|\{\{[^}]*\}\}/g, '')
      .replace(/\s*\((country|state|nation)\)$/i, '')
      .replace(/^cuisine of /i, '')
      .replace(/^(.*), (.*)$/, '$2 $1'); // "Korea, South"
    return lookup.get(norm(plain));
  };
}

/**
 * Rows of a wikitable whose first cell names a country, usually with a flag template such as
 * {{flag|India}} or {{IND}}. A rowspan carries the country on to the following rows.
 */
function parseSymbolTable(text, countryOfCell) {
  const out = [];
  let current;
  let left = 0;
  for (const chunk of text.split(/\n\|-[^\n]*/)) {
    const row = chunk.trim();
    if (!row.startsWith('|') || /^\|[}+]/.test(row)) continue;
    const body = row.slice(1);
    const first = body.split(/\|\||\n\|/)[0];
    const cca3 = countryOfCell(first);
    let rest;
    if (cca3) {
      current = cca3;
      left = Number(first.match(/rowspan\s*=\s*"?(\d+)/)?.[1] ?? 1);
      rest = body.slice(first.length);
    } else if (left > 0) rest = body;
    else continue;
    left--;
    const cells = stripRefs(rest);
    const links = wikiLinks(cells);
    if (!links.length) continue;
    const role = cells.slice(cells.indexOf(links[0].text)).match(/^[^|]*?\(''([^']+)''\)/)?.[1];
    out.push({ cca3: current, links: links.slice(0, 3), role });
  }
  return out;
}

/** "====India====" headings, each followed by prose about that country's symbol. */
function parseSymbolHeadings(text, resolve) {
  const out = [];
  const parts = text.split(/^(={2,6})\s*(.+?)\s*\1\s*$/m);
  for (let i = 1; i < parts.length; i += 3) {
    const cca3 = resolve(parts[i + 1]);
    if (!cca3) continue;
    const links = wikiLinks(stripRefs(parts[i + 2])).filter(
      (l) => !resolve(l.target) && !/language|people|flower|floral|emblem|^list of|symbol/i.test(l.target),
    );
    if (links.length) out.push({ cca3, links: links.slice(0, 6) });
  }
  return out;
}

/** "* [[Country]]: [[dish]], [[dish]]" bullet lines. */
function parseSymbolBullets(text, resolve) {
  const out = [];
  for (const line of stripRefs(text).split('\n')) {
    const m = line.match(/^\*+\s*(.+?):\s*(.*)$/);
    if (!m) continue;
    const place = wikiLinks(m[1])[0];
    const cca3 = place ? (resolve(place.target) ?? resolve(place.text)) : resolve(m[1]);
    const links = cca3 ? wikiLinks(m[2]).filter((l) => !resolve(l.target) && !/cuisine/i.test(l.target)) : [];
    if (links.length) out.push({ cca3, links: links.slice(0, 4) });
  }
  return out;
}

/** Wikipedia articles' short descriptions and free lead images: requested title -> article. */
async function articleInfo(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await wiki({
      action: 'query',
      prop: 'pageimages|description',
      piprop: 'thumbnail|name',
      pithumbsize: '500',
      redirects: '1',
      titles: batch.join('|'),
    });
    const q = data.query ?? {};
    const step = (list) => new Map((list ?? []).map((x) => [x.from, x.to]));
    const normalized = step(q.normalized);
    const redirects = step(q.redirects);
    const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));
    for (const t of batch) {
      const n = normalized.get(t) ?? t;
      const page = pages.get(redirects.get(n) ?? n);
      if (page && !page.missing) {
        out.set(t, {
          page: page.title,
          description: page.description ?? '',
          image: page.thumbnail?.source.replace(/\?.*$/, ''),
          file: page.pageimage,
        });
      }
    }
  }
  return out;
}

async function buildSymbols(countries) {
  const resolve = countryResolver(countries);
  const lists = await mapLimit(SYMBOL_LISTS, 3, async ([kind, page, layout]) => {
    const data = await wiki({ action: 'parse', page, prop: 'wikitext', redirects: '1' });
    return { kind, page, layout, text: data.parse.wikitext };
  });

  // The tables mark countries with flag templates; expanding them gives each country's article link.
  const templates = [
    ...new Set(
      lists
        .filter((l) => l.layout === 'table')
        .flatMap((l) => [...l.text.matchAll(/\n\|(?:[^|\n]*?\|(?!\|))?\s*(\{\{[^{}]+\}\})/g)].map((m) => m[1])),
    ),
  ];
  const SPLIT = '\n@@@\n';
  const expanded = (await wiki({ action: 'expandtemplates', prop: 'wikitext', text: templates.join(SPLIT) })).expandtemplates.wikitext.split(SPLIT);
  const templateCountry = new Map(templates.map((t, i) => [t, wikiLinks(expanded[i] ?? '').map((l) => resolve(l.target) ?? resolve(l.text)).find(Boolean)]));
  const countryOfCell = (cell) => {
    const tpl = cell.match(/\{\{[^{}]+\}\}/)?.[0];
    if (tpl) return templateCountry.get(tpl);
    const link = wikiLinks(cell)[0];
    return link && (resolve(link.target) ?? resolve(link.text));
  };

  const rowsByKind = lists.map(({ kind, page, layout, text }) => ({
    kind,
    page,
    rows: layout === 'table' ? parseSymbolTable(text, countryOfCell) : layout === 'headings' ? parseSymbolHeadings(text, resolve) : parseSymbolBullets(text, resolve),
  }));
  const info = await articleInfo([...new Set(rowsByKind.flatMap((k) => k.rows.flatMap((r) => r.links.map((l) => l.target))))]);

  const picks = {};
  for (const { kind, page, rows } of rowsByKind) {
    const check = SYMBOL_CHECKS[kind];
    // Countries can list several animals ("national bird", "national fish"…): prefer the national
    // animal itself, and leave birds to the list of national birds.
    const rank = (r) => (kind !== 'animal' || /national animal/i.test(r.role ?? '') ? 0 : !r.role || /mammal/i.test(r.role) ? 1 : 2);
    let count = 0;
    for (const r of rows.filter((r) => kind !== 'animal' || !/bird/i.test(r.role ?? '')).sort((a, b) => rank(a) - rank(b))) {
      if (picks[r.cca3]?.[kind]) continue;
      // A link whose description fits best, else the first that isn't plainly something else.
      const fits = (l, strict) => {
        const a = info.get(l.target);
        return a && !check.not.test(a.description) && (!strict || !check.is || check.is.test(a.description));
      };
      const link = r.links.find((l) => fits(l, true)) ?? r.links.find((l) => fits(l, false));
      if (!link) continue;
      const a = info.get(link.target);
      (picks[r.cca3] ??= {})[kind] = {
        name: link.text.charAt(0).toUpperCase() + link.text.slice(1),
        page: a.page,
        ...(a.image && { image: a.image, file: a.file }),
      };
      count++;
    }
    console.log(`  ${kind}: ${count} countries (${page})`);
  }

  const result = {};
  for (const [cca3, kinds] of Object.entries(picks).sort(([a], [b]) => a.localeCompare(b))) {
    // A symbol listed twice (the Gallic rooster as animal and bird) shows once.
    if (kinds.animal && kinds.bird && kinds.animal.page === kinds.bird.page) delete kinds.bird;
    if (kinds.flower && kinds.tree && kinds.flower.page === kinds.tree.page) delete kinds.tree;
    result[cca3] = Object.fromEntries(SYMBOL_LISTS.filter(([kind]) => kinds[kind]).map(([kind]) => [kind, kinds[kind]]));
  }
  await fs.writeFile(path.join(root, 'src/data/symbols.json'), JSON.stringify(result));
  const all = Object.values(result).flatMap((k) => Object.values(k));
  console.log(`  symbols: ${all.length} for ${Object.keys(result).length} countries, ${all.filter((s) => s.image).length} with a picture`);
}

// ---------------------------------------------------------------------------------------------
// Pass step names to run only some of them, e.g. `npm run data -- symbols`.
const steps = process.argv.slice(2);
const run = (step) => !steps.length || steps.includes(step);

console.log('Fetching country dataset…');
const countries = await getJson(COUNTRIES_URL);
if (run('boundaries') || run('mountains')) {
  console.log('Building boundaries…');
  const features = await buildBoundaries(countries);
  if (run('mountains')) {
    console.log('Building mountains…');
    await buildMountains(features);
  }
}
if (run('factbook')) {
  console.log('Building factbook index…');
  await buildFactbookIndex(countries);
}
if (run('symbols')) {
  console.log('Building national symbols…');
  await buildSymbols(countries);
}
console.log('Done.');
