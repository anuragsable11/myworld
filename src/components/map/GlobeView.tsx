import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoSphere } from 'd3-geo';
import { easeBackOut, easeCubicInOut } from 'd3-ease';
import { interpolate } from 'd3-interpolate';
import { boundsContain, colorSlotFor, type LowDetail, type Shape, type World } from '../../lib/geo';
import type { FocusOptions, MapHandle, MapViewProps } from './types';

const SPHERE: GeoSphere = { type: 'Sphere' };
const GRATICULE = geoGraticule10();
const DEFAULT_ROTATION: [number, number, number] = [-15, -22, 0];
const MIN_SCALE = 0.75;
const MAX_SCALE = 14;
const FOCUS_MAX_SCALE = 2.5;
const INK = '#1e1b4b';

/** Cartoon land colours (one per colour slot, matching the flat map). */
const LAND = ['#7ee2a8', '#80e4dc', '#ff9f9f', '#c3b1ff', '#ffbd7a', '#c8ec7a', '#ffa7d7'];
const COLORS = {
  selected: '#ffd23f',
  inert: '#e2e0f0',
  graticule: 'rgba(255, 255, 255, 0.5)',
};

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

/** A little top-down cartoon plane pointing along +x. */
function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#ff6b81';
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
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7cc8ff';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(9, 0, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

interface Animation {
  from: { rotate: [number, number, number]; scale: number };
  to: { rotate: [number, number, number]; scale: number };
  start: number;
  duration: number;
  ease: (t: number) => number;
}

/**
 * Cartoon orthographic globe on two canvases: the land layer redraws only when the view changes
 * (simplified while moving, full detail at rest); the scenery layer above it (clouds and an orbiting
 * plane) animates every frame. All per-frame state lives in refs; React only mounts it.
 */
export const GlobeView = forwardRef<MapHandle, MapViewProps>(function GlobeView(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneryRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const state = useRef({
    // The globe bounces in from here on mount.
    rotate: [DEFAULT_ROTATION[0] - 140, DEFAULT_ROTATION[1] + 14, 0] as [number, number, number],
    scale: 0.35,
    width: 0,
    height: 0,
    /** Current globe centre in CSS px; eased toward the centre of the unobscured area. */
    center: null as [number, number] | null,
    cloudDrift: 0,
    planeAngle: 0.6,
    introStarted: false,
    waves: null as { world: World; points: [number, number][] } | null,
    hoverId: null as string | null,
    pointer: null as { x: number; y: number } | null,
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as null | { x: number; y: number; rotate: [number, number, number]; moved: boolean },
    pinch: null as null | { distance: number; scale: number },
    animation: null as Animation | null,
    lastInteraction: 0,
    /** Last time the view moved; full detail is drawn once it has been still for a moment. */
    lastMotion: 0,
    detailed: false,
    dirty: true,
  });
  const projection = useRef(geoOrthographic().clipAngle(90).precision(0.6)).current;
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

  const animateTo = (rotate: [number, number, number], scale: number, duration = 1100, ease = easeCubicInOut, extraTurns = 0) => {
    const s = state.current;
    const target: [number, number, number] = [...rotate];
    // Rotate the short way round (plus any extra turns for a playful spin).
    while (target[0] - s.rotate[0] > 180) target[0] -= 360;
    while (target[0] - s.rotate[0] < -180) target[0] += 360;
    target[0] += extraTurns * 360;
    s.animation = {
      from: { rotate: [...s.rotate], scale: s.scale },
      to: { rotate: target, scale },
      start: performance.now(),
      duration: propsRef.current.reducedMotion ? 0 : duration,
      ease,
    };
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
      if (options?.spin) animateTo([-center[0], -center[1], 0], scale, 2600, easeCubicInOut, 2);
      else animateTo([-center[0], -center[1], 0], scale, 1300);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const scenery = sceneryRef.current!;
    const ctx = canvas.getContext('2d')!;
    const sctx = scenery.getContext('2d')!;
    // Clouds are painted opaque into a buffer, then composited with one opacity, so fading them
    // never reveals the outlines of overlapping puffs.
    const cloudBuffer = document.createElement('canvas');
    const bctx = cloudBuffer.getContext('2d')!;
    const s = state.current;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.width = canvas.clientWidth;
      s.height = canvas.clientHeight;
      for (const [c, cx] of [
        [canvas, ctx],
        [scenery, sctx],
        [cloudBuffer, bctx],
      ] as const) {
        c.width = Math.round(s.width * dpr);
        c.height = Math.round(s.height * dpr);
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      s.dirty = true;
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
      projection.translate(s.center).scale(baseRadius() * s.scale).rotate(s.rotate);
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

    const draw = (full: boolean) => {
      const { world, markers, selectedId, neighborIds, activeIds } = propsRef.current;
      const geometry = full ? world : world.lowDetail;
      configure();
      const path = geoPath(projection, ctx);
      const [cx, cy] = projection.translate();
      const r = projection.scale();
      const center: [number, number] = [-s.rotate[0], -s.rotate[1]];
      ctx.clearRect(0, 0, s.width, s.height);

      // Flat cartoon shadow on the "ground" below the globe.
      ctx.fillStyle = 'rgba(30, 27, 75, 0.14)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 1.12, r * 0.72, r * 0.085, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ocean
      const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
      ocean.addColorStop(0, '#9be3ff');
      ocean.addColorStop(0.55, '#5fbcf5');
      ocean.addColorStop(1, '#45a6ec');
      ctx.beginPath();
      path(SPHERE);
      ctx.fillStyle = ocean;
      ctx.fill();

      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      path(GRATICULE);
      ctx.strokeStyle = COLORS.graticule;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Little "~" wave marks on the open ocean
      if (s.waves?.world !== world) s.waves = { world, points: wavePoints(world) };
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (const point of s.waves.points) {
        const d = geoDistance(point, center);
        if (d > Math.PI / 2 - 0.1) continue;
        const p = projection(point);
        if (!p) continue;
        const facing = Math.cos(d);
        const size = Math.max(3, r * 0.022) * (0.45 + 0.55 * facing);
        ctx.globalAlpha = 0.65 * facing;
        ctx.beginPath();
        ctx.moveTo(p[0] - size, p[1]);
        ctx.quadraticCurveTo(p[0] - size / 2, p[1] - size * 0.7, p[0], p[1]);
        ctx.quadraticCurveTo(p[0] + size / 2, p[1] + size * 0.7, p[0] + size, p[1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Land in political colours, batched by colour + opacity. With a selection, countries other
      // than it and its neighbours fade back; the region filter fades countries outside it.
      const fill = (id: string | null): [string, number] => {
        if (!id) return [COLORS.inert, 1];
        if (id === selectedId) return [COLORS.selected, 1];
        const color = LAND[colorSlotFor(world, id)];
        if (activeIds && !activeIds.has(id)) return [color, 0.3];
        if (selectedId && !neighborIds.has(id)) return [color, 0.55];
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
        for (const shape of shapes) path(shape.feature);
        ctx.globalAlpha = Number(alpha);
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ink outlines: thin borders, thicker coastlines.
      ctx.lineJoin = 'round';
      ctx.beginPath();
      path(geometry.borders);
      ctx.strokeStyle = 'rgba(30, 27, 75, 0.7)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.beginPath();
      path(geometry.coastline);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (s.hoverId && s.hoverId !== selectedId) {
        ctx.beginPath();
        for (const shape of geometry.shapes) if (shape.id === s.hoverId) path(shape.feature);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      if (selectedId) {
        ctx.beginPath();
        for (const shape of geometry.shapes) if (shape.id === selectedId) path(shape.feature);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fillStyle = COLORS.selected;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }

      // Point markers on the visible hemisphere
      for (const m of markers) {
        if (geoDistance([m.lon, m.lat], center) > Math.PI / 2 - 0.05) continue;
        const p = projection([m.lon, m.lat]);
        if (!p) continue;
        const selected = m.id === selectedId;
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

      // Cel shading: a darker crescent on the lower right, and a glossy highlight on the upper left.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(cx - r - 2, cy - r - 2, r * 2 + 4, r * 2 + 4);
      ctx.arc(cx - r * 0.14, cy - r * 0.16, r * 1.02, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(30, 27, 75, 0.14)';
      ctx.fill('evenodd');
      // The gloss only makes sense while the whole ball is in view.
      ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * Math.max(0, Math.min(1, 1.7 - 0.7 * s.scale))})`;
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.47, cy - r * 0.5, r * 0.16, r * 0.07, -0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - r * 0.24, cy - r * 0.7, r * 0.032, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.stroke();

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
      const opacity = Math.max(0.15, Math.min(1, 1.35 - 0.35 * s.scale)) * (selectedId ? 0.45 : 1);
      // Fully opaque clouds go straight onto the scenery canvas; faded ones need the buffer.
      const opaque = opacity >= 0.999;
      const cctx = opaque ? sctx : bctx;
      if (!opaque) bctx.clearRect(0, 0, s.width, s.height);
      const puffPass = (puffs: { x: number; y: number; size: number }[], color: string, grow: number, shift: number, k: number) => {
        cctx.fillStyle = color;
        cctx.beginPath();
        for (const p of puffs) {
          const r = p.size * k + grow;
          cctx.moveTo(p.x + r, p.y - p.size * shift);
          cctx.arc(p.x, p.y - p.size * shift, r, 0, Math.PI * 2);
        }
        cctx.fill();
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
        // Ink outline, pale-blue underside, then the white top of the cloud.
        puffPass(puffs, INK, 2.5, 0, 1);
        puffPass(puffs, '#d6ecff', 0, 0, 1);
        puffPass(puffs, '#ffffff', 0, 0.16, 0.86);
      }
      if (!opaque) {
        sctx.globalAlpha = opacity;
        sctx.drawImage(cloudBuffer, 0, 0, s.width, s.height);
        sctx.globalAlpha = 1;
      }

      // A little plane on a tilted orbit; it passes behind the globe on the far side.
      if (s.scale > 1.6) return;
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
      for (let k = 1; k <= 12; k++) {
        const p = orbit(s.planeAngle - k * 0.06);
        if (!p.front && !outsideGlobe(p.x, p.y)) continue;
        sctx.globalAlpha = 0.9 - k * 0.065;
        sctx.fillStyle = '#ffffff';
        sctx.strokeStyle = INK;
        sctx.lineWidth = 1.2;
        sctx.beginPath();
        sctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        sctx.fill();
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

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const { selectedId, reducedMotion } = propsRef.current;

      if (s.animation) {
        const a = s.animation;
        const t = a.duration ? Math.min(1, (now - a.start) / a.duration) : 1;
        const e = a.ease(t);
        s.rotate = interpolate(a.from.rotate, a.to.rotate)(e) as [number, number, number];
        s.scale = Math.max(0.2, a.from.scale + (a.to.scale - a.from.scale) * e);
        if (t >= 1) s.animation = null;
        s.dirty = true;
        s.lastMotion = now;
      } else if (!selectedId && !s.drag && !reducedMotion && now - s.lastInteraction > 2500) {
        s.rotate = [s.rotate[0] + dt * 0.007, s.rotate[1], 0];
        s.dirty = true;
        s.lastMotion = now;
      }

      // Ease the globe toward the centre of the unobscured area when cards open and close.
      const [tx, ty] = available().center;
      if (s.center && Math.hypot(tx - s.center[0], ty - s.center[1]) > 0.5) {
        const k = reducedMotion ? 1 : Math.min(1, dt * 0.01);
        s.center = [s.center[0] + (tx - s.center[0]) * k, s.center[1] + (ty - s.center[1]) * k];
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

      // Simplified geometry while moving; one full-detail frame once the view is still.
      const resting = now - s.lastMotion > 160;
      if (s.dirty || (resting && !s.detailed)) {
        s.dirty = false;
        s.detailed = resting;
        draw(resting);
      }

      if (!reducedMotion) s.cloudDrift += dt * 0.0024;
      drawScenery(dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

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
      s.lastInteraction = performance.now();
      if (s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()];
        s.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: s.scale };
        s.drag = null;
      } else {
        s.drag = { ...p, rotate: [...s.rotate], moved: false };
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
      if (drag && !drag.moved && e.type === 'pointerup') {
        const p = local(e);
        const hit = hitTest(p.x, p.y);
        if (hit?.id) propsRef.current.onSelect(hit.id);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      s.animation = null;
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

  // Redraw when anything visual changes (including a freshly mounted pin that needs placing).
  const { selectedId, neighborIds, activeIds, world, markers, insets } = props;
  useEffect(() => {
    state.current.dirty = true;
  }, [selectedId, neighborIds, activeIds, world, markers, insets]);

  return (
    <div className="relative h-full w-full animate-fade-in">
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        role="img"
        aria-label="Interactive 3D globe. Drag to rotate, scroll to zoom, select a country to see its details."
      />
      <canvas ref={sceneryRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
});
