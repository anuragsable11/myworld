import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { Dices, Gamepad2, Globe, Loader2, Map as MapIcon, Minus, Moon, Plane, Plus, RotateCcw, Sun } from 'lucide-react';
import type { CountryIndex } from '../../hooks/queries';
import type { FlightPlan } from '../../lib/flight';
import type { World } from '../../lib/geo';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { ConnectionBadge } from '../layout/ConnectionBadge';
import { CartoonSky } from './CartoonSky';
import { FlatMap } from './FlatMap';
import { GlobeView } from './GlobeView';
import { MapPin } from './MapPin';
import { MapTooltip, type TooltipHandle } from './MapTooltip';
import { SHUFFLE_MS, type FlightPins, type HoverInfo, type Insets, type MapHandle, type MapMarker, type PinHandle } from './types';

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
  showNight: boolean;
  onToggleNight: () => void;
  onViewChange: (view: ViewMode) => void;
  onSelect: (id: string) => void;
  onSurprise: () => void;
  /** Opens the flag quiz. */
  onPlay: () => void;
  /** Opens the flight planner. */
  onFly: () => void;
  /** The flight being shown on the globe, if any, and whether its plane has landed. */
  flight: FlightPlan | null;
  flightLanded: boolean;
  onFlightProgress: (progress: number) => void;
  onFlightLand: () => void;
  /** The country picked by "Surprise me"; the globe takes a few extra turns on the way there. */
  spinFor: string | null;
  showLegend: boolean;
  /** Changing this re-centres the map on the selection ("Show on map"). */
  locateKey: number;
  /** Changing this resets the view (tapping the current view's tab again). */
  resetKey: number;
  /** The map is covered (an open sheet, menu or dialog), so it can stop animating. */
  paused: boolean;
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
  showNight,
  onToggleNight,
  onViewChange,
  onSelect,
  onSurprise,
  onPlay,
  onFly,
  flight,
  flightLanded,
  onFlightProgress,
  onFlightLand,
  spinFor,
  showLegend,
  locateKey,
  resetKey,
  paused,
}: MapStageProps) {
  const mapRef = useRef<MapHandle>(null);
  const tooltipRef = useRef<TooltipHandle>(null);
  const pinRef = useRef<PinHandle>(null);
  const fromPinRef = useRef<PinHandle>(null);
  const toPinRef = useRef<PinHandle>(null);
  const flightPins = useMemo<FlightPins>(() => ({ from: fromPinRef, to: toPinRef }), []);

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

  // A shuffle spins once; later re-focusing (view switch, "Show on map") just flies there.
  const spun = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || !world) return;
    const spin = spinFor === selectedId && spun.current !== spinFor;
    if (spin) spun.current = spinFor;
    mapRef.current?.focus(selectedId, { spin });
  }, [selectedId, view, world, index, locateKey, spinFor]);

  const firstReset = useRef(resetKey);
  useEffect(() => {
    if (resetKey !== firstReset.current) mapRef.current?.reset();
  }, [resetKey]);

  // Closing a profile returns to the world view (unless it closed to make way for a flight, which
  // has the camera to itself), and so does the end of a flight.
  const previousId = useRef(selectedId);
  const previousFlight = useRef(flight);
  useEffect(() => {
    const closed = previousId.current && !selectedId;
    const flightOver = previousFlight.current && !flight;
    if ((closed || flightOver) && !selectedId && !flight) mapRef.current?.reset();
    previousId.current = selectedId;
    previousFlight.current = flight;
  }, [selectedId, flight]);

  const handleHover = useCallback((info: HoverInfo | null) => tooltipRef.current?.update(info), []);

  const selected = selectedId ? index?.byId.get(selectedId) : undefined;
  // Flights are flown on the globe; its two ends get a flag pin each, the second as the plane lands.
  const shownFlight = view === 'globe' ? flight : null;
  const flightFrom = shownFlight ? index?.byId.get(shownFlight.from.id) : undefined;
  const flightTo = shownFlight && flightLanded ? index?.byId.get(shownFlight.to.id) : undefined;
  const MapView = view === 'globe' ? MemoGlobeView : MemoFlatMap;
  // Controls sit inside the area the floating cards leave uncovered.
  const area = { left: insets.left + 12, right: insets.right + 12, top: insets.top + 12, bottom: insets.bottom + 16 };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <CartoonSky insets={insets} compact={compact} paused={paused} />

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
          showNight={showNight}
          paused={paused}
          pinRef={pinRef}
          onSelect={onSelect}
          onHover={handleHover}
          flight={shownFlight}
          flightPins={flightPins}
          onFlightProgress={onFlightProgress}
          onFlightLand={onFlightLand}
        />
      ) : (
        <div className="absolute grid place-items-center" style={area}>
          {worldError ? (
            <div className="glass rounded-[22px] px-6 py-5 text-center">
              <p className="text-[15px] font-medium text-label">The world map could not be loaded.</p>
              <button
                type="button"
                onClick={onRetry}
                className="ios-press mt-3 rounded-full bg-tint px-5 py-2 text-[15px] font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="glass flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[14px] font-medium text-label">
              <Loader2 className="size-4 animate-spin text-secondary" strokeWidth={2.4} />
              Loading the world…
            </div>
          )}
        </div>
      )}

      {selected && (
        <MapPin
          key={selected.cca3}
          ref={pinRef}
          country={selected}
          // After a shuffle the pin waits for the flight to land.
          landingMs={spinFor === selected.cca3 && !reducedMotion ? SHUFFLE_MS[view] - 150 : undefined}
        />
      )}
      {shownFlight && flightFrom && (
        // It drops as the camera arrives over the runway.
        <MapPin key={`from-${shownFlight.key}`} ref={fromPinRef} country={flightFrom} landingMs={reducedMotion ? 0 : 650} />
      )}
      {shownFlight && flightTo && <MapPin key={`to-${shownFlight.key}`} ref={toPinRef} country={flightTo} landingMs={0} />}
      <MapTooltip ref={tooltipRef} byId={index?.byId} />

      {/* View switch, centred over the uncovered area */}
      <div
        className="pointer-events-none absolute z-10 flex flex-col items-center gap-2.5 transition-[left,right,top] duration-500"
        style={{ left: area.left, right: area.right, top: area.top }}
      >
        {/* Phones switch views from the tab bar. */}
        {!compact && (
          // An iOS segmented control on glass: the white thumb slides to the view that is showing.
          <div className="glass pointer-events-auto relative grid grid-cols-2 rounded-full p-1">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.06)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ transform: view === 'map' ? 'translateX(100%)' : undefined }}
            />
            {(
              [
                ['globe', 'Globe', Globe],
                ['map', 'Map', MapIcon],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => onViewChange(mode)}
                className={clsx(
                  'relative flex items-center justify-center gap-1.5 rounded-full px-5 py-1.5 text-[14px] font-semibold transition-colors duration-300',
                  view === mode ? 'text-label' : 'text-secondary hover:text-label',
                )}
              >
                <Icon aria-hidden className="size-4" strokeWidth={2.3} />
                {label}
              </button>
            ))}
          </div>
        )}
        <ConnectionBadge />
      </div>

      {/* Map controls in two glass groups, as in Apple Maps; phones have the tab bar, and pinch to zoom */}
      {!compact && (
        <div
          className="absolute z-10 flex flex-col items-center gap-3 transition-[right,bottom] duration-500"
          style={{ right: area.right, bottom: area.bottom }}
        >
          <div className="glass flex flex-col overflow-hidden rounded-[18px]">
            <ControlButton
              label="Play the flag quiz"
              title="Flag quiz"
              onClick={() => {
                sounds.tap();
                haptics.tap();
                onPlay();
              }}
              disabled={!index}
            >
              <Gamepad2 className="size-[21px]" strokeWidth={2} />
            </ControlButton>
            <ControlButton
              label="Live day and night"
              title={showNight ? 'Hide live day & night' : 'Show live day & night'}
              pressed={showNight}
              onClick={onToggleNight}
            >
              {showNight ? <Moon className="size-[20px]" strokeWidth={2} /> : <Sun className="size-[21px]" strokeWidth={2} />}
            </ControlButton>
            <ControlButton label="Surprise me: fly to a random country" title="Surprise me" onClick={onSurprise} disabled={!index}>
              <Dices className="size-[21px]" strokeWidth={2} />
            </ControlButton>
            <ControlButton
              label="Flight path: fly a plane between two countries"
              title="Flight path"
              pressed={!!flight}
              // The planner makes its own sound as it slides open.
              onClick={() => {
                haptics.tap();
                onFly();
              }}
              disabled={!index}
            >
              <Plane className="size-[20px]" strokeWidth={2} />
            </ControlButton>
          </div>
          <div className="glass flex flex-col overflow-hidden rounded-[18px]">
            <ControlButton
              label="Zoom in"
              onClick={() => {
                sounds.zoom('in');
                haptics.tap();
                mapRef.current?.zoomIn();
              }}
            >
              <Plus className="size-[21px]" strokeWidth={2.2} />
            </ControlButton>
            <ControlButton
              label="Zoom out"
              onClick={() => {
                sounds.zoom('out');
                haptics.tap();
                mapRef.current?.zoomOut();
              }}
            >
              <Minus className="size-[21px]" strokeWidth={2.2} />
            </ControlButton>
            <ControlButton
              label="Reset view"
              onClick={() => {
                sounds.zoom('out');
                haptics.tap();
                mapRef.current?.reset();
              }}
            >
              <RotateCcw className="size-[19px]" strokeWidth={2.2} />
            </ControlButton>
          </div>
        </div>
      )}

      {showLegend && (
        <div
          className="glass pointer-events-none absolute z-10 flex items-center gap-4 rounded-full px-4 py-2 text-[12px] font-medium text-secondary"
          style={{ left: area.left, bottom: area.bottom }}
        >
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sun shadow-[0_0_0_0.5px_rgb(0_0_0/0.2)]" />
            Selected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-2.5 w-5 overflow-hidden rounded-full shadow-[0_0_0_0.5px_rgb(0_0_0/0.2)]">
              <span className="flex-1 bg-[#7ee2a8]" />
              <span className="flex-1 bg-[#ff9f9f]" />
              <span className="flex-1 bg-[#c3b1ff]" />
            </span>
            One colour per country
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#80e4dc] shadow-[0_0_0_0.5px_rgb(0_0_0/0.2)]" />
            Tiny states
          </span>
          {showNight && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full bg-[linear-gradient(90deg,#ffffff_0%,#ffffff_45%,#5b55a0_55%,#5b55a0_100%)] shadow-[0_0_0_0.5px_rgb(0_0_0/0.2)]" />
              Live night
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** One button in a glass group of map controls; hairlines separate the buttons. */
function ControlButton({
  label,
  title,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? label}
      className={clsx(
        'grid size-11 place-items-center transition-colors hover:bg-control active:bg-control-strong disabled:opacity-40 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hairline',
        pressed ? 'text-tint' : 'text-label',
      )}
    >
      {children}
    </button>
  );
}
