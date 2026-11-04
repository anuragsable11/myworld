import type { RefObject } from 'react';
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
  pinRef: RefObject<PinHandle | null>;
  onSelect: (id: string) => void;
  onHover: (info: HoverInfo | null) => void;
}

export interface FocusOptions {
  /** Take a couple of extra turns on the way (used by "Surprise me"). */
  spin?: boolean;
}

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  focus: (id: string, options?: FocusOptions) => void;
}
