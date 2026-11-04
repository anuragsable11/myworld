import type { ReactNode } from 'react';
import type { Pattern } from '../../../data/costumes';

/** Pupils, brows on covered heads, cords and tassels. */
export const DARK = '#2b2340';
/** Seams, folds and pleats. */
export const DETAIL = 'rgba(30, 20, 60, 0.2)';
/** The flat shade laid over the right side of each shape, as if lit from the top left. */
export const SHADE = 'rgba(30, 20, 60, 0.14)';

export function mix(hex: string, target: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(target);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
export const darker = (hex: string, t = 0.2) => mix(hex, '#000000', t);
export const lighter = (hex: string, t = 0.3) => mix(hex, '#ffffff', t);

function PatternDef({ id, kind, base, accent }: { id: string; kind: Pattern; base: string; accent: string }) {
  const bg = <rect width="40" height="40" fill={base} />;
  const common = { id, patternUnits: 'userSpaceOnUse' as const };
  switch (kind) {
    case 'stripes':
      return (
        <pattern {...common} width="9" height="9" patternTransform="rotate(35)">
          {bg}
          <rect width="3.6" height="9" fill={accent} />
        </pattern>
      );
    case 'bands':
      return (
        <pattern {...common} width="9" height="7.5">
          {bg}
          <rect y="3.6" width="9" height="3" fill={accent} />
        </pattern>
      );
    case 'plaid':
      return (
        <pattern {...common} width="14" height="14">
          {bg}
          <rect y="4.5" width="14" height="4.5" fill={accent} opacity="0.55" />
          <rect x="4.5" width="4.5" height="14" fill={accent} opacity="0.55" />
          <path d="M0 11.8 H14 M11.8 0 V14" stroke={DARK} strokeWidth="0.7" opacity="0.35" />
        </pattern>
      );
    case 'dots':
      return (
        <pattern {...common} width="8" height="8">
          {bg}
          <circle cx="4" cy="4" r="1.6" fill={accent} />
        </pattern>
      );
    case 'zigzag':
      return (
        <pattern {...common} width="10" height="7.5">
          {bg}
          <path d="M0 5.4 L2.5 2.1 L5 5.4 L7.5 2.1 L10 5.4" fill="none" stroke={accent} strokeWidth="1.5" />
        </pattern>
      );
    case 'floral':
      return (
        <pattern {...common} width="12" height="12">
          {bg}
          <g fill={accent}>
            <circle cx="6" cy="3.8" r="1.5" />
            <circle cx="8.2" cy="6" r="1.5" />
            <circle cx="6" cy="8.2" r="1.5" />
            <circle cx="3.8" cy="6" r="1.5" />
          </g>
          <circle cx="6" cy="6" r="1.1" fill="#ffd23f" />
        </pattern>
      );
    case 'batik':
      return (
        <pattern {...common} width="12" height="12">
          {bg}
          <path d="M1.7 6 a2.6 2.6 0 1 1 5.2 0 a2.6 2.6 0 1 1 -5.2 0 M8.2 1.7 q2.6 2.2 0 4.7 M8.2 7.3 q2.6 2.2 0 4.3" fill="none" stroke={accent} strokeWidth="1.1" />
        </pattern>
      );
    case 'kente':
      return (
        <pattern {...common} width="14" height="14">
          <rect width="7" height="7" fill="#ffd23f" />
          <rect x="7" width="7" height="7" fill="#2e7d32" />
          <rect y="7" width="7" height="7" fill="#c0392b" />
          <rect x="7" y="7" width="7" height="7" fill="#ffd23f" />
          <path d="M0 3.5 H14 M0 10.5 H14" stroke={DARK} strokeWidth="0.9" opacity="0.7" />
        </pattern>
      );
    case 'embroidery':
      return (
        <pattern {...common} width="8.5" height="8.5">
          {bg}
          <path d="M2.5 2.5 L6 6 M6 2.5 L2.5 6" stroke={accent} strokeWidth="1.2" />
        </pattern>
      );
  }
}

/** Collects the <defs> a figure needs while it is drawn. Make a new one on every render. */
export interface Painter {
  defs: ReactNode[];
  /** A garment fill: the plain colour, or a pattern of that colour with an accent. */
  fill(color: string, pattern?: Pattern, accent?: string): string;
  /** A shape, or several overlapping ones, with the flat shade over its right side. */
  piece(key: string, d: string | string[], fill: string, props?: { fillRule?: 'evenodd' }): ReactNode;
  /** Registers a clip path and returns a url() reference to it. */
  clip(d: string): string;
}

export function createPainter(uid: string, defaultAccent: string): Painter {
  const defs: ReactNode[] = [];
  const shade = `${uid}shade`;
  defs.push(
    <clipPath key={shade} id={shade}>
      <path d="M68 -60 C66 40 70 140 67 260 H220 V-60 Z" />
    </clipPath>,
  );
  const next = () => `${uid}d${defs.length}`;
  return {
    defs,
    fill(color, pattern, accent) {
      if (!pattern) return color;
      const id = next();
      defs.push(<PatternDef key={id} id={id} kind={pattern} base={color} accent={accent ?? defaultAccent} />);
      return `url(#${id})`;
    },
    piece(key, d, fill, props) {
      if (Array.isArray(d)) {
        // Shade the shapes as one, so the overlaps don't come out darker.
        return (
          <g key={key} fillRule={props?.fillRule}>
            {d.map((x) => (
              <path key={x} d={x} fill={fill} />
            ))}
            <g clipPath={`url(#${shade})`} opacity="0.14">
              {d.map((x) => (
                <path key={x} d={x} fill="#1e143c" />
              ))}
            </g>
          </g>
        );
      }
      return (
        <g key={key} fillRule={props?.fillRule}>
          <path d={d} fill={fill} />
          <path d={d} fill={SHADE} clipPath={`url(#${shade})`} />
        </g>
      );
    },
    clip(d) {
      const id = next();
      defs.push(
        <clipPath key={id} id={id}>
          <path d={d} />
        </clipPath>,
      );
      return `url(#${id})`;
    },
  };
}
