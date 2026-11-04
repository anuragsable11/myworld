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
| Boundaries (1:50m), notable peaks and mountain ranges | Natural Earth | Static files in `public/data` |
| Live local time | IANA time zone database (`countries-and-timezones`) | Bundled |

When a source has nothing for a country (for example, the Factbook lists major rivers for only about 80 countries), the
field shows "Not available" instead of guessing.

## Project structure

```
scripts/build-data.mjs        Regenerates the static geographic data (npm run data)
public/data/world.topo.json   Natural Earth 1:50m boundaries keyed by ISO alpha-3
public/data/mountains.json    Peaks and ranges per country
src/data/factbook-index.json  ISO alpha-3 → Factbook profile path
src/lib/sources/              One module per data source, each normalising into typed models
src/lib/geo.ts                Boundary loading, low-detail globe geometry, per-country zoom framing
src/hooks/                    React Query hooks, URL-hash selection, responsive layout
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
- **Selection** is stored in the URL hash (`#/FRA`), so profiles can be linked and the back button works.
- **Layout**: a cartoon theme (ink outlines, sticker cards, Fredoka and Nunito) with the map filling the screen and the
  list and profile on floating cards (desktop); a list drawer and floating panel on tablets; a draggable bottom sheet on
  phones. Animations respect `prefers-reduced-motion`.
- **Keyboard**: `/` or `Ctrl/⌘ K` opens search (arrow keys and Enter to pick), `G` switches between map and globe, `Esc`
  closes the profile.

## Regenerating the geographic data

```bash
npm run data
```

This rebuilds the boundary file from `world-atlas`, splits overseas regions (French Guiana, Réunion, Svalbard and
others) into their own shapes, assigns Natural Earth peaks and ranges to countries (using Wikidata for summits on a
border), and rebuilds the Factbook index.

Boundaries follow Natural Earth's de facto conventions and do not imply endorsement of any territorial claim.
