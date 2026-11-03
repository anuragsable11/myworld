import type { Feature, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import { geoArea, geoBounds, geoCentroid, geoDistance } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { presimplify, quantile, simplify, sphericalTriangleArea } from 'topojson-simplify';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { assetUrl, fetchJson } from './http';

/** One drawable boundary geometry. Several shapes can share a country id (e.g. Cyprus). */
export interface Shape {
  key: string;
  /** ISO alpha-3 code, or null for areas that are drawn but not selectable (Siachen Glacier). */
  id: string | null;
  name: string;
  feature: Feature<Polygon | MultiPolygon>;
  bounds: [[number, number], [number, number]];
}

export interface Focus {
  /** Polygons to frame on the globe: the main landmass plus nearby islands. */
  globe: Feature<MultiPolygon>;
  /** Same, minus parts on the far side of the antimeridian (they would stretch a flat map). */
  flat: Feature<MultiPolygon>;
  centroid: [number, number];
  /** Angular radius of the framed area, in radians. */
  radius: number;
}

/** Simplified geometry for animating the globe; full detail is drawn once it comes to rest. */
export interface LowDetail {
  shapes: Pick<Shape, 'id' | 'feature'>[];
  borders: MultiLineString;
  coastline: MultiLineString;
}

export interface World {
  shapes: Shape[];
  borders: MultiLineString;
  coastline: MultiLineString;
  lowDetail: LowDetail;
  ids: Set<string>;
  focus: Map<string, Focus>;
}

// Keep this share of arc vertices in the low-detail geometry (by spherical-area importance).
const LOW_DETAIL_SHARE = 0.14;

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

export async function loadWorld(signal?: AbortSignal): Promise<World> {
  const topo = await fetchJson<CountriesTopology>(assetUrl('data/world.topo.json'), { signal, timeoutMs: 30_000 });
  const object = topo.objects.countries;
  const collection = feature(topo, object);

  const shapes: Shape[] = collection.features.map((f, i) => ({
    key: `${f.id ?? 'x'}-${i}`,
    id: typeof f.id === 'string' ? f.id : null,
    name: f.properties?.name ?? 'Unknown',
    feature: f as Feature<Polygon | MultiPolygon>,
    bounds: geoBounds(f),
  }));

  const polygonsById = new Map<string, Position[][][]>();
  for (const s of shapes) {
    if (!s.id) continue;
    const g = s.feature.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    polygonsById.set(s.id, [...(polygonsById.get(s.id) ?? []), ...polys]);
  }
  const focus = new Map<string, Focus>();
  for (const [id, polys] of polygonsById) focus.set(id, buildFocus(polys));

  return {
    shapes,
    borders: mesh(topo, object, (a, b) => a !== b),
    coastline: mesh(topo, object, (a, b) => a === b),
    lowDetail: buildLowDetail(topo),
    ids: new Set(polygonsById.keys()),
    focus,
  };
}

function buildLowDetail(topo: CountriesTopology): LowDetail {
  const weighted = presimplify(structuredClone(topo), sphericalTriangleArea);
  // quantile() ranks weights in descending order, so p is the share of vertices kept.
  const simple = simplify(weighted, quantile(weighted, LOW_DETAIL_SHARE)) as CountriesTopology;
  const object = simple.objects.countries;
  return {
    shapes: feature(simple, object).features.map((f) => ({
      id: typeof f.id === 'string' ? f.id : null,
      feature: f as Feature<Polygon | MultiPolygon>,
    })),
    borders: mesh(simple, object, (a, b) => a !== b),
    coastline: mesh(simple, object, (a, b) => a === b),
  };
}

const multi = (coordinates: Position[][][]): Feature<MultiPolygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'MultiPolygon', coordinates },
});

function buildFocus(polys: Position[][][]): Focus {
  const items = polys.map((p) => {
    const f = multi([p]);
    return { p, area: geoArea(f), centroid: geoCentroid(f) as [number, number] };
  });
  const main = items.reduce((a, b) => (b.area > a.area ? b : a));
  const mainRadius = main.p[0].reduce((r, v) => Math.max(r, geoDistance(main.centroid, v as [number, number])), 0);
  const limit = Math.max(0.35, mainRadius * 3);
  const kept = items.filter((i) => i === main || geoDistance(i.centroid, main.centroid) <= limit);
  const flat = kept.filter((i) => Math.abs(i.centroid[0] - main.centroid[0]) <= 150);

  const globe = multi(kept.map((i) => i.p));
  const centroid = geoCentroid(globe) as [number, number];
  let radius = 0;
  for (const i of kept) for (const v of i.p[0]) radius = Math.max(radius, geoDistance(centroid, v as [number, number]));

  return { globe, flat: multi(flat.map((i) => i.p)), centroid, radius };
}

/** geoBounds-based quick rejection before an exact geoContains test (handles antimeridian boxes). */
export function boundsContain([[w, s], [e, n]]: Shape['bounds'], [lon, lat]: [number, number]): boolean {
  if (lat < s || lat > n) return false;
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
}
