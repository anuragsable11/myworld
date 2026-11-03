import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { Globe2, Loader2, Map as MapIcon, Minus, Plus, RotateCcw } from 'lucide-react';
import type { CountryIndex } from '../../hooks/queries';
import type { World } from '../../lib/geo';
import { FlatMap } from './FlatMap';
import { GlobeView } from './GlobeView';
import { MapTooltip, type TooltipHandle } from './MapTooltip';
import type { HoverInfo, MapHandle, MapMarker } from './types';

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
  insets: { right: number; bottom: number };
  view: ViewMode;
  reducedMotion: boolean;
  onViewChange: (view: ViewMode) => void;
  onSelect: (id: string) => void;
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
  onViewChange,
  onSelect,
  showLegend,
  locateKey,
}: MapStageProps) {
  const mapRef = useRef<MapHandle>(null);
  const tooltipRef = useRef<TooltipHandle>(null);

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
    if (selectedId && world) mapRef.current?.focus(selectedId);
  }, [selectedId, view, world, index, locateKey]);

  // Closing a profile returns to the world view.
  const previousId = useRef(selectedId);
  useEffect(() => {
    if (previousId.current && !selectedId) mapRef.current?.reset();
    previousId.current = selectedId;
  }, [selectedId]);

  const handleHover = useCallback((info: HoverInfo | null) => tooltipRef.current?.update(info), []);

  const MapView = view === 'globe' ? MemoGlobeView : MemoFlatMap;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#0d1422_0%,#06090f_70%)]">
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
          onSelect={onSelect}
          onHover={handleHover}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          {worldError ? (
            <div className="text-center">
              <p className="text-sm text-mist-300">The world map could not be loaded.</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-mist-100 hover:bg-white/5"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-sm text-mist-400">
              <Loader2 className="size-4 animate-spin text-brass-400" />
              Drawing the world…
            </div>
          )}
        </div>
      )}

      <MapTooltip ref={tooltipRef} byId={index?.byId} />

      {/* View switch */}
      <div className="absolute left-3 top-3 z-10 flex rounded-xl border border-white/[0.08] bg-ink-900/80 p-1 shadow-lg shadow-black/30 backdrop-blur-md">
        {(
          [
            ['map', 'Map', MapIcon],
            ['globe', 'Globe', Globe2],
          ] as const
        ).map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={view === mode}
            onClick={() => onViewChange(mode)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
              view === mode ? 'bg-brass-400/15 text-brass-200' : 'text-mist-400 hover:text-mist-100',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Zoom controls */}
      <div
        className="absolute bottom-4 z-10 flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900/80 shadow-lg shadow-black/30 backdrop-blur-md transition-[right,bottom] duration-300"
        style={{ right: insets.right + 12, bottom: insets.bottom + 16 }}
      >
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
            className="grid size-9 place-items-center text-mist-300 transition-colors hover:bg-white/[0.06] hover:text-mist-50 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-white/[0.06]"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      {showLegend && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-ink-900/70 px-3 py-2 text-[11.5px] text-mist-400 backdrop-blur-md">
          <LegendSwatch className="bg-brass-400">Selected</LegendSwatch>
          <LegendSwatch className="bg-[#3a3426]">Neighbours</LegendSwatch>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-mist-400 bg-ink-950" />
            Small states
          </span>
        </div>
      )}
    </div>
  );
}

function LegendSwatch({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx('h-2 w-3 rounded-[2px]', className)} />
      {children}
    </span>
  );
}
