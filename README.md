# World Atlas — Countries Explorer

An interactive world atlas built with React, TypeScript and Tailwind CSS. Click any country on the map, the 3D globe, or in
the searchable list to open a full profile covering its geography, people, government and economy. Each profile is built
at runtime from public data sources. No country's facts are hand-written.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

Requires Node 20+.

### REST Countries API key (optional)

REST Countries v5 requires an API key, and browser requests only work from hostnames that are allowed for that key.

1. Sign up at <https://restcountries.com/sign-up> (the free plan includes 1,000 requests/month).
2. On the API Keys page, add `localhost` and your production hostname as allowed hostnames.
3. Copy `.env.example` to `.env` and set `VITE_RESTCOUNTRIES_API_KEY`.

The app loads all countries in three paged requests and caches them in the browser for up to three days, the maximum the
REST Countries terms allow. Without a key, or if the API returns an error, it falls back to the open
[mledoze/countries](https://github.com/mledoze/countries) dataset that REST Countries was originally built on, with
populations from the World Bank. The header and the About dialog show which source is active.

## Data sources

| Information | Source | When it loads |
| --- | --- | --- |
| Names, codes, capitals, languages, currencies, calling codes, domains, time zones, borders, area | REST Countries v5 / mledoze/countries | Once per visit (cached) |
| Flags | REST Countries flag CDN | On display |
| Government type, independence, holiday, land boundaries, coastline, climate, terrain, elevation, rivers, lakes, natural resources, religions, ethnic groups, cities, industries, exports | CIA World Factbook via [factbook/factbook.json](https://github.com/factbook/factbook.json) | Per country, on selection |
| Current head of state / government, national anthem and recording | Wikidata SPARQL | Per country, on selection |
| Overview text | Wikipedia REST API | Per country, on selection |
| GDP, GDP per capita, PPP, growth, population | World Bank API | Per country, on selection |
| Boundaries (1:50m), notable peaks and mountain ranges | Natural Earth | Static files in `src/data` |
| Live local time | IANA time zone database (`countries-and-timezones`) | Bundled |

When a source has nothing for a country (for example, the Factbook lists major rivers for only about 80 countries), the
field shows "Not available" instead of guessing.

## Project structure

```
scripts/build-data.mjs        Regenerates the static geographic data (npm run data)
src/data/world.topo.json      Natural Earth 1:50m boundaries keyed by ISO alpha-3
src/data/mountains.json       Peaks and ranges per country
src/data/factbook-index.json  ISO alpha-3 → Factbook profile path
src/lib/sources/              One module per data source, each normalising into typed models
src/lib/geo.ts                Boundary loading, low-detail globe geometry, per-country zoom framing
src/hooks/                    React Query hooks, URL-hash selection, responsive layout, online/install state
src/lib/pwa.ts                Service worker registration and the install prompt
src/sw.js                     Service worker (offline support)
src/components/map/           SVG map (d3-geo + d3-zoom), canvas globe, tooltip, controls
src/components/sidebar/       Search, filters, alphabetical list
src/components/panel/         Country profile and its sections
```

## How it works

- **Map**: an Equal Earth projection rendered as SVG. Paths are computed once; zoom and pan only change a transform.
  Labels appear as zooming makes room for them. Microstates and countries without a 1:50m polygon get point markers so
  every country stays clickable.
- **Globe** (the default view): a cartoon orthographic globe on canvas that bounces in on load. A simplified mesh is
  drawn while it moves and full 1:50m detail once it stops; outlined clouds and an orbiting plane live on a separate
  canvas so they animate without redrawing the land. Countries use political-map colouring, so neighbours never share a
  colour. Selecting a country drops a flag pin on it; the dice button flies to a random country with a couple of spins.
- **Live day and night**: the night side is shaded from the real subsolar point (a low-precision solar ephemeris in
  `src/lib/sun.ts`), with civil, nautical and astronomical twilight bands, a sun where it is noon and a moon where it is
  midnight. It refreshes every minute and works on both the globe and the map; toggle it with the moon button or `N`.
- **Traditional dress**: the People section shows a cartoon man and woman in traditional dress: original characters in
  a flat, chunky style (big eyes, open smiles, no outlines, one flat shade per shape) drawn in SVG from outfit building
  blocks in `src/components/panel/dress/`. They blink, wave and jump when tapped. About 100 countries name specific,
  widely documented garments in `src/data/costumes.ts`; every other country gets the style of its subregion, labelled
  as illustrative. They are simplified cartoons: real dress varies by region and community.
- **Selection** is stored in the URL hash (`#/FRA`), so profiles can be linked and the back button works.
- **Layout**: a cartoon theme (ink outlines, sticker cards, Fredoka and Nunito) with the map filling the screen and the
  list and profile on floating cards (desktop); a list drawer and floating panel on tablets; a draggable bottom sheet on
  phones. Animations respect `prefers-reduced-motion`.
- **Keyboard**: `/` or `Ctrl/⌘ K` opens search (arrow keys and Enter to pick), `G` switches between map and globe, `N` toggles day and night, `Esc`
  closes the profile.

## Install and offline use

The production build is an installable app (PWA). Chrome, Edge and Android browsers show an **Install app** button. On an
iPhone or iPad, use Share → Add to Home Screen; Safari on a Mac uses File → Add to Dock. The app explains these steps
when you tap the button.

- `public/manifest.webmanifest` holds the name, colours, icons and the screenshots shown in the install dialog. The icons
  in `public/icons/` are rendered from `scripts/icons/icon.svg` and `scripts/icons/icon-maskable.svg`.
- `src/sw.js` is the service worker. At build time, a small plugin in `vite.config.ts` fills in the list of files to
  precache, with a content hash for each file. The worker precaches the app itself (code, fonts, map data and icons), so
  it opens without a connection. It also caches the country list and the Factbook, Wikipedia, Wikidata and World Bank
  data for each country you open, so those countries keep working offline. A sticker on the map shows when you're
  offline.
- REST Countries API responses are never stored by the service worker. The app keeps them in localStorage for at most
  three days. Large flag images from its CDN follow the same three-day limit; offline, the flag emoji is shown instead.
- The service worker only runs in production builds (`npm run build && npm run preview`). Installing on a phone needs
  the site to be served over HTTPS, for example on Vercel or Netlify.

## Regenerating the geographic data

```bash
npm run data
```

This rebuilds the boundary file from `world-atlas`, draws India as on its official map, splits overseas regions
(French Guiana, Réunion, Svalbard and others) into their own shapes, assigns Natural Earth peaks and ranges to countries
(using Wikidata for summits on a border), and rebuilds the Factbook index.

Boundaries follow Natural Earth's de facto conventions, except India, which is drawn as on the Government of India's
official map: all of Jammu and Kashmir and Ladakh, including Gilgit-Baltistan, Aksai Chin, the Shaksgam valley and the
Siachen glacier. Natural Earth's disputed-area polygons record which areas India's official view includes, and the
build script moves those areas into India from the countries that administer them.
