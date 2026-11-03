import type { World } from '../../lib/geo';

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

export interface MapViewProps {
  world: World;
  markers: MapMarker[];
  names: Map<string, string>;
  selectedId: string | null;
  neighborIds: Set<string>;
  /** When set, countries outside this set are dimmed (region filter). */
  activeIds: Set<string> | null;
  /** Screen area covered by overlays (floating panel, bottom sheet), in CSS px. */
  insets: { right: number; bottom: number };
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onHover: (info: HoverInfo | null) => void;
}

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  focus: (id: string) => void;
}
