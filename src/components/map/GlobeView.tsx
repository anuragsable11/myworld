import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoSphere } from 'd3-geo';
import { easeCubicInOut } from 'd3-ease';
import { interpolate } from 'd3-interpolate';
import { boundsContain, type LowDetail, type Shape } from '../../lib/geo';
import type { MapHandle, MapViewProps } from './types';

const SPHERE: GeoSphere = { type: 'Sphere' };
const GRATICULE = geoGraticule10();
const DEFAULT_ROTATION: [number, number, number] = [-15, -22, 0];
const MIN_SCALE = 0.75;
const MAX_SCALE = 14;
const FOCUS_MAX_SCALE = 3.2;
const COLORS = {
  land: '#1d2738',
  landDim: '#141b27',
  hover: '#2c3a52',
  neighbor: '#3d3627',
  selected: '#d9b26f',
  inert: '#182030',
  border: 'rgba(6, 9, 15, 0.85)',
  coast: 'rgba(138, 160, 190, 0.38)',
  graticule: 'rgba(255, 255, 255, 0.05)',
};

interface Animation {
  from: { rotate: [number, number, number]; scale: number };
  to: { rotate: [number, number, number]; scale: number };
  start: number;
  duration: number;
}

/** Orthographic globe rendered to canvas. All per-frame state lives in refs; React only mounts it. */
export const GlobeView = forwardRef<MapHandle, MapViewProps>(function GlobeView(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const state = useRef({
    rotate: [...DEFAULT_ROTATION] as [number, number, number],
    scale: 1,
    width: 0,
    height: 0,
    /** Current globe centre in CSS px; eased toward the centre of the unobscured area. */
    center: null as [number, number] | null,
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

  const baseRadius = () => Math.min(state.current.width, state.current.height) * 0.42;

  const animateTo = (rotate: [number, number, number], scale: number) => {
    const s = state.current;
    const target: [number, number, number] = [...rotate];
    // Rotate the short way round.
    while (target[0] - s.rotate[0] > 180) target[0] -= 360;
    while (target[0] - s.rotate[0] < -180) target[0] += 360;
    s.animation = {
      from: { rotate: [...s.rotate], scale: s.scale },
      to: { rotate: target, scale },
      start: performance.now(),
      duration: propsRef.current.reducedMotion ? 0 : 1100,
    };
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => animateTo(state.current.rotate, Math.min(MAX_SCALE, state.current.scale * 1.6)),
    zoomOut: () => animateTo(state.current.rotate, Math.max(MIN_SCALE, state.current.scale / 1.6)),
    reset: () => animateTo([state.current.rotate[0], DEFAULT_ROTATION[1], 0], 1),
    focus: (id: string) => {
      const { world, markers } = propsRef.current;
      const focus = world.focus.get(id);
      const marker = markers.find((m) => m.id === id);
      const center = focus?.centroid ?? (marker ? ([marker.lon, marker.lat] as [number, number]) : null);
      if (!center) return;
      // Small countries are framed with some surrounding context.
      const radius = Math.max(focus?.radius ?? 0, 0.12);
      const { width, height } = state.current;
      const { insets } = propsRef.current;
      const available = Math.min(width - insets.right, height - insets.bottom);
      const wanted = (available * 0.26) / Math.sin(Math.min(radius, Math.PI / 2));
      // Stay zoomed out enough that the globe's curvature remains visible.
      const scale = Math.min(FOCUS_MAX_SCALE, Math.max(1, wanted / baseRadius()));
      animateTo([-center[0], -center[1], 0], scale);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const s = state.current;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.width = canvas.clientWidth;
      s.height = canvas.clientHeight;
      canvas.width = Math.round(s.width * dpr);
      canvas.height = Math.round(s.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.dirty = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const targetCenter = (): [number, number] => {
      const { insets } = propsRef.current;
      return [(s.width - insets.right) / 2, (s.height - insets.bottom) / 2];
    };

    const configure = () => {
      s.center ??= targetCenter();
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
        if (mp && geoDistance([m.lon, m.lat], center) < Math.PI / 2 && Math.hypot(mp[0] - x, mp[1] - y) < 9) {
          return { id: m.id, name: names.get(m.id) ?? m.id };
        }
      }
      const shape = world.shapes.find((sh: Shape) => boundsContain(sh.bounds, p) && geoContains(sh.feature, p));
      if (!shape) return null;
      return shape.id
        ? { id: shape.id, name: names.get(shape.id) ?? shape.name }
        : { id: null, name: `${shape.name} (disputed)` };
    };

    const draw = (full: boolean) => {
      const { world, markers, selectedId, neighborIds, activeIds } = propsRef.current;
      const geometry = full ? world : world.lowDetail;
      configure();
      const path = geoPath(projection, ctx);
      const [cx, cy] = projection.translate();
      const r = projection.scale();
      ctx.clearRect(0, 0, s.width, s.height);

      // Atmosphere
      const halo = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.22);
      halo.addColorStop(0, 'rgba(217, 178, 111, 0.13)');
      halo.addColorStop(0.35, 'rgba(120, 150, 200, 0.06)');
      halo.addColorStop(1, 'rgba(120, 150, 200, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
      ctx.fill();

      // Ocean
      const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
      ocean.addColorStop(0, '#16233a');
      ocean.addColorStop(1, '#090e18');
      ctx.beginPath();
      path(SPHERE);
      ctx.fillStyle = ocean;
      ctx.fill();

      ctx.beginPath();
      path(GRATICULE);
      ctx.strokeStyle = COLORS.graticule;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Land, batched by fill colour
      const groups = new Map<string, LowDetail['shapes']>();
      for (const shape of geometry.shapes) {
        const id = shape.id;
        const color = !id
          ? COLORS.inert
          : id === selectedId
            ? COLORS.selected
            : id === s.hoverId
              ? COLORS.hover
              : neighborIds.has(id)
                ? COLORS.neighbor
                : activeIds && !activeIds.has(id)
                  ? COLORS.landDim
                  : COLORS.land;
        if (!groups.has(color)) groups.set(color, []);
        groups.get(color)!.push(shape);
      }
      for (const [color, shapes] of groups) {
        ctx.beginPath();
        for (const shape of shapes) path(shape.feature);
        ctx.fillStyle = color;
        ctx.fill();
      }

      ctx.beginPath();
      path(geometry.coastline);
      ctx.strokeStyle = COLORS.coast;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.beginPath();
      path(geometry.borders);
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (selectedId) {
        ctx.beginPath();
        for (const shape of geometry.shapes) if (shape.id === selectedId) path(shape.feature);
        ctx.strokeStyle = 'rgba(244, 226, 189, 0.95)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      // Point markers on the visible hemisphere
      const center: [number, number] = [-s.rotate[0], -s.rotate[1]];
      for (const m of markers) {
        if (geoDistance([m.lon, m.lat], center) > Math.PI / 2 - 0.05) continue;
        const p = projection([m.lon, m.lat]);
        if (!p) continue;
        const selected = m.id === selectedId;
        ctx.beginPath();
        ctx.arc(p[0], p[1], selected ? 4.5 : m.id === s.hoverId ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = selected ? COLORS.selected : '#06090f';
        ctx.globalAlpha = activeIds && !activeIds.has(m.id) && !selected ? 0.35 : 1;
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = selected ? '#f4e2bd' : m.id === s.hoverId ? '#e9edf3' : '#7d899c';
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Terminator-style shading and rim
      const shade = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r * 1.02);
      shade.addColorStop(0, 'rgba(255, 255, 255, 0.035)');
      shade.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
      shade.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
      ctx.beginPath();
      path(SPHERE);
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.strokeStyle = 'rgba(217, 178, 111, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const { selectedId, reducedMotion } = propsRef.current;

      if (s.animation) {
        const a = s.animation;
        const t = a.duration ? Math.min(1, (now - a.start) / a.duration) : 1;
        const e = easeCubicInOut(t);
        s.rotate = interpolate(a.from.rotate, a.to.rotate)(e) as [number, number, number];
        s.scale = a.from.scale + (a.to.scale - a.from.scale) * e;
        if (t >= 1) s.animation = null;
        s.dirty = true;
        s.lastMotion = now;
      } else if (!selectedId && !s.drag && !reducedMotion && now - s.lastInteraction > 2500) {
        s.rotate = [s.rotate[0] + dt * 0.006, s.rotate[1], 0];
        s.dirty = true;
        s.lastMotion = now;
      }

      // Ease the globe toward the centre of the unobscured area when overlays open/close.
      const [tx, ty] = targetCenter();
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

  // Redraw when anything visual changes.
  const { selectedId, neighborIds, activeIds, world, markers, insets } = props;
  useEffect(() => {
    state.current.dirty = true;
  }, [selectedId, neighborIds, activeIds, world, markers, insets]);

  return (
    <canvas
      ref={canvasRef}
      className="globe-canvas"
      role="img"
      aria-label="Interactive 3D globe. Drag to rotate, scroll to zoom, select a country to see its details."
    />
  );
});
