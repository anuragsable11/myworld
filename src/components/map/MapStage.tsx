import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { CountryIndex } from '../../hooks/queries';
import type { World } from '../../lib/geo';
import { CartoonSky } from './CartoonSky';
import { FlatMap } from './FlatMap';
import { GlobeView } from './GlobeView';
import { MapPin } from './MapPin';
import { MapTooltip, type TooltipHandle } from './MapTooltip';
import type { HoverInfo, Insets, MapHandle, MapMarker, PinHandle } from './types';

export type ViewMode = 'map' | 'globe';

const MemoFlatMap = memo(FlatMap);
const MemoGlobeView = memo(GlobeView);
const NO_NEIGHBORS = new Set<string>();
// Countries below this area (km²) are hard to hit on the map, so they also get a point marker.
const MARKER_AREA_KM2 = 1000;

interface MapStageProps {
  world: World | undefined;
  worldError: boolean;
  onRetry: () => void;
  index: CountryIndex | undefined;
  selectedId: string | null;
  activeIds: Set<string> | null;
  insets: Insets;
  view: ViewMode;
  reducedMotion: boolean;
  compact: boolean;
  onViewChange: (view: ViewMode) => void;
  onSelect: (id: string) => void;
  onSurprise: () => void;
  /** The country picked by "Surprise me"; the globe takes a few extra turns on the way there. */
  spinFor: string | null;
  showLegend: boolean;
  /** Changing this re-centres the map on the selection ("Show on map"). */
  locateKey: number;
}

export function MapStage({
  world,
  worldError,
  onRetry,
  index,
  selectedId,
  activeIds,
  insets,
  view,
  reducedMotion,
  compact,
  onViewChange,
  onSelect,
  onSurprise,
  spinFor,
  showLegend,
  locateKey,
}: MapStageProps) {
  const mapRef = useRef<MapHandle>(null);
  const tooltipRef = useRef<TooltipHandle>(null);
  const pinRef = useRef<PinHandle>(null);

  const names = useMemo(() => {
    const out = new Map<string, string>();
    for (const shape of world?.shapes ?? []) if (shape.id) out.set(shape.id, shape.name);
    for (const c of index?.sorted ?? []) out.set(c.cca3, c.name);
    return out;
  }, [world, index]);

  const markers = useMemo<MapMarker[]>(() => {
    if (!world || !index) return [];
    const out: MapMarker[] = [];
    for (const c of index.sorted) {
      const focus = world.focus.get(c.cca3);
      if (focus && (c.area ?? Infinity) >= MARKER_AREA_KM2) continue;
      if (focus) out.push({ id: c.cca3, lon: focus.centroid[0], lat: focus.centroid[1] });
      else if (c.latlng) out.push({ id: c.cca3, lon: c.latlng[1], lat: c.latlng[0] });
    }
    return out;
  }, [world, index]);

  const neighborIds = useMemo(() => {
    const borders = selectedId ? index?.byId.get(selectedId)?.borders : undefined;
    return borders?.length ? new Set(borders) : NO_NEIGHBORS;
  }, [index, selectedId]);

  useEffect(() => {
    if (selectedId && world) mapRef.current?.focus(selectedId, { spin: spinFor === selectedId });
  }, [selectedId, view, world, index, locateKey, spinFor]);

  // Closing a profile returns to the world view.
  const previousId = useRef(selectedId);
  useEffect(() => {
    if (previousId.current && !selectedId) mapRef.current?.reset();
    previousId.current = selectedId;
  }, [selectedId]);

  const handleHover = useCallback((info: HoverInfo | null) => tooltipRef.current?.update(info), []);

  const selected = selectedId ? index?.byId.get(selectedId) : undefined;
  const MapView = view === 'globe' ? MemoGlobeView : MemoFlatMap;
  // Controls sit inside the area the floating cards leave uncovered.
  const area = { left: insets.left + 12, right: insets.right + 12, top: insets.top + 12, bottom: insets.bottom + 16 };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <CartoonSky insets={insets} compact={compact} />

      {world ? (
        <MapView
          ref={mapRef}
          key={view}
          world={world}
          markers={markers}
          names={names}
          selectedId={selectedId}
          neighborIds={neighborIds}
          activeIds={activeIds}
          insets={insets}
          reducedMotion={reducedMotion}
          pinRef={pinRef}
          onSelect={onSelect}
          onHover={handleHover}
        />
      ) : (
        <div className="absolute grid place-items-center" style={area}>
          {worldError ? (
            <div className="toon rounded-3xl bg-white px-6 py-5 text-center">
              <p className="text-sm font-bold text-ink">Oops! The world map could not be loaded. 🙈</p>
              <button
                type="button"
                onClick={onRetry}
                className="toon-sm toon-press-sm mt-3 rounded-full bg-sun px-4 py-1.5 text-sm font-extrabold text-ink"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="toon flex items-center gap-2.5 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-ink">
              <Loader2 className="size-4 animate-spin" />
              Painting the world… 🎨
            </div>
          )}
        </div>
      )}

      {selected && <MapPin key={selected.cca3} ref={pinRef} country={selected} />}
      <MapTooltip ref={tooltipRef} byId={index?.byId} />

      {/* View switch, centred over the uncovered area */}
      <div
        className="pointer-events-none absolute z-10 flex justify-center transition-[left,right,top] duration-500"
        style={{ left: area.left, right: area.right, top: area.top }}
      >
        <div className="toon pointer-events-auto flex gap-1 rounded-full bg-white p-1">
          {(
            [
              ['globe', 'Globe', '🌍'],
              ['map', 'Map', '🗺️'],
            ] as const
          ).map(([mode, label, emoji]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => onViewChange(mode)}
              className={clsx(
                'flex items-center gap-1.5 rounded-full border-2 px-4 py-1 font-display text-[14px] font-semibold transition-all duration-300',
                view === mode ? 'border-ink bg-sun text-ink' : 'border-transparent text-slate-500 hover:bg-indigo-50 hover:text-ink',
              )}
            >
              <span aria-hidden className="text-[16px]">
                {emoji}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Surprise + zoom controls */}
      <div
        className="absolute z-10 flex flex-col items-center gap-3 transition-[right,bottom] duration-500"
        style={{ right: area.right, bottom: area.bottom }}
      >
        <button
          type="button"
          onClick={onSurprise}
          disabled={!index}
          title="Surprise me!"
          aria-label="Surprise me: fly to a random country"
          className="toon toon-press group grid size-12 place-items-center rounded-2xl bg-sun text-[24px] disabled:opacity-50"
        >
          <span aria-hidden className="transition-transform duration-500 group-hover:rotate-[360deg]">
            🎲
          </span>
        </button>
        <div className="toon flex flex-col overflow-hidden rounded-2xl bg-white">
          {(
            [
              ['Zoom in', Plus, () => mapRef.current?.zoomIn()],
              ['Zoom out', Minus, () => mapRef.current?.zoomOut()],
              ['Reset view', RotateCcw, () => mapRef.current?.reset()],
            ] as const
          ).map(([label, Icon, action]) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={action}
              className="grid size-10 place-items-center text-ink transition-colors hover:bg-sun active:bg-amber-300 [&:not(:last-child)]:border-b-2 [&:not(:last-child)]:border-ink"
            >
              <Icon className="size-[18px]" strokeWidth={2.8} />
            </button>
          ))}
        </div>
      </div>

      {showLegend && (
        <div
          className="toon pointer-events-none absolute z-10 flex items-center gap-4 rounded-full bg-white px-4 py-1.5 text-[12px] font-bold text-ink"
          style={{ left: area.left, bottom: area.bottom }}
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden>📍</span>
            Selected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-3 w-5 overflow-hidden rounded-full border-2 border-ink">
              <span className="flex-1 bg-[#7ee2a8]" />
              <span className="flex-1 bg-[#ff9f9f]" />
              <span className="flex-1 bg-[#c3b1ff]" />
            </span>
            One colour per country
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-ink bg-[#80e4dc]" />
            Tiny states
          </span>
        </div>
      )}
    </div>
  );
}
