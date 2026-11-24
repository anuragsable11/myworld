import type { RefObject } from 'react';
import type { FlightPlan } from '../../lib/flight';
import type { World } from '../../lib/geo';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface HoverInfo {
  id: string | null;
  name: string;
  /** Pointer position relative to the map container, in CSS px. */
  x: number;
  y: number;
}

/** Countries too small to click (or without a boundary polygon) get a point marker. */
export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
}

/** The selection pin is a DOM overlay; map views move it to the selected country every frame it changes. */
export interface PinHandle {
  move: (x: number, y: number) => void;
  hide: () => void;
  /** Another pin stands too close for both name tags to be read: put this one's away (or bring it back). */
  crowd?: (crowded: boolean) => void;
}

export interface MapViewProps {
  world: World;
  markers: MapMarker[];
  names: Map<string, string>;
  selectedId: string | null;
  neighborIds: Set<string>;
  /** When set, countries outside this set are dimmed (region filter). */
  activeIds: Set<string> | null;
  /** Screen area covered by floating cards and sheets on each side, in CSS px. */
  insets: Insets;
  reducedMotion: boolean;
  /** Shade the night side of the Earth for the current time. */
  showNight: boolean;
  /** Covered by a sheet, menu or dialog: animation can rest until it's uncovered. */
  paused?: boolean;
  pinRef: RefObject<PinHandle | null>;
  onSelect: (id: string) => void;
  onHover: (info: HoverInfo | null) => void;
  /** A flight to show (on the globe only): its two countries light up and a plane flies between them. */
  flight?: FlightPlan | null;
  /** The flag pins standing at the two ends of the flight. */
  flightPins?: FlightPins;
  /** Called on every frame of a flight with how far along the plane is, from 0 to 1. */
  onFlightProgress?: (progress: number) => void;
  /** Called once, as the plane touches down. */
  onFlightLand?: () => void;
}

export interface FlightPins {
  from: RefObject<PinHandle | null>;
  to: RefObject<PinHandle | null>;
}

export interface FocusOptions {
  /** Take an extra turn on the way (used by "Surprise me"). */
  spin?: boolean;
}

/** How long the "Surprise me" flight takes on each view; the profile opens as it lands. */
export const SHUFFLE_MS = { globe: 3000, map: 1700 } as const;

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  focus: (id: string, options?: FocusOptions) => void;
}
