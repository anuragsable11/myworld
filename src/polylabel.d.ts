declare module 'polylabel' {
  /** Pole of inaccessibility: the interior point farthest from the polygon outline. */
  export default function polylabel(
    polygon: number[][][],
    precision?: number,
    debug?: boolean,
  ): [number, number] & { distance: number };
}
