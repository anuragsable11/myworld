import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import clsx from 'clsx';
import type { Feature, MultiPolygon } from 'geojson';
import { geoArea, geoEqualEarth, geoGraticule10, geoPath, type GeoSphere } from 'd3-geo';
import { easeCubicInOut } from 'd3-ease';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import polylabel from 'polylabel';
import type { Focus } from '../../lib/geo';
import type { MapHandle, MapViewProps } from './types';

// A fixed projection in a 1000-unit viewBox: paths are computed once and the SVG scales to fit.
const VIEW_W = 1000;
const SPHERE: GeoSphere = { type: 'Sphere' };
const projection = geoEqualEarth().fitWidth(VIEW_W, SPHERE);
const path = geoPath(projection);
const VIEW_H = Math.ceil(path.bounds(SPHERE)[1][1]);
const MAX_ZOOM = 64;
const LABEL_PX = 11;
const MARKER_PX = 3.6;

interface Label {
  id: string;
  x: number;
  y: number;
  /** Projected size of the main landmass, in viewBox units. */
  w: number;
  h: number;
}

function labelFor(id: string, focus: Focus): Label | null {
  const polys = focus.flat.geometry.coordinates;
  if (!polys.length) return null;
  const main = polys.reduce((a, b) => (geoArea(polygon(b)) > geoArea(polygon(a)) ? b : a));
  const [[x0, y0], [x1, y1]] = path.bounds(polygon(main));
  if (x1 - x0 > VIEW_W * 0.6) {
    const [cx, cy] = path.centroid(polygon(main));
    return { id, x: cx, y: cy, w: x1 - x0, h: y1 - y0 };
  }
  const rings = main.map((ring) => ring.map((p) => projection(p as [number, number]) ?? [0, 0]));
  const [x, y] = polylabel(rings, 0.5);
  return { id, x, y, w: x1 - x0, h: y1 - y0 };
}

const polygon = (coordinates: MultiPolygon['coordinates'][number]): Feature<MultiPolygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'MultiPolygon', coordinates: [coordinates] },
});

export const FlatMap = forwardRef<MapHandle, MapViewProps>(function FlatMap(props, ref) {
  const { world, markers, names, selectedId, neighborIds, activeIds, onSelect, onHover } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const markersRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const pxPerUnitRef = useRef(1);
  const propsRef = useRef(props);
  propsRef.current = props;

  const layers = useMemo(() => {
    const labels: Label[] = [];
    for (const [id, focus] of world.focus) {
      const label = labelFor(id, focus);
      if (label) labels.push(label);
    }
    return {
      shapes: world.shapes.map((s) => ({ key: s.key, id: s.id, name: s.name, d: path(s.feature) ?? '' })),
      borders: path(world.borders) ?? '',
      coast: path(world.coastline) ?? '',
      graticule: path(geoGraticule10()) ?? '',
      sphere: path(SPHERE) ?? '',
      labels,
    };
  }, [world]);

  const markerPoints = useMemo(
    () =>
      markers
        .map((m) => ({ ...m, p: projection([m.lon, m.lat]) }))
        .filter((m): m is typeof m & { p: [number, number] } => !!m.p),
    [markers],
  );

  /** Keeps labels, markers and outlines a constant on-screen size, and culls labels that don't fit. */
  const applyZoomStyles = useCallback(() => {
    const z = transformRef.current.k * pxPerUnitRef.current;
    const labelsEl = labelsRef.current;
    if (labelsEl) {
      labelsEl.setAttribute('font-size', String(LABEL_PX / z));
      labelsEl.setAttribute('stroke-width', String(2.6 / z));
      for (const el of labelsEl.children as HTMLCollectionOf<SVGTextElement>) {
        const w = Number(el.dataset.w) * z;
        const h = Number(el.dataset.h) * z;
        const needed = (el.textContent?.length ?? 0) * LABEL_PX * 0.58 + 8;
        const show = el.classList.contains('is-selected') || (w >= needed && h >= 15);
        if ((el.style.display !== 'none') !== show) el.style.display = show ? '' : 'none';
      }
    }
    const r = String(MARKER_PX / z);
    for (const el of (markersRef.current?.children ?? []) as HTMLCollectionOf<SVGCircleElement>) {
      el.setAttribute('r', r);
    }
  }, []);

  /** Whole world on wide screens; on tall, narrow screens zoom in so the land fills more height. */
  const initialTransform = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return zoomIdentity;
    const { width, height } = svg.getBoundingClientRect();
    const s = pxPerUnitRef.current;
    const k = Math.min(width < 640 ? 1.9 : 1.12, Math.max(1, (height / s / VIEW_H) * 0.6));
    const centerY = k > 1 ? VIEW_H * 0.45 : VIEW_H / 2;
    return zoomIdentity.translate(VIEW_W / 2, VIEW_H / 2).scale(k).translate(-VIEW_W / 2, -centerY);
  }, []);

  // Zoom behaviour
  useEffect(() => {
    const svg = svgRef.current!;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [-VIEW_W * 0.15, -VIEW_H * 0.3],
        [VIEW_W * 1.15, VIEW_H * 1.3],
      ])
      .clickDistance(6)
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform;
        zoomLayerRef.current?.setAttribute('transform', event.transform.toString());
        applyZoomStyles();
      });
    zoomRef.current = behavior;
    const selection = select(svg).call(behavior).on('dblclick.zoom', null);

    const measure = () => {
      const { width, height } = svg.getBoundingClientRect();
      pxPerUnitRef.current = Math.min(width / VIEW_W, height / VIEW_H) || 1;
      applyZoomStyles();
    };
    measure();
    selection.call(behavior.transform, initialTransform());
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => {
      observer.disconnect();
      selection.on('.zoom', null);
    };
  }, [applyZoomStyles, initialTransform]);

  useEffect(applyZoomStyles, [applyZoomStyles, layers, markerPoints, selectedId]);

  const animateTo = useCallback((t: ZoomTransform) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior) return;
    select(svg)
      .transition()
      .duration(propsRef.current.reducedMotion ? 0 : 950)
      .ease(easeCubicInOut)
      .call(behavior.transform, t);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomRef.current && select(svgRef.current!).transition().duration(300).call(zoomRef.current.scaleBy, 1.6),
      zoomOut: () => zoomRef.current && select(svgRef.current!).transition().duration(300).call(zoomRef.current.scaleBy, 1 / 1.6),
      reset: () => animateTo(initialTransform()),
      focus: (id: string) => {
        const svg = svgRef.current;
        if (!svg) return;
        const { insets } = propsRef.current;
        const focus = world.focus.get(id);
        let bounds: [[number, number], [number, number]];
        if (focus) bounds = path.bounds(focus.flat);
        else {
          const marker = markerPoints.find((m) => m.id === id);
          if (!marker) return;
          // Frame the surrounding region so a lone marker has some geographic context.
          const [x, y] = marker.p;
          bounds = [
            [x - 12, y - 12],
            [x + 12, y + 12],
          ];
        }
        const s = pxPerUnitRef.current;
        const { width, height } = svg.getBoundingClientRect();
        const availW = (width - insets.right) / s;
        const availH = (height - insets.bottom) / s;
        const [[x0, y0], [x1, y1]] = bounds;
        const k = Math.min(
          MAX_ZOOM,
          Math.max(1, 0.78 * Math.min(availW / Math.max(x1 - x0, 1.5), availH / Math.max(y1 - y0, 1.5))),
        );
        const tx = VIEW_W / 2 - insets.right / s / 2 - k * ((x0 + x1) / 2);
        const ty = VIEW_H / 2 - insets.bottom / s / 2 - k * ((y0 + y1) / 2);
        animateTo(zoomIdentity.translate(tx, ty).scale(k));
      },
    }),
    [animateTo, initialTransform, markerPoints, world],
  );

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest<SVGElement>('[data-name]');
    if (!el) return onHover(null);
    const rect = e.currentTarget.getBoundingClientRect();
    onHover({
      id: el.dataset.id ?? null,
      name: el.dataset.name!,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const id = (e.target as Element).closest<SVGElement>('[data-id]')?.dataset.id;
    if (id) onSelect(id);
  };

  // Only selection/filter changes re-render the country layer; hover is handled by CSS.
  const countryLayer = useMemo(
    () => (
      <g>
        {layers.shapes.map((s) => (
          <path
            key={s.key}
            d={s.d}
            data-id={s.id ?? undefined}
            data-name={s.id ? (names.get(s.id) ?? s.name) : `${s.name} (disputed)`}
            className={clsx(
              'map-land',
              !s.id && 'is-inert',
              s.id && s.id === selectedId && 'is-selected',
              s.id && s.id !== selectedId && neighborIds.has(s.id) && 'is-neighbor',
              s.id && activeIds && !activeIds.has(s.id) && s.id !== selectedId && 'is-dim',
            )}
          />
        ))}
      </g>
    ),
    [layers, names, selectedId, neighborIds, activeIds],
  );

  const selectedOutline = useMemo(() => {
    if (!selectedId) return null;
    const d = layers.shapes
      .filter((s) => s.id === selectedId)
      .map((s) => s.d)
      .join('');
    if (!d) return null;
    return (
      <g pointerEvents="none">
        <path d={d} fill="none" stroke="rgba(217,178,111,0.28)" strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={d} className="map-selected-outline" vectorEffect="non-scaling-stroke" />
      </g>
    );
  }, [layers, selectedId]);

  return (
    <svg
      ref={svgRef}
      className="map-svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Interactive world map. Select a country to see its details."
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHover(null)}
      onClick={handleClick}
    >
      <defs>
        <radialGradient id="ocean-glow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#0f1726" />
          <stop offset="100%" stopColor="#080c14" />
        </radialGradient>
      </defs>
      <g ref={zoomLayerRef}>
        <path d={layers.sphere} fill="url(#ocean-glow)" stroke="rgba(217,178,111,0.16)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={layers.graticule} className="map-graticule" vectorEffect="non-scaling-stroke" />
        {countryLayer}
        <path d={layers.coast} className="map-coast" vectorEffect="non-scaling-stroke" />
        <path d={layers.borders} className="map-borders" vectorEffect="non-scaling-stroke" />
        {selectedOutline}
        <g ref={markersRef}>
          {markerPoints.map((m) => (
            <circle
              key={m.id}
              cx={m.p[0]}
              cy={m.p[1]}
              r={MARKER_PX}
              data-id={m.id}
              data-name={names.get(m.id) ?? m.id}
              vectorEffect="non-scaling-stroke"
              className={clsx(
                'map-marker',
                m.id === selectedId && 'is-selected',
                activeIds && !activeIds.has(m.id) && m.id !== selectedId && 'is-dim',
              )}
            />
          ))}
        </g>
        <g ref={labelsRef} className="map-labels">
          {layers.labels.map((l) => (
            <text
              key={l.id}
              x={l.x}
              y={l.y}
              data-w={l.w}
              data-h={l.h}
              className={clsx('map-label', l.id === selectedId && 'is-selected')}
            >
              {names.get(l.id) ?? ''}
            </text>
          ))}
        </g>
      </g>
    </svg>
  );
});
