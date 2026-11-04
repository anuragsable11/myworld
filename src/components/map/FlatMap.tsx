import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import clsx from 'clsx';
import type { Feature, MultiPolygon } from 'geojson';
import { geoArea, geoEqualEarth, geoGraticule10, geoPath, type GeoSphere } from 'd3-geo';
import { easeCubicInOut } from 'd3-ease';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import polylabel from 'polylabel';
import { colorSlotFor, type Focus } from '../../lib/geo';
import { antipode, nightBands, NIGHT_COLOR, subsolarPoint } from '../../lib/sun';
import { useMinute } from '../../hooks/useMinute';
import type { MapHandle, MapViewProps } from './types';

// A fixed projection in a 1000-unit viewBox: paths are computed once and the SVG scales to fit.
const VIEW_W = 1000;
const SPHERE: GeoSphere = { type: 'Sphere' };
const projection = geoEqualEarth().fitWidth(VIEW_W, SPHERE);
const path = geoPath(projection);
const VIEW_H = Math.ceil(path.bounds(SPHERE)[1][1]);
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 64;
const LABEL_PX = 11;
const MARKER_PX = 4.2;

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

/** Cartoon sun (where it is noon) and crescent moon (where it is midnight), drawn around the origin. */
function SunIcon() {
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={i}
          x1={Math.cos((i * Math.PI) / 4) * 11}
          y1={Math.sin((i * Math.PI) / 4) * 11}
          x2={Math.cos((i * Math.PI) / 4) * 15}
          y2={Math.sin((i * Math.PI) / 4) * 15}
          stroke="#1e1b4b"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={i}
          x1={Math.cos((i * Math.PI) / 4) * 11}
          y1={Math.sin((i * Math.PI) / 4) * 11}
          x2={Math.cos((i * Math.PI) / 4) * 15}
          y2={Math.sin((i * Math.PI) / 4) * 15}
          stroke="#ffd23f"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ))}
      <circle r={8} fill="#ffd23f" stroke="#1e1b4b" strokeWidth={2} />
    </g>
  );
}

function MoonIcon() {
  return (
    <path
      d="M4.2 7.96 A9 9 0 1 1 4.2 -7.96 A8 8 0 0 0 4.2 7.96 Z"
      transform="rotate(-28.6)"
      fill="#fff3b0"
      stroke="#1e1b4b"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

const polygon = (coordinates: MultiPolygon['coordinates'][number]): Feature<MultiPolygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'MultiPolygon', coordinates: [coordinates] },
});

export const FlatMap = forwardRef<MapHandle, MapViewProps>(function FlatMap(props, ref) {
  const { world, markers, names, selectedId, neighborIds, activeIds, showNight, onSelect, onHover } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const markersRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const celestialRef = useRef<SVGGElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const pxPerUnitRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });
  const anchorRef = useRef<[number, number] | null>(null);
  const initializedRef = useRef(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  const layers = useMemo(() => {
    const labels: Label[] = [];
    for (const [id, focus] of world.focus) {
      const label = labelFor(id, focus);
      if (label) labels.push(label);
    }
    return {
      shapes: world.shapes.map((s) => ({
        key: s.key,
        id: s.id,
        name: s.name,
        slot: s.id ? colorSlotFor(world, s.id) : 0,
        d: path(s.feature) ?? '',
      })),
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
        .map((m) => ({ ...m, slot: colorSlotFor(world, m.id), p: projection([m.lon, m.lat]) }))
        .filter((m): m is typeof m & { p: [number, number] } => !!m.p),
    [markers, world],
  );

  // Live day/night: twilight bands around the midnight point, refreshed every minute.
  const minute = useMinute(showNight);
  const night = useMemo(() => {
    if (!showNight) return null;
    const date = new Date(minute * 60_000);
    const sun = subsolarPoint(date);
    return {
      bands: nightBands(date).map((b) => ({ d: path(b.feature) ?? '', alpha: b.alpha })),
      sun: projection(sun),
      moon: projection(antipode(sun)),
    };
  }, [showNight, minute]);

  /** Where the selection pin stands: the label point of the main landmass, or the marker. */
  const anchorPoint = useMemo(() => {
    if (!selectedId) return null;
    const label = layers.labels.find((l) => l.id === selectedId);
    if (label) return [label.x, label.y] as [number, number];
    return markerPoints.find((m) => m.id === selectedId)?.p ?? null;
  }, [layers, markerPoints, selectedId]);
  anchorRef.current = anchorPoint;

  /** Keeps labels and markers a constant on-screen size, culls labels that don't fit, and moves the pin. */
  const applyZoomStyles = useCallback(() => {
    const z = transformRef.current.k * pxPerUnitRef.current;
    const labelsEl = labelsRef.current;
    if (labelsEl) {
      labelsEl.setAttribute('font-size', String(LABEL_PX / z));
      labelsEl.setAttribute('stroke-width', String(3 / z));
      for (const el of labelsEl.children as HTMLCollectionOf<SVGTextElement>) {
        const w = Number(el.dataset.w) * z;
        const h = Number(el.dataset.h) * z;
        const needed = (el.textContent?.length ?? 0) * LABEL_PX * 0.6 + 8;
        const show = el.classList.contains('is-selected') || (w >= needed && h >= 15);
        if ((el.style.display !== 'none') !== show) el.style.display = show ? '' : 'none';
      }
    }
    const r = String(MARKER_PX / z);
    for (const el of (markersRef.current?.children ?? []) as HTMLCollectionOf<SVGCircleElement>) {
      el.setAttribute('r', r);
    }
    for (const el of (celestialRef.current?.children ?? []) as HTMLCollectionOf<SVGGElement>) {
      el.setAttribute('transform', `translate(${el.dataset.x} ${el.dataset.y}) scale(${1 / z})`);
    }
    const pin = propsRef.current.pinRef.current;
    const anchor = anchorRef.current;
    if (pin && !anchor) pin.hide();
    else if (pin && anchor) {
      const t = transformRef.current;
      const s = pxPerUnitRef.current;
      const { w, h } = sizeRef.current;
      pin.move((w - VIEW_W * s) / 2 + s * (t.x + t.k * anchor[0]), (h - VIEW_H * s) / 2 + s * (t.y + t.k * anchor[1]));
    }
  }, []);

  /** Zoom transform placing world point `p` (viewBox units) at screen point `c` (CSS px). */
  const transformFor = useCallback((k: number, p: [number, number], c: [number, number]) => {
    const svg = svgRef.current!;
    const { width, height } = svg.getBoundingClientRect();
    const s = pxPerUnitRef.current;
    const ux = (c[0] - (width - VIEW_W * s) / 2) / s;
    const uy = (c[1] - (height - VIEW_H * s) / 2) / s;
    return zoomIdentity.translate(ux - k * p[0], uy - k * p[1]).scale(k);
  }, []);

  /** The part of the screen not covered by floating cards, in CSS px. */
  const availableArea = useCallback(() => {
    const { width, height } = svgRef.current!.getBoundingClientRect();
    const { top, right, bottom, left } = propsRef.current.insets;
    const w = Math.max(80, width - left - right);
    const h = Math.max(80, height - top - bottom);
    return { w, h, center: [left + w / 2, top + h / 2] as [number, number] };
  }, []);

  /** Fits the whole world between the cards; on tall, narrow screens zooms in to fill more height. */
  const initialTransform = useCallback(() => {
    if (!svgRef.current) return zoomIdentity;
    const { w, h, center } = availableArea();
    const s = pxPerUnitRef.current;
    let k = 0.94 * Math.min(w / (VIEW_W * s), h / (VIEW_H * s));
    if (h > w * 1.1) k = Math.max(k, Math.min(1.9, (h / (VIEW_H * s)) * 0.6));
    return transformFor(k, [VIEW_W / 2, VIEW_H * (k > 1.2 ? 0.45 : 0.5)], center);
  }, [availableArea, transformFor]);

  // Zoom behaviour
  useEffect(() => {
    const svg = svgRef.current!;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .translateExtent([
        [-VIEW_W * 1.5, -VIEW_H * 1.5],
        [VIEW_W * 2.5, VIEW_H * 2.5],
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
      sizeRef.current = { w: width, h: height };
      pxPerUnitRef.current = Math.min(width / VIEW_W, height / VIEW_H) || 1;
      applyZoomStyles();
    };
    measure();
    // Only once: re-running this effect (React StrictMode) must not cancel a focus() already under way.
    if (!initializedRef.current) {
      initializedRef.current = true;
      selection.call(behavior.transform, initialTransform());
    }
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => {
      observer.disconnect();
      selection.on('.zoom', null);
    };
  }, [applyZoomStyles, initialTransform]);

  useEffect(applyZoomStyles, [applyZoomStyles, layers, markerPoints, selectedId, anchorPoint, night]);

  const animateTo = useCallback((t: ZoomTransform) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior) return;
    select(svg)
      .transition()
      .duration(propsRef.current.reducedMotion ? 0 : 1000)
      .ease(easeCubicInOut)
      .call(behavior.transform, t);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomRef.current && select(svgRef.current!).transition().duration(320).call(zoomRef.current.scaleBy, 1.6),
      zoomOut: () => zoomRef.current && select(svgRef.current!).transition().duration(320).call(zoomRef.current.scaleBy, 1 / 1.6),
      reset: () => animateTo(initialTransform()),
      focus: (id: string) => {
        if (!svgRef.current) return;
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
        const { w, h, center } = availableArea();
        const s = pxPerUnitRef.current;
        const [[x0, y0], [x1, y1]] = bounds;
        const k = Math.min(
          MAX_ZOOM,
          Math.max(0.5, 0.75 * Math.min(w / s / Math.max(x1 - x0, 1.5), h / s / Math.max(y1 - y0, 1.5))),
        );
        animateTo(transformFor(k, [(x0 + x1) / 2, (y0 + y1) / 2], center));
      },
    }),
    [animateTo, availableArea, initialTransform, markerPoints, transformFor, world],
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
              s.id ? `c${s.slot}` : 'is-inert',
              s.id && s.id === selectedId && 'is-selected',
              s.id && selectedId && s.id !== selectedId && !neighborIds.has(s.id) && 'is-faded',
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
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={7} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={d} fill="var(--map-selected)" />
        <path d={d} className="map-selected-outline" vectorEffect="non-scaling-stroke" />
      </g>
    );
  }, [layers, selectedId]);

  return (
    <svg
      ref={svgRef}
      className="map-svg animate-fade-in"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Interactive world map. Select a country to see its details."
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHover(null)}
      onClick={handleClick}
    >
      <defs>
        <radialGradient id="ocean-fill" cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#8fdcff" />
          <stop offset="100%" stopColor="#5fbcf5" />
        </radialGradient>
      </defs>
      <g ref={zoomLayerRef}>
        <path d={layers.sphere} fill="url(#ocean-fill)" stroke="#1e1b4b" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        <path d={layers.graticule} className="map-graticule" vectorEffect="non-scaling-stroke" />
        {countryLayer}
        <path d={layers.coast} className="map-coast" vectorEffect="non-scaling-stroke" />
        <path d={layers.borders} className="map-borders" vectorEffect="non-scaling-stroke" />
        {night && (
          <g pointerEvents="none">
            {night.bands.map((b, i) => (
              <path key={i} d={b.d} fill={`rgba(${NIGHT_COLOR}, ${b.alpha})`} />
            ))}
          </g>
        )}
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
                `c${m.slot}`,
                m.id === selectedId && 'is-selected',
                selectedId && m.id !== selectedId && !neighborIds.has(m.id) && 'is-faded',
                activeIds && !activeIds.has(m.id) && m.id !== selectedId && 'is-dim',
              )}
            />
          ))}
        </g>
        {night && (
          <g ref={celestialRef} pointerEvents="none">
            {night.sun && (
              <g data-x={night.sun[0]} data-y={night.sun[1]}>
                <SunIcon />
              </g>
            )}
            {night.moon && (
              <g data-x={night.moon[0]} data-y={night.moon[1]}>
                <MoonIcon />
              </g>
            )}
          </g>
        )}
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
