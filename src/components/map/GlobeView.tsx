import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { geoContains, geoDistance, geoGraticule, geoGraticule10, geoOrthographic, geoPath, type GeoContext, type GeoSphere } from 'd3-geo';
import { easeBackOut, easeCubicInOut, easeSinInOut } from 'd3-ease';
import { interpolate } from 'd3-interpolate';
import type { Feature, LineString, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import { flightCamera, flightRoute, type FlightPlan, type FlightRoute } from '../../lib/flight';
import { boundsContain, colorSlotFor, type LowDetail, type Shape, type World } from '../../lib/geo';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { antipode, nightBands, NIGHT_COLOR, subsolarPoint } from '../../lib/sun';
import { SHUFFLE_MS, type FocusOptions, type MapHandle, type MapViewProps } from './types';

const SPHERE: GeoSphere = { type: 'Sphere' };
const GRATICULE = geoGraticule10();
/** A sparser grid for fast spins, when every projected point counts. */
const COARSE_GRATICULE = geoGraticule().step([20, 20]).precision(5)();
const DEFAULT_ROTATION: [number, number, number] = [-15, -22, 0];
const MIN_SCALE = 0.75;
const MAX_SCALE = 14;
const FOCUS_MAX_SCALE = 2.5;
const INK = '#1e1b4b';
/** While the globe moves fast it is drawn at no more than this pixel ratio, then sharpened at rest. */
const MOVING_DPR = 1.25;
/** A flicked globe keeps turning, slowing down with this time constant (ms). */
const INERTIA_MS = 380;
/**
 * While a finger turns the globe, a flick carries it on, or a shuffle spins it, it "clicks" (a tick
 * of vibration and sound) every this many degrees, but never closer together than NOTCH_MS.
 */
const NOTCH_DEGREES = 20;
const NOTCH_MS = 45;
/**
 * A flight starts with the camera gliding to the runway while the route draws itself, for this
 * long; then the plane leaves.
 */
const FLIGHT_PREP_MS = 1150;
/**
 * While a plane is in the air and the camera follows it, the globe is drawn at every frame, at no
 * more than this pixel ratio (the slow drift of a resting globe gets by on every other frame).
 */
const FLIGHT_DPR = 1.5;
/** Frames further apart than this (ms, on average) mean the device can't keep up: back to every other frame. */
const FLIGHT_SLOW_FRAME_MS = 26;
/** How long after it appears a flag pin touches the ground (see MapPin). */
const PIN_TOUCHDOWN_MS = 405;

/** Cartoon land colours (one per colour slot, matching the flat map). */
const LAND = ['#7ee2a8', '#80e4dc', '#ff9f9f', '#c3b1ff', '#ffbd7a', '#c8ec7a', '#ffa7d7'];
const COLORS = {
  selected: '#ffd23f',
  inert: '#e2e0f0',
  graticule: 'rgba(255, 255, 255, 0.38)',
};

/**
 * A circle on the sphere that contains a shape, kept as its centre's unit vector and the sines that
 * decide, with one dot product, whether the shape is wholly behind, wholly in front or across the edge.
 */
interface Cap {
  x: number;
  y: number;
  z: number;
  /** sin(radius): behind the globe when the dot product is below minus this. */
  far: number;
  /** sin(radius + margin): wholly in front when the dot product is above this. */
  near: number;
}

const RADIANS = Math.PI / 180;

const unit = (lon: number, lat: number): [number, number, number] => {
  const cosLat = Math.cos(lat * RADIANS);
  return [cosLat * Math.cos(lon * RADIANS), cosLat * Math.sin(lon * RADIANS), Math.sin(lat * RADIANS)];
};

function boundingCap(points: Position[]): Cap {
  // Centre: the direction of the summed unit vectors; radius: the farthest point from it.
  let [x, y, z] = [0, 0, 0];
  for (const [lon, lat] of points) {
    const [px, py, pz] = unit(lon, lat);
    x += px;
    y += py;
    z += pz;
  }
  const length = Math.hypot(x, y, z) || 1;
  [x, y, z] = [x / length, y / length, z / length];
  let minDot = 1;
  for (const [lon, lat] of points) {
    const [px, py, pz] = unit(lon, lat);
    minDot = Math.min(minDot, x * px + y * py + z * pz);
  }
  const radius = Math.acos(Math.max(-1, Math.min(1, minDot)));
  return { x, y, z, far: Math.sin(Math.min(radius, Math.PI / 2)), near: radius + 0.02 >= Math.PI / 2 ? 2 : Math.sin(radius + 0.02) };
}

const featureCaps = new WeakMap<Feature, Cap>();
function featureCap(feature: Feature<Polygon | MultiPolygon>): Cap {
  let cap = featureCaps.get(feature);
  if (!cap) {
    const g = feature.geometry;
    cap = boundingCap((g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()).flat());
    featureCaps.set(feature, cap);
  }
  return cap;
}

/** The lines of a mesh (borders, coastline), each with its cap. */
const meshLines = new WeakMap<MultiLineString, { line: Position[]; cap: Cap }[]>();
function linesOf(mesh: MultiLineString) {
  let lines = meshLines.get(mesh);
  if (!lines) {
    lines = mesh.coordinates.map((line) => ({ line, cap: boundingCap(line) }));
    meshLines.set(mesh, lines);
  }
  return lines;
}

/** Deterministic pseudo-random numbers so the scenery is the same on every visit. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Puffy cloud systems in geographic coordinates: a short row of overlapping puffs each. */
const CLOUDS = Array.from({ length: 13 }, (_, i) => {
  const lat = (rand(i + 1) < 0.5 ? 1 : -1) * (10 + rand(i + 2) * 46);
  const lon = rand(i + 3) * 360 - 180;
  const n = 3 + Math.floor(rand(i + 4) * 3);
  const middle = Math.floor(n / 2);
  return Array.from({ length: n }, (_, j) => ({
    lon: lon + (j - (n - 1) / 2) * 3.4 + (rand(i * 31 + j) - 0.5) * 1.2,
    lat: lat + (rand(i * 17 + j) - 0.5) * 2 + (j === middle ? 1.1 : 0),
    radius: 2.1 + rand(i * 7 + j) * 1.3 + (j === middle ? 0.9 : 0),
  }));
});

/** Ocean points for the little "~" wave marks, chosen once per world so none land on a country. */
function wavePoints(world: World): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 300 && out.length < 80; i++) {
    const p: [number, number] = [rand(i * 3 + 101) * 360 - 180, (rand(i * 5 + 7) - 0.5) * 130];
    if (!world.shapes.some((sh) => boundsContain(sh.bounds, p) && geoContains(sh.feature, p))) out.push(p);
  }
  return out;
}

/** A little top-down cartoon plane pointing along +x; or, as a `shadow`, just its dark shape. */
function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, shadow = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = INK;
  ctx.fillStyle = shadow ? INK : '#ff6b81';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-1, 2 * side);
    ctx.lineTo(-9, 15 * side);
    ctx.lineTo(-4, 15 * side);
    ctx.lineTo(7, 2 * side);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, side);
    ctx.lineTo(-17, 7 * side);
    ctx.lineTo(-14, 7 * side);
    ctx.lineTo(-9, side);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (!shadow) ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!shadow) {
    ctx.fillStyle = '#7cc8ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(9, 0, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Cartoon sun marking where the sun is directly overhead right now. */
function drawSunIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
    ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
    ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Cartoon crescent moon marking where it is midnight right now. */
function drawMoonIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  // Outer disc r=9 at the origin minus a disc r=8 at (5, 0). The circles cross at (4.2, ±7.96):
  // 62.2° on the outer circle and 95.7° on the inner one.
  const outer = (62.2 * Math.PI) / 180;
  const inner = (95.7 * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(0, 0, 9, outer, Math.PI * 2 - outer);
  ctx.arc(5, 0, 8, Math.PI * 2 - inner, inner, true);
  ctx.closePath();
  ctx.fillStyle = '#fff3b0';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

interface Animation {
  from: { rotate: [number, number, number]; scale: number };
  to: { rotate: [number, number, number]; scale: number };
  start: number;
  duration: number;
  ease: (t: number) => number;
  /** How far the camera pulls back halfway through, as a share of the zoom. */
  dip: number;
  /** A shuffle, which clicks as it turns and chimes when it lands. */
  spin: boolean;
}

/** A flight under way: the plan, its route over the globe, and how far the plane has got. */
interface Flight {
  plan: FlightPlan;
  route: FlightRoute;
  /** Time since the plan arrived, in ms; it only runs while the globe is being drawn. */
  elapsed: number;
  /** How far along the route the plane is, from 0 to 1. */
  progress: number;
  /** The progress last passed on to whoever is listening. */
  reported: number;
  tookOff: boolean;
  landed: boolean;
  /** Time on the ground since landing, in ms: the plane gives way to the flag pin that drops on it. */
  landedFor: number;
  /** The camera travels with the plane until someone moves the globe themselves. */
  follow: boolean;
  /** A running average of the time between frames, to notice a device that can't keep up. */
  frameMs: number;
  halfRate: boolean;
}

/**
 * Cartoon orthographic globe with a premium finish (lighting, atmosphere, soft shadows) on three canvases: the land layer redraws only when the view changes
 * (simplified while moving, full detail at rest); the scenery layer above it (clouds and an orbiting
 * plane) animates every frame; and a flight between two countries, when one is shown, is drawn on
 * the layer above that. All per-frame state lives in refs; React only mounts it.
 */
export const GlobeView = forwardRef<MapHandle, MapViewProps>(function GlobeView(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneryRef = useRef<HTMLCanvasElement>(null);
  const flightRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  /** Restarts the render loop after it has rested while the globe was covered. */
  const wake = useRef(() => {});

  const state = useRef({
    // The globe bounces in from here on mount.
    rotate: [DEFAULT_ROTATION[0] - 140, DEFAULT_ROTATION[1] + 14, 0] as [number, number, number],
    scale: 0.35,
    width: 0,
    height: 0,
    /** Current globe centre and radius (at zoom 1) in CSS px; eased toward the unobscured area. */
    center: null as [number, number] | null,
    radius: null as number | null,
    /** Pixel ratio the land canvas is currently drawn at. */
    dpr: 1,
    cloudDrift: 0,
    planeAngle: 0.6,
    introStarted: false,
    waves: null as { world: World; points: [number, number][] } | null,
    /** Day/night shading for the current minute. */
    night: null as { minute: number; bands: ReturnType<typeof nightBands>; sun: [number, number] } | null,
    /** The night bands as projected for the last land frame, reused to shade the clouds. */
    nightPaths: [] as { path: Path2D; alpha: number }[],
    hoverId: null as string | null,
    pointer: null as { x: number; y: number } | null,
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as null | {
      x: number;
      y: number;
      rotate: [number, number, number];
      moved: boolean;
      /** Recent positions, to measure how fast the globe was flicked. */
      samples: { t: number; rotate: [number, number, number] }[];
    },
    pinch: null as null | { distance: number; scale: number },
    animation: null as Animation | null,
    /** Spin left over from a flick, in degrees per ms. */
    inertia: null as null | { vx: number; vy: number },
    /** Last time the clouds and plane were drawn; they update at half rate while the land is still. */
    lastScenery: 0,
    /** For the clicks: the rotation last frame, degrees turned since the last click, and its time. */
    lastRotate: null as [number, number, number] | null,
    turned: 0,
    lastNotch: 0,
    lastInteraction: 0,
    /** Last time the view moved; full detail is drawn once it has been still for a moment. */
    lastMotion: 0,
    detailed: false,
    dirty: true,
    /** The flight being shown, if any, and whether its canvas has anything on it to wipe. */
    flight: null as Flight | null,
    flightDrawn: false,
  });
  const projection = useRef(geoOrthographic().clipAngle(90).precision(0.6)).current;
  // The same view without clipping at the horizon, for shapes wholly on the near side: clipping
  // (which also tests which side each polygon wraps) is most of the cost of projecting a shape.
  const nearSide = useRef(geoOrthographic().preclip((stream) => stream)).current;
  const cloudProjection = useRef(geoOrthographic().clipAngle(90)).current;

  const available = () => {
    const { width, height } = state.current;
    const { top, right, bottom, left } = propsRef.current.insets;
    const w = Math.max(120, width - left - right);
    const h = Math.max(120, height - top - bottom);
    return { w, h, center: [left + w / 2, top + h / 2] as [number, number] };
  };
  const baseRadius = () => {
    const { w, h } = available();
    return Math.min(w, h) * 0.38;
  };

  const animateTo = (
    rotate: [number, number, number],
    scale: number,
    duration = 1100,
    ease: (t: number) => number = easeCubicInOut,
    options: { dip?: number; spin?: boolean } = {},
  ) => {
    const s = state.current;
    const target: [number, number, number] = [...rotate];
    // Rotate the short way round; a shuffle adds one more turn in the same direction.
    while (target[0] - s.rotate[0] > 180) target[0] -= 360;
    while (target[0] - s.rotate[0] < -180) target[0] += 360;
    if (options.spin) target[0] += target[0] >= s.rotate[0] ? 360 : -360;
    s.inertia = null;
    // Any other move of the camera (zooming, resetting) takes it off the plane's tail.
    if (s.flight) s.flight.follow = false;
    s.animation = {
      from: { rotate: [...s.rotate], scale: s.scale },
      to: { rotate: target, scale },
      start: performance.now(),
      duration: propsRef.current.reducedMotion ? 0 : duration,
      ease,
      dip: options.dip ?? 0,
      spin: !!options.spin,
    };
    wake.current();
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => animateTo(state.current.rotate, Math.min(MAX_SCALE, state.current.scale * 1.6), 650, easeBackOut),
    zoomOut: () => animateTo(state.current.rotate, Math.max(MIN_SCALE, state.current.scale / 1.6), 650, easeBackOut),
    reset: () => animateTo([state.current.rotate[0], DEFAULT_ROTATION[1], 0], 1, 1100, easeBackOut.overshoot(1.2)),
    focus: (id: string, options?: FocusOptions) => {
      const { world, markers } = propsRef.current;
      const focus = world.focus.get(id);
      const marker = markers.find((m) => m.id === id);
      const center = focus?.centroid ?? (marker ? ([marker.lon, marker.lat] as [number, number]) : null);
      if (!center) return;
      // Small countries are framed with some surrounding context.
      const radius = Math.max(focus?.radius ?? 0, 0.12);
      const { w, h } = available();
      const wanted = (Math.min(w, h) * 0.26) / Math.sin(Math.min(radius, Math.PI / 2));
      // Stay zoomed out enough that the globe's curvature remains visible.
      const scale = Math.min(FOCUS_MAX_SCALE, Math.max(1, wanted / baseRadius()));
      // A shuffle is a camera flight: one smooth extra turn (sine easing keeps the top speed low),
      // pulling back a little on the way.
      if (options?.spin) {
        sounds.whoosh();
        animateTo([-center[0], -center[1], 0], scale, SHUFFLE_MS.globe, easeSinInOut, { dip: 0.22, spin: true });
      } else animateTo([-center[0], -center[1], 0], scale, 1300);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const scenery = sceneryRef.current!;
    const flightCanvas = flightRef.current!;
    const ctx = canvas.getContext('2d')!;
    const sctx = scenery.getContext('2d')!;
    const fctx = flightCanvas.getContext('2d')!;
    const s = state.current;
    let frame = 0;
    let last = performance.now();

    const fullDpr = () => Math.min(window.devicePixelRatio || 1, 2);
    const setDpr = (c: HTMLCanvasElement, cx: CanvasRenderingContext2D, dpr: number) => {
      c.width = Math.round(s.width * dpr);
      c.height = Math.round(s.height * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const resize = () => {
      s.width = canvas.clientWidth;
      s.height = canvas.clientHeight;
      s.dpr = fullDpr();
      setDpr(canvas, ctx, s.dpr);
      setDpr(scenery, sctx, fullDpr());
      setDpr(flightCanvas, fctx, fullDpr());
      s.dirty = true;
      // Resizing clears the canvases: draw them again even while resting.
      wake.current();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Bounce in on first appearance (a selection's focus() simply takes over this animation). Only
    // once, so re-running this effect (React StrictMode) cannot override a focus() already under way.
    if (!s.introStarted) {
      s.introStarted = true;
      animateTo(DEFAULT_ROTATION, 1, 1800, easeBackOut.overshoot(1.4));
    }

    const configure = () => {
      s.center ??= available().center;
      s.radius ??= baseRadius();
      projection.translate(s.center).scale(s.radius * s.scale).rotate(s.rotate);
    };

    const hitTest = (x: number, y: number): { id: string | null; name: string } | null => {
      configure();
      const { world, markers, names } = propsRef.current;
      const p = projection.invert?.([x, y]);
      if (!p) return null;
      const center: [number, number] = [-s.rotate[0], -s.rotate[1]];
      if (geoDistance(p, center) > Math.PI / 2 - 0.01) return null;
      for (const m of markers) {
        const mp = projection([m.lon, m.lat]);
        if (mp && geoDistance([m.lon, m.lat], center) < Math.PI / 2 && Math.hypot(mp[0] - x, mp[1] - y) < 10) {
          return { id: m.id, name: names.get(m.id) ?? m.id };
        }
      }
      const shape = world.shapes.find((sh: Shape) => boundsContain(sh.bounds, p) && geoContains(sh.feature, p));
      if (!shape) return null;
      return shape.id
        ? { id: shape.id, name: names.get(shape.id) ?? shape.name }
        : { id: null, name: `${shape.name} (disputed)` };
    };

    /** Moves the DOM pin onto the selected country, hiding it on the far side of the globe. */
    const placePin = () => {
      const { world, markers, selectedId, pinRef } = propsRef.current;
      const pin = pinRef.current;
      if (!pin) return;
      const focus = selectedId ? world.focus.get(selectedId) : undefined;
      const marker = selectedId && !focus ? markers.find((m) => m.id === selectedId) : undefined;
      const point = focus?.centroid ?? (marker ? ([marker.lon, marker.lat] as [number, number]) : null);
      const visible = point && geoDistance(point, [-s.rotate[0], -s.rotate[1]]) < Math.PI / 2 - 0.15;
      const xy = visible ? projection(point) : null;
      if (xy) pin.move(xy[0], xy[1]);
      else pin.hide();
    };

    /**
     * Full detail at rest; simplified shapes while moving; coarser shapes, a sparser grid and looser
     * curve sampling while moving fast, when projecting points is most of the work.
     */
    const draw = (detail: 'full' | 'low' | 'motion') => {
      const { world, markers, selectedId, neighborIds, activeIds, showNight } = propsRef.current;
      // A flight lights up the two countries it joins, the way a selection lights up one.
      const flight = s.flight?.plan;
      const lit = (id: string | null) => !!id && (id === selectedId || (!!flight && (id === flight.from.id || id === flight.to.id)));
      const full = detail === 'full';
      const geometry = full ? world : detail === 'low' ? world.lowDetail : world.motionDetail;
      projection.precision(detail === 'motion' ? 2.5 : 0.6);
      configure();
      nearSide.translate(projection.translate()).scale(projection.scale()).rotate(projection.rotate()).precision(projection.precision());
      const path = geoPath(projection, ctx);
      const nearPath = geoPath(nearSide, ctx);
      const [cx, cy] = projection.translate();
      const r = projection.scale();
      const center: [number, number] = [-s.rotate[0], -s.rotate[1]];
      // Shapes on the far side are skipped; shapes wholly on the near side skip clipping.
      const [vx, vy, vz] = unit(center[0], center[1]);
      const side = (cap: Cap) => {
        const dot = cap.x * vx + cap.y * vy + cap.z * vz;
        return dot < -cap.far ? 'far' : dot > cap.near ? 'near' : 'edge';
      };
      const shapePath = (feature: Feature<Polygon | MultiPolygon>) => {
        const where = side(featureCap(feature));
        if (where !== 'far') (where === 'near' ? nearPath : path)(feature);
      };
      const meshPath = (mesh: MultiLineString) => {
        const near: Position[][] = [];
        const edge: Position[][] = [];
        for (const { line, cap } of linesOf(mesh)) {
          const where = side(cap);
          if (where === 'near') near.push(line);
          else if (where === 'edge') edge.push(line);
        }
        if (near.length) nearPath({ type: 'MultiLineString', coordinates: near });
        if (edge.length) path({ type: 'MultiLineString', coordinates: edge });
      };
      ctx.clearRect(0, 0, s.width, s.height);

      // A soft shadow on the "ground" below the globe, and a glow of atmosphere around it.
      ctx.save();
      ctx.translate(cx, cy + r * 1.14);
      ctx.scale(1, 0.12);
      const ground = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8);
      ground.addColorStop(0, 'rgba(30, 27, 75, 0.3)');
      ground.addColorStop(0.55, 'rgba(30, 27, 75, 0.12)');
      ground.addColorStop(1, 'rgba(30, 27, 75, 0)');
      ctx.fillStyle = ground;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const halo = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.22);
      halo.addColorStop(0, 'rgba(110, 200, 255, 0.55)');
      halo.addColorStop(0.3, 'rgba(110, 200, 255, 0.2)');
      halo.addColorStop(1, 'rgba(110, 200, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
      ctx.fill();

      // Ocean
      const ocean = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.04, cx, cy, r * 1.04);
      ocean.addColorStop(0, '#b4efff');
      ocean.addColorStop(0.3, '#6fd0fa');
      ocean.addColorStop(0.7, '#3aa3ec');
      ocean.addColorStop(1, '#2378cf');
      ctx.beginPath();
      path(SPHERE);
      ctx.fillStyle = ocean;
      ctx.fill();

      // Dashed while still; dashes are slow to draw, so a fainter solid line stands in while moving.
      if (full) ctx.setLineDash([2, 5]);
      ctx.beginPath();
      path(detail === 'motion' ? COARSE_GRATICULE : GRATICULE);
      ctx.strokeStyle = COLORS.graticule;
      ctx.globalAlpha = full ? 1 : 0.45;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Little "~" wave marks on the open ocean, stroked in a few batches by how much they face us.
      if (s.waves?.world !== world) s.waves = { world, points: wavePoints(world) };
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const WAVE_BANDS = 4;
      const bands: [number, number, number][][] = Array.from({ length: WAVE_BANDS }, () => []);
      for (const point of s.waves.points) {
        const d = geoDistance(point, center);
        if (d > Math.PI / 2 - 0.1) continue;
        const p = projection(point);
        if (!p) continue;
        const facing = Math.cos(d);
        const size = Math.max(3, r * 0.022) * (0.45 + 0.55 * facing);
        bands[Math.min(WAVE_BANDS - 1, Math.floor(facing * WAVE_BANDS))].push([p[0], p[1], size]);
      }
      bands.forEach((waves, band) => {
        if (!waves.length) return;
        ctx.globalAlpha = (0.45 * (band + 0.5)) / WAVE_BANDS;
        ctx.beginPath();
        for (const [x, y, size] of waves) {
          ctx.moveTo(x - size, y);
          ctx.quadraticCurveTo(x - size / 2, y - size * 0.7, x, y);
          ctx.quadraticCurveTo(x + size / 2, y + size * 0.7, x + size, y);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Land in political colours, batched by colour + opacity. With a selection, countries other
      // than it and its neighbours fade back; the region filter fades countries outside it.
      const fill = (id: string | null): [string, number] => {
        if (!id) return [COLORS.inert, 1];
        if (lit(id)) return [COLORS.selected, 1];
        const color = LAND[colorSlotFor(world, id)];
        if (activeIds && !activeIds.has(id)) return [color, 0.3];
        if (selectedId && !neighborIds.has(id)) return [color, 0.55];
        // The rest of the world steps back a little less, as the plane has to cross it.
        if (flight) return [color, 0.7];
        return [color, 1];
      };
      const groups = new Map<string, LowDetail['shapes']>();
      for (const shape of geometry.shapes) {
        const key = fill(shape.id).join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(shape);
      }
      for (const [key, shapes] of groups) {
        const [color, alpha] = key.split('|');
        ctx.beginPath();
        for (const shape of shapes) shapePath(shape.feature);
        ctx.globalAlpha = Number(alpha);
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ink outlines: thin borders, thicker coastlines.
      ctx.lineJoin = 'round';
      ctx.beginPath();
      meshPath(geometry.borders);
      ctx.strokeStyle = 'rgba(30, 27, 75, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      meshPath(geometry.coastline);
      ctx.strokeStyle = 'rgba(30, 27, 75, 0.85)';
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // Live night side (under the hover and selection, so those stay bright): nested twilight caps around the point where it is midnight.
      if (showNight) {
        const minute = Math.floor(Date.now() / 60_000);
        if (s.night?.minute !== minute) s.night = { minute, bands: nightBands(), sun: subsolarPoint() };
        s.nightPaths = s.night.bands.map((band) => {
          const shape = new Path2D();
          // Path2D draws like a canvas context, minus beginPath, which geoPath never calls.
          geoPath(projection, shape as unknown as GeoContext)(band.feature);
          return { path: shape, alpha: band.alpha };
        });
        for (const band of s.nightPaths) {
          ctx.fillStyle = `rgba(${NIGHT_COLOR}, ${band.alpha})`;
          ctx.fill(band.path);
        }
      }

      if (s.hoverId && !lit(s.hoverId)) {
        ctx.beginPath();
        for (const shape of geometry.shapes) if (shape.id === s.hoverId) shapePath(shape.feature);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      if (selectedId || flight) {
        ctx.beginPath();
        for (const shape of geometry.shapes) if (lit(shape.id)) shapePath(shape.feature);
        ctx.save();
        if (detail !== 'motion') {
          ctx.shadowColor = 'rgba(255, 190, 0, 0.9)';
          ctx.shadowBlur = 20;
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = COLORS.selected;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      // Point markers on the visible hemisphere
      for (const m of markers) {
        if (geoDistance([m.lon, m.lat], center) > Math.PI / 2 - 0.05) continue;
        const p = projection([m.lon, m.lat]);
        if (!p) continue;
        const selected = lit(m.id);
        ctx.beginPath();
        ctx.arc(p[0], p[1], selected ? 5.5 : m.id === s.hoverId ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = selected ? COLORS.selected : m.id === s.hoverId ? '#ffffff' : LAND[colorSlotFor(world, m.id)];
        ctx.globalAlpha = activeIds && !activeIds.has(m.id) && !selected ? 0.3 : 1;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Lighting, for a glossy 3D ball: light from the upper left that fades into shade on the far
      // side, a glow along the rim, and a soft highlight (only while the whole ball is in view).
      const whole = Math.max(0, Math.min(1, 1.7 - 0.7 * s.scale));
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const light = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.48, r * 0.05, cx - r * 0.1, cy - r * 0.12, r * 1.25);
      light.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
      light.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
      light.addColorStop(0.72, 'rgba(24, 20, 70, 0)');
      light.addColorStop(1, `rgba(24, 20, 70, ${showNight ? 0.16 : 0.32})`);
      ctx.fillStyle = light;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const rim = ctx.createRadialGradient(cx, cy, r * 0.84, cx, cy, r);
      rim.addColorStop(0, 'rgba(190, 235, 255, 0)');
      rim.addColorStop(0.8, 'rgba(190, 235, 255, 0.14)');
      rim.addColorStop(1, 'rgba(225, 248, 255, 0.5)');
      ctx.fillStyle = rim;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (whole > 0) {
        ctx.translate(cx - r * 0.44, cy - r * 0.5);
        ctx.rotate(-0.7);
        ctx.scale(1, 0.5);
        const gloss = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
        gloss.addColorStop(0, `rgba(255, 255, 255, ${0.8 * whole})`);
        gloss.addColorStop(0.45, `rgba(255, 255, 255, ${0.28 * whole})`);
        gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gloss;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // A crisp ink edge with a thin highlight just inside it.
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0, r - 2.6), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Where it is noon (sun) and midnight (moon) right now, when on the visible side.
      if (showNight && s.night) {
        for (const [point, icon] of [
          [s.night.sun, drawSunIcon],
          [antipode(s.night.sun), drawMoonIcon],
        ] as const) {
          if (geoDistance(point, center) > Math.PI / 2 - 0.08) continue;
          const p = projection(point);
          if (p) icon(ctx, p[0], p[1]);
        }
      }

      placePin();
    };

    /** Clouds and the orbiting plane; redrawn every frame on their own canvas. */
    const drawScenery = (dt: number) => {
      const { selectedId, reducedMotion } = propsRef.current;
      sctx.clearRect(0, 0, s.width, s.height);
      const [cx, cy] = projection.translate();
      const R = projection.scale();
      const rot: [number, number, number] = [s.rotate[0] + s.cloudDrift, s.rotate[1], 0];
      cloudProjection.translate([cx, cy]).scale(R).rotate(rot);
      const center: [number, number] = [-rot[0], -rot[1]];
      // Thin the clouds when zoomed in or when a country is selected, so the land stays readable.
      // They're painted opaque and the whole layer fades, so overlapping puffs never show their
      // outlines through each other (and the compositor does the fading for free).
      const opacity = Math.max(0.15, Math.min(1, 1.35 - 0.35 * s.scale)) * (selectedId || s.flight ? 0.45 : 1);
      if (Math.abs(opacity - Number(scenery.style.opacity || 1)) > 0.02) scenery.style.opacity = opacity.toFixed(2);
      const puffPass = (puffs: { x: number; y: number; size: number }[], color: string, grow: number, shift: number, k: number) => {
        sctx.fillStyle = color;
        sctx.beginPath();
        for (const p of puffs) {
          const r = p.size * k + grow;
          sctx.moveTo(p.x + r, p.y - p.size * shift);
          sctx.arc(p.x, p.y - p.size * shift, r, 0, Math.PI * 2);
        }
        sctx.fill();
      };

      for (const system of CLOUDS) {
        const puffs = system
          .map((puff) => {
            const d = geoDistance([puff.lon, puff.lat], center);
            if (d > Math.PI / 2 - 0.05) return null;
            const p = cloudProjection([puff.lon, puff.lat]);
            if (!p) return null;
            const facing = Math.cos(d);
            // Clouds float a little above the surface and shrink as they slip over the horizon.
            const x = cx + (p[0] - cx) * 1.05;
            const y = cy + (p[1] - cy) * 1.05;
            return { x, y, size: ((puff.radius * Math.PI) / 180) * R * Math.min(1, 0.2 + facing * 1.1) };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        if (!puffs.length) continue;
        // A soft shadow cast below, a pale-blue underside, then the white top of the cloud.
        sctx.save();
        sctx.translate(R * 0.012, R * 0.022);
        puffPass(puffs, 'rgba(30, 27, 75, 0.16)', 1.5, 0, 1);
        sctx.restore();
        puffPass(puffs, '#cfe6fb', 0, 0, 1);
        puffPass(puffs, '#ffffff', 0, 0.16, 0.86);
      }
      // Darken the clouds that sit on the night side ('source-atop' only paints over cloud pixels).
      if (propsRef.current.showNight && s.night) {
        sctx.save();
        sctx.globalCompositeOperation = 'source-atop';
        for (const band of s.nightPaths) {
          sctx.fillStyle = `rgba(${NIGHT_COLOR}, ${band.alpha * 1.5})`;
          sctx.fill(band.path);
        }
        sctx.restore();
      }

      // A little plane on a tilted orbit; it passes behind the globe on the far side. It stays away
      // while a flight is shown, which has a plane of its own.
      if (s.scale > 1.6 || s.flight) return;
      if (!reducedMotion) s.planeAngle += dt * 0.00055;
      const a = R * 1.24;
      const b = R * 0.38;
      const tilt = -0.32;
      const orbit = (t: number) => ({
        x: cx + a * Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt),
        y: cy + a * Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt),
        front: Math.sin(t) > 0,
      });
      const outsideGlobe = (x: number, y: number) => Math.hypot(x - cx, y - cy) > R;
      // A fading contrail behind the plane: a faint shadow, then white.
      sctx.lineCap = 'round';
      for (let k = 1; k <= 16; k++) {
        const p0 = orbit(s.planeAngle - (k - 1) * 0.045 - 0.03);
        const p1 = orbit(s.planeAngle - k * 0.045 - 0.03);
        if ((!p0.front && !outsideGlobe(p0.x, p0.y)) || (!p1.front && !outsideGlobe(p1.x, p1.y))) continue;
        const width = Math.max(1, 3.4 - k * 0.15);
        sctx.globalAlpha = 0.9 * (1 - k / 17);
        sctx.beginPath();
        sctx.moveTo(p0.x, p0.y);
        sctx.lineTo(p1.x, p1.y);
        sctx.strokeStyle = 'rgba(30, 27, 75, 0.22)';
        sctx.lineWidth = width + 1.6;
        sctx.stroke();
        sctx.strokeStyle = '#ffffff';
        sctx.lineWidth = width;
        sctx.stroke();
      }
      sctx.globalAlpha = 1;
      const plane = orbit(s.planeAngle);
      const ahead = orbit(s.planeAngle + 0.01);
      const angle = Math.atan2(ahead.y - plane.y, ahead.x - plane.x);
      const size = Math.min(1.3, Math.max(0.7, R / 260)) * (plane.front ? 1 : 0.85);
      sctx.save();
      if (!plane.front) {
        // Behind the globe: clip to the area outside the disc.
        sctx.beginPath();
        sctx.rect(0, 0, s.width, s.height);
        sctx.arc(cx, cy, R, 0, Math.PI * 2, true);
        sctx.clip('evenodd');
      }
      drawPlane(sctx, plane.x, plane.y, angle, size);
      sctx.restore();
    };

    /** Moves the flag pins at the two ends of a flight onto their places, hiding one that is round the back. */
    const placeFlightPins = (flight: Flight, center: [number, number]) => {
      const pins = propsRef.current.flightPins;
      if (!pins) return;
      for (const [stop, pinRef] of [
        [flight.plan.from, pins.from],
        [flight.plan.to, pins.to],
      ] as const) {
        const pin = pinRef.current;
        if (!pin) continue;
        const point: [number, number] = [stop.lon, stop.lat];
        const xy = geoDistance(point, center) < Math.PI / 2 - 0.15 ? projection(point) : null;
        if (xy) pin.move(xy[0], xy[1]);
        else pin.hide();
      }
    };

    /**
     * A flight, on its own canvas above the clouds: the way ahead as dots painted on the globe, the
     * way flown as a solid trail, a marker at each end, and the plane with its shadow.
     */
    const drawFlight = (now: number) => {
      const f = s.flight;
      if (!f) {
        if (s.flightDrawn) fctx.clearRect(0, 0, s.width, s.height);
        s.flightDrawn = false;
        return;
      }
      s.flightDrawn = true;
      fctx.clearRect(0, 0, s.width, s.height);
      configure();
      const { route, plan } = f;
      const R = projection.scale();
      const center: [number, number] = [-s.rotate[0], -s.rotate[1]];
      /** How squarely a place faces us: 1 in the middle of the globe, 0 on its edge, less round the back. */
      const facing = (point: [number, number]) => Math.cos(geoDistance(point, center));

      // The way ahead: dots a fixed distance apart on the ground, so they stay put as the globe turns
      // and bunch up towards its edge. They appear one after another while the camera gets ready.
      const revealed = f.tookOff ? 1 : Math.min(1, f.elapsed / (FLIGHT_PREP_MS * 0.8));
      const dots = Math.max(2, Math.round((route.angle * (s.radius ?? baseRadius()) * route.scale) / 11));
      fctx.beginPath();
      for (let i = 1; i < dots; i++) {
        const t = i / dots;
        if (t > revealed) break;
        if (t < f.progress + 0.5 / dots) continue;
        const point = route.at(t);
        const toward = facing(point);
        if (toward < 0.06) continue;
        const xy = projection(point);
        if (!xy) continue;
        const r = 1.2 + 1.2 * Math.min(1, toward * 1.6);
        fctx.moveTo(xy[0] + r, xy[1]);
        fctx.arc(xy[0], xy[1], r, 0, Math.PI * 2);
      }
      fctx.fillStyle = '#ffffff';
      fctx.fill();
      fctx.strokeStyle = 'rgba(30, 27, 75, 0.55)';
      fctx.lineWidth = 1.1;
      fctx.stroke();

      // The way flown: a solid trail from the runway to the plane.
      if (f.progress > 0) {
        const steps = Math.max(2, Math.ceil((route.angle * f.progress) / 0.035));
        const trail: LineString = {
          type: 'LineString',
          coordinates: Array.from({ length: steps + 1 }, (_, i) => route.at((f.progress * i) / steps)),
        };
        const path = geoPath(projection, fctx);
        fctx.lineCap = 'round';
        fctx.lineJoin = 'round';
        fctx.beginPath();
        path(trail);
        fctx.strokeStyle = 'rgba(30, 27, 75, 0.5)';
        fctx.lineWidth = 6.4;
        fctx.stroke();
        fctx.strokeStyle = '#ffffff';
        fctx.lineWidth = 3.6;
        fctx.stroke();
      }

      // A marker at each end, under the flag pins.
      for (const [stop, destination] of [
        [plan.from, false],
        [plan.to, true],
      ] as const) {
        const point: [number, number] = [stop.lon, stop.lat];
        if (facing(point) < 0.05) continue;
        const xy = projection(point);
        if (!xy) continue;
        if (destination && !f.landed) {
          // The destination calls the plane in: a ring spreading out from it, over and over.
          const pulse = (now % 1500) / 1500;
          fctx.beginPath();
          fctx.arc(xy[0], xy[1], 6 + pulse * 15, 0, Math.PI * 2);
          fctx.strokeStyle = `rgba(30, 27, 75, ${0.3 * (1 - pulse)})`;
          fctx.lineWidth = 4.5;
          fctx.stroke();
          fctx.strokeStyle = `rgba(255, 255, 255, ${1 - pulse})`;
          fctx.lineWidth = 2.5;
          fctx.stroke();
        }
        fctx.beginPath();
        fctx.arc(xy[0], xy[1], 5, 0, Math.PI * 2);
        fctx.fillStyle = destination ? '#ff6b81' : '#ffffff';
        fctx.fill();
        fctx.strokeStyle = INK;
        fctx.lineWidth = 2;
        fctx.stroke();
      }

      // The plane, nose along the route. It climbs away from the ground and comes back down to it:
      // it looks bigger in the middle of the flight, and its shadow falls further away. Once it has
      // landed it fades away under the flag pin that drops onto the same spot.
      const here = route.at(f.progress);
      const parked = Math.max(0, 1 - Math.max(0, f.landedFor - PIN_TOUCHDOWN_MS) / 350);
      if (parked > 0 && facing(here) > 0.04) {
        const xy = projection(here);
        const behind = projection(route.at(Math.max(0, f.progress - 0.02)));
        const ahead = projection(route.at(Math.min(1, f.progress + 0.02)));
        if (xy && behind && ahead) {
          const heading = Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]);
          const lift = Math.sin(Math.PI * f.progress);
          const size = Math.min(1.35, Math.max(0.62, R / 240)) * (0.82 + 0.4 * lift);
          fctx.globalAlpha = (0.24 - 0.08 * lift) * parked;
          drawPlane(fctx, xy[0] + (2 + 9 * lift) * size, xy[1] + (3 + 15 * lift) * size, heading, size * (1 - 0.12 * lift), true);
          fctx.globalAlpha = parked;
          drawPlane(fctx, xy[0], xy[1], heading, size);
          fctx.globalAlpha = 1;
        }
      }

      placeFlightPins(f, center);
    };

    const tick = (now: number) => {
      // Covered by an open sheet or menu: rest (no drawing at all) until it's uncovered, once
      // nothing is under way and the last change has been drawn.
      if (propsRef.current.paused && !s.dirty && !s.animation && !s.inertia && !s.drag && !s.pinch) {
        frame = 0;
        return;
      }
      const sinceLast = now - last;
      const dt = Math.min(64, sinceLast);
      last = now;
      const { selectedId, reducedMotion } = propsRef.current;

      // A flight: the plane waits while the camera reaches the runway, then flies the route.
      const f = s.flight;
      if (f?.landed) f.landedFor += dt;
      if (f && !f.landed) {
        f.elapsed += dt;
        const t = reducedMotion ? 1 : Math.max(0, Math.min(1, (f.elapsed - FLIGHT_PREP_MS) / f.route.airMs));
        if (t > 0 && !f.tookOff) {
          f.tookOff = true;
          if (!reducedMotion) {
            sounds.takeoff();
            haptics.takeoff();
          }
        }
        f.progress = easeSinInOut(t);
        if (f.tookOff && t < 1) {
          // Full throttle for the climb, easing back at cruising height, then gliding in.
          sounds.jet(t < 0.2 ? 0.6 + 2 * t : t < 0.75 ? 1 - (t - 0.2) * 0.45 : Math.max(0.1, 0.75 - (t - 0.75) * 2.6));
          // Frames that keep arriving late mean this device can't draw the globe at every frame.
          f.frameMs += (Math.min(50, sinceLast) - f.frameMs) * 0.08;
          if (f.frameMs > FLIGHT_SLOW_FRAME_MS) f.halfRate = true;
        }
        if (f.progress !== f.reported) {
          f.reported = f.progress;
          propsRef.current.onFlightProgress?.(f.progress);
        }
        if (t >= 1) {
          f.landed = true;
          sounds.jet(0);
          sounds.touchdown();
          haptics.land();
          propsRef.current.onFlightLand?.();
        }
      }

      if (s.animation) {
        const a = s.animation;
        const t = a.duration ? Math.min(1, (now - a.start) / a.duration) : 1;
        const e = a.ease(t);
        s.rotate = interpolate(a.from.rotate, a.to.rotate)(e) as [number, number, number];
        // Zoom along the way, pulling the camera back a little mid-flight if asked to.
        s.scale = Math.max(0.2, (a.from.scale + (a.to.scale - a.from.scale) * e) * (1 - a.dip * Math.sin(Math.PI * t)));
        if (t >= 1) {
          s.animation = null;
          if (a.spin) {
            haptics.land();
            sounds.land();
          }
        }
        s.dirty = true;
        s.lastMotion = now;
      } else if (f?.follow && f.tookOff && !s.drag && !s.pinch) {
        // The camera travels with the plane (turning the short way round, like every other move).
        const camera = flightCamera(f.route, f.progress);
        let lon = -camera.lon;
        while (lon - s.rotate[0] > 180) lon -= 360;
        while (lon - s.rotate[0] < -180) lon += 360;
        if (Math.abs(lon - s.rotate[0]) > 1e-4 || Math.abs(-camera.lat - s.rotate[1]) > 1e-4 || Math.abs(camera.scale - s.scale) > 1e-4) {
          s.rotate = [lon, -camera.lat, 0];
          s.scale = camera.scale;
          s.dirty = true;
          s.lastMotion = now;
        }
      } else if (s.inertia && !s.drag) {
        // A flicked globe keeps turning and slows down smoothly.
        const { vx, vy } = s.inertia;
        s.rotate = [s.rotate[0] + vx * dt, Math.max(-88, Math.min(88, s.rotate[1] + vy * dt)), 0];
        const decay = Math.exp(-dt / INERTIA_MS);
        s.inertia = Math.hypot(vx, vy) * decay < 0.004 ? null : { vx: vx * decay, vy: vy * decay };
        s.dirty = true;
        s.lastMotion = s.lastInteraction = now;
      } else if (!selectedId && !f && !s.drag && !s.pinch && !reducedMotion && now - s.lastInteraction > 2500) {
        s.rotate = [s.rotate[0] + dt * 0.007, s.rotate[1], 0];
        s.dirty = true;
        s.lastMotion = now;
      }

      // Click as the globe turns by hand, coasts after a flick or spins in a shuffle (not while it
      // drifts on its own): the clicks speed up and slow down with it, like a prize wheel.
      const prev = s.lastRotate;
      s.lastRotate = [...s.rotate];
      if (prev && (s.drag || s.inertia || s.animation?.spin)) {
        const turn = Math.hypot(s.rotate[0] - prev[0], s.rotate[1] - prev[1]);
        s.turned += turn;
        if (s.turned >= NOTCH_DEGREES && now - s.lastNotch >= NOTCH_MS) {
          s.turned %= NOTCH_DEGREES;
          s.lastNotch = now;
          haptics.notch();
          sounds.tick();
        }
        // The air rushing past it, louder and higher the faster it turns.
        sounds.spin(turn / Math.max(dt, 1));
      } else {
        s.turned = 0;
        sounds.spin(0);
      }

      // Ease the globe toward the centre and size of the unobscured area when cards open and close.
      const [tx, ty] = available().center;
      const tr = baseRadius();
      if (s.center && s.radius && (Math.hypot(tx - s.center[0], ty - s.center[1]) > 0.5 || Math.abs(tr - s.radius) > 0.5)) {
        const k = reducedMotion ? 1 : Math.min(1, dt * 0.01);
        s.center = [s.center[0] + (tx - s.center[0]) * k, s.center[1] + (ty - s.center[1]) * k];
        s.radius += (tr - s.radius) * k;
        s.dirty = true;
        s.lastMotion = now;
      }

      if (s.pointer && !s.drag) {
        const hit = hitTest(s.pointer.x, s.pointer.y);
        const id = hit ? hit.id : null;
        if (id !== s.hoverId) {
          s.hoverId = id;
          s.dirty = true;
        }
        canvas.classList.toggle('is-pointing', !!hit?.id);
        propsRef.current.onHover(hit ? { ...hit, x: s.pointer.x, y: s.pointer.y } : null);
        s.pointer = null;
      }

      // The terminator moves a quarter of a degree a minute; refresh it once per minute.
      if (propsRef.current.showNight && s.night && s.night.minute !== Math.floor(Date.now() / 60_000)) s.dirty = true;

      // Fast moves (flights, flicks, drags, pinches) are drawn with simplified shapes at a lower pixel
      // ratio; once the view has been still for a moment it is drawn again in full detail.
      const resting = now - s.lastMotion > 160;
      const fast = !resting && !!(s.animation || s.inertia || s.drag || s.pinch);
      // A plane in the air is drawn at every frame; where the camera travels with it so is the land,
      // a little less sharply.
      const airborne = !!f && f.tookOff && !f.landed && !f.halfRate;
      const dpr = fast ? Math.min(MOVING_DPR, fullDpr()) : airborne && !resting ? Math.min(FLIGHT_DPR, fullDpr()) : fullDpr();
      if (dpr !== s.dpr) {
        s.dpr = dpr;
        setDpr(canvas, ctx, dpr);
        s.dirty = true;
      }

      // While nothing moves fast (slow auto-rotation, drifting clouds), half the frame rate is
      // plenty and saves battery.
      if (!fast && !airborne && now - s.lastScenery < 30) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const sceneryDt = Math.min(64, now - s.lastScenery);
      s.lastScenery = now;

      if (s.dirty || (resting && !s.detailed)) {
        s.dirty = false;
        s.detailed = resting;
        draw(resting ? 'full' : fast ? 'motion' : 'low');
      }

      if (!reducedMotion) s.cloudDrift += sceneryDt * 0.0024;
      drawScenery(sceneryDt);
      drawFlight(now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    wake.current = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    // ---------------------------------------------------------------- input
    const local = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      s.pointers.set(e.pointerId, p);
      s.animation = null;
      s.inertia = null;
      // From here the globe is in their hands; the plane flies on without the camera.
      if (s.flight) s.flight.follow = false;
      s.lastInteraction = performance.now();
      if (s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()];
        s.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: s.scale };
        s.drag = null;
      } else {
        s.drag = { ...p, rotate: [...s.rotate], moved: false, samples: [{ t: performance.now(), rotate: [...s.rotate] }] };
        canvas.classList.add('is-dragging');
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = local(e);
      if (s.pointers.has(e.pointerId)) s.pointers.set(e.pointerId, p);
      if (s.pinch && s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()];
        const ratio = Math.hypot(a.x - b.x, a.y - b.y) / s.pinch.distance;
        s.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.pinch.scale * ratio));
        s.dirty = true;
        s.lastMotion = performance.now();
        return;
      }
      if (s.drag) {
        const dx = p.x - s.drag.x;
        const dy = p.y - s.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) s.drag.moved = true;
        const k = 0.28 / s.scale;
        s.rotate = [s.drag.rotate[0] + dx * k, Math.max(-88, Math.min(88, s.drag.rotate[1] - dy * k)), 0];
        s.lastInteraction = s.lastMotion = performance.now();
        // Keep the last ~100 ms of movement to measure the flick on release.
        s.drag.samples.push({ t: s.lastMotion, rotate: [...s.rotate] });
        while (s.drag.samples.length > 2 && s.lastMotion - s.drag.samples[0].t > 100) s.drag.samples.shift();
        s.dirty = true;
        propsRef.current.onHover(null);
        return;
      }
      s.pointer = p;
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = s.drag;
      s.pointers.delete(e.pointerId);
      if (s.pointers.size < 2) s.pinch = null;
      s.drag = null;
      canvas.classList.remove('is-dragging');
      s.lastInteraction = performance.now();
      // A flick: carry on turning at the speed the finger was moving when it let go.
      if (drag?.moved && e.type === 'pointerup' && !s.pinch) {
        const first = drag.samples[0];
        const lastSample = drag.samples[drag.samples.length - 1];
        const span = lastSample.t - first.t;
        if (span > 0 && s.lastInteraction - lastSample.t < 50) {
          const cap = (v: number) => Math.max(-1.5, Math.min(1.5, v));
          const vx = cap((lastSample.rotate[0] - first.rotate[0]) / span);
          const vy = cap((lastSample.rotate[1] - first.rotate[1]) / span);
          if (Math.hypot(vx, vy) > 0.03) s.inertia = { vx, vy };
        }
      }
      if (drag && !drag.moved && e.type === 'pointerup') {
        const p = local(e);
        const hit = hitTest(p.x, p.y);
        if (hit?.id) propsRef.current.onSelect(hit.id);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      s.animation = null;
      s.inertia = null;
      if (s.flight) s.flight.follow = false;
      s.lastInteraction = performance.now();
      s.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.scale * Math.exp(-e.deltaY * 0.0015)));
      s.dirty = true;
      s.lastMotion = performance.now();
    };

    const onLeave = () => {
      s.hoverId = null;
      s.pointer = null;
      s.dirty = true;
      canvas.classList.remove('is-pointing');
      propsRef.current.onHover(null);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      wake.current = () => {};
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
    // Mount-only: the render loop reads the latest props through propsRef.
  }, []);

  // A new flight: the camera glides to where the flight is watched from while the route draws
  // itself, then the render loop flies the plane. (Below the effect above, so that on a globe which
  // has only just appeared the flight takes over from its entrance.)
  const flight = props.flight ?? null;
  useEffect(() => {
    const s = state.current;
    if (flight) {
      const route = flightRoute(flight);
      // Without animation the flight is shown as flown, seen from where it ends.
      const start = flightCamera(route, propsRef.current.reducedMotion ? 1 : 0);
      animateTo([-start.lon, -start.lat, 0], start.scale, 1000);
      s.flight = { plan: flight, route, elapsed: 0, progress: 0, reported: -1, tookOff: false, landed: false, landedFor: 0, follow: true, frameMs: 16, halfRate: false };
    } else s.flight = null;
    s.dirty = true;
    wake.current();
    // animateTo only reads refs.
  }, [flight]);

  // Redraw when anything visual changes (including a freshly mounted pin that needs placing).
  const { selectedId, neighborIds, activeIds, world, markers, insets, showNight, paused } = props;
  useEffect(() => {
    state.current.dirty = true;
  }, [selectedId, neighborIds, activeIds, world, markers, insets, showNight]);
  useEffect(() => {
    if (!paused) wake.current();
  }, [paused]);

  return (
    <div className="relative h-full w-full animate-view-in">
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        role="img"
        aria-label="Interactive 3D globe. Drag to rotate, scroll to zoom, select a country to see its details."
      />
      <canvas ref={sceneryRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500" />
      {/* A flight is drawn above the clouds, on a layer that doesn't fade with them. */}
      <canvas ref={flightRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
});
