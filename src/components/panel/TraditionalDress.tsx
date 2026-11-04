import { useId, type ReactNode } from 'react';
import type { Country } from '../../types';
import { costumeFor, type HeadwearKind, type Outfit, type OverlayKind, type Pattern } from '../../data/costumes';

/**
 * Original characters in a flat, chunky style: big heads, big eyes, open smiles, short rounded
 * bodies, no outlines, and a single flat shade on one side of each garment.
 *
 * Garments, overlays and headwear are drawn in a "garment space" and placed onto the character
 * with two transforms: BODY_T squashes the garments into a short, wide body, and HEAD_T fits hats
 * to the big head. Face, hair, neck and arms are drawn directly in the final 120×220 space.
 */

const DARK = '#2b2340';
const DETAIL = 'rgba(30, 20, 60, 0.22)';
const SHADE = 'rgba(30, 20, 60, 0.14)';
const BODY_T = 'translate(60 92) scale(1.17 0.793) translate(-60 -78)';
const HEAD_T = 'translate(60 53) scale(1.47 1.55) translate(-60 -46)';
// Undo each transform's stretch on pattern tiles so dots stay round.
const PATTERN_T = { body: 'scale(0.855 1.261)', head: 'scale(0.68 0.645)' } as const;

/** Headwear that covers the hair entirely. */
const HIDES_HAIR = new Set<HeadwearKind>(['headscarf', 'ghutra', 'hood', 'turban', 'headwrap', 'gele']);

function mix(hex: string, target: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(target);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const darker = (hex: string, t = 0.2) => mix(hex, '#000000', t);
const lighter = (hex: string, t = 0.3) => mix(hex, '#ffffff', t);

function PatternDef({
  id,
  kind,
  base,
  accent,
  transform,
}: {
  id: string;
  kind: Pattern;
  base: string;
  accent: string;
  transform: string;
}) {
  const bg = <rect width="40" height="40" fill={base} />;
  const common = { id, patternUnits: 'userSpaceOnUse' as const };
  switch (kind) {
    case 'stripes':
      return (
        <pattern {...common} width="10" height="10" patternTransform={`${transform} rotate(35)`}>
          {bg}
          <rect width="4" height="10" fill={accent} />
        </pattern>
      );
    case 'plaid':
      return (
        <pattern {...common} width="16" height="16" patternTransform={transform}>
          {bg}
          <rect y="5" width="16" height="5" fill={accent} opacity="0.55" />
          <rect x="5" width="5" height="16" fill={accent} opacity="0.55" />
          <path d="M0 13.5 H16 M13.5 0 V16" stroke={DARK} strokeWidth="0.8" opacity="0.35" />
        </pattern>
      );
    case 'dots':
      return (
        <pattern {...common} width="9" height="9" patternTransform={transform}>
          {bg}
          <circle cx="4.5" cy="4.5" r="1.9" fill={accent} />
        </pattern>
      );
    case 'zigzag':
      return (
        <pattern {...common} width="12" height="9" patternTransform={transform}>
          {bg}
          <path d="M0 6.5 L3 2.5 L6 6.5 L9 2.5 L12 6.5" fill="none" stroke={accent} strokeWidth="1.7" />
        </pattern>
      );
    case 'floral':
      return (
        <pattern {...common} width="14" height="14" patternTransform={transform}>
          {bg}
          <g fill={accent}>
            <circle cx="7" cy="4.4" r="1.7" />
            <circle cx="9.6" cy="7" r="1.7" />
            <circle cx="7" cy="9.6" r="1.7" />
            <circle cx="4.4" cy="7" r="1.7" />
          </g>
          <circle cx="7" cy="7" r="1.3" fill="#ffd23f" />
        </pattern>
      );
    case 'batik':
      return (
        <pattern {...common} width="14" height="14" patternTransform={transform}>
          {bg}
          <path d="M2 7 a3 3 0 1 1 6 0 a3 3 0 1 1 -6 0 M9.5 2 q3 2.5 0 5.5 M9.5 8.5 q3 2.5 0 5" fill="none" stroke={accent} strokeWidth="1.3" />
        </pattern>
      );
    case 'kente':
      return (
        <pattern {...common} width="16" height="16" patternTransform={transform}>
          <rect width="8" height="8" fill="#ffd23f" />
          <rect x="8" width="8" height="8" fill="#2e7d32" />
          <rect y="8" width="8" height="8" fill="#c0392b" />
          <rect x="8" y="8" width="8" height="8" fill="#ffd23f" />
          <path d="M0 4 H16 M0 12 H16" stroke={DARK} strokeWidth="1" opacity="0.7" />
        </pattern>
      );
    case 'embroidery':
      return (
        <pattern {...common} width="10" height="10" patternTransform={transform}>
          {bg}
          <path d="M3 3 L7 7 M7 3 L3 7" stroke={accent} strokeWidth="1.4" />
        </pattern>
      );
  }
}

interface FigureProps {
  outfit: Outfit;
  skin: string;
  hairColor: string;
  female: boolean;
  /** Which arm waves: the man waves his right, the woman her left, so the pair face each other. */
  wave: 'left' | 'right';
}

function Figure({ outfit: o, skin, hairColor, female, wave }: FigureProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clip = `${uid}c`;
  const defs: ReactNode[] = [
    <clipPath key="clip" id={clip}>
      <rect x="66" y="-40" width="90" height="320" />
    </clipPath>,
  ];
  const paint = (base: string, pattern?: Pattern, accent?: string, space: 'body' | 'head' = 'body') => {
    if (!pattern) return base;
    const id = `${uid}p${defs.length}`;
    defs.push(
      <PatternDef key={id} id={id} kind={pattern} base={base} accent={accent ?? o.accent ?? '#ffd23f'} transform={PATTERN_T[space]} />,
    );
    return `url(#${id})`;
  };
  /** A garment piece with a flat shade on its right side. */
  const piece = (key: string, d: string, fill: string) => (
    <g key={key}>
      <path d={d} fill={fill} />
      <path d={d} fill={SHADE} clipPath={`url(#${clip})`} />
    </g>
  );

  const top = o.top;
  const bottom = o.bottom ?? o.top;
  const accent = o.accent ?? '#ffd23f';
  const overlays = o.overlays ?? [];
  const hw = o.headwear;
  const jacket = overlays.find((x) => x.kind === 'jacket');
  const sleeve = jacket?.color ?? top;
  const hideHair = hw && HIDES_HAIR.has(hw.kind);
  const hair = o.hair ?? 'short';
  const skinShade = darker(skin, 0.14);
  const hairLight = lighter(hairColor, 0.28);

  const back: ReactNode[] = []; // behind everything (final space)
  const headBack: ReactNode[] = []; // behind the head (head space)
  const body: ReactNode[] = []; // garments (garment space)
  const bodyOver: ReactNode[] = []; // drapes over the arms (garment space)
  const headFront: ReactNode[] = []; // hats (head space)

  // ---------------------------------------------------------------- hair & headwear behind the head
  if (!hideHair && hair === 'long') {
    back.push(<path key="hair-back" d="M27 54 Q24 15 60 14 Q96 15 93 54 L97 120 Q60 130 23 120 Z" fill={hairColor} />);
  }
  if (!hideHair && hair === 'braid') {
    back.push(
      <g key="braid" fill={hairColor}>
        {[78, 92, 106, 119].map((y, i) => (
          <ellipse key={y} cx={88 + i * 1.3} cy={y} rx="7" ry="8.5" />
        ))}
        <circle cx="93" cy="130" r="4" fill={accent} />
      </g>,
    );
  }
  if (hw?.kind === 'headscarf') {
    headBack.push(<path key="scarf" d="M37 50 Q35 21 60 20 Q85 21 83 50 Q85 78 72 90 L60 94 L48 90 Q35 78 37 50 Z" fill={paint(hw.color, hw.pattern, hw.accent, 'head')} />);
  }
  if (hw?.kind === 'ghutra') {
    headBack.push(<path key="ghutra" d="M38 44 Q38 22 60 20 Q82 22 82 44 L91 90 L74 86 L70 58 L50 58 L46 86 L29 90 Z" fill={paint(hw.color, hw.pattern, hw.accent, 'head')} />);
  }
  if (hw?.kind === 'hood') headBack.push(<ellipse key="hood" cx="60" cy="48" rx="27" ry="29" fill={darker(hw.color, 0.1)} />);
  if (hw?.kind === 'veil') headBack.push(<path key="veil" d="M40 34 Q60 22 80 34 L90 112 L30 112 Z" fill={hw.color} opacity="0.92" />);
  if (hw?.kind === 'flower-crown') {
    headBack.push(
      <g key="ribbons" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M76 34 L82 76" stroke="#ff6b81" />
        <path d="M79 32 L88 72" stroke="#2e86de" />
        <path d="M73 36 L76 80" stroke="#ffd23f" />
      </g>,
    );
  }

  // ---------------------------------------------------------------- body (garment space)
  const shoes = o.shoes ?? '#4b4370';
  body.push(
    <g key="shoes" fill={shoes}>
      <ellipse cx="47" cy="199" rx="11" ry="6" />
      <ellipse cx="73" cy="199" rx="11" ry="6" />
    </g>,
  );
  const pants = (
    <g key="pants">
      {piece('pl', 'M37 120 H59 L57 196 H43 Z', bottom)}
      {piece('pr', 'M61 120 H83 L77 196 H63 Z', bottom)}
    </g>
  );
  const stockings = (
    <g key="legs" fill={o.legs ?? skin}>
      <path d="M44 154 H56 V196 H44 Z" />
      <path d="M64 154 H76 V196 H64 Z" />
    </g>
  );
  const torso = piece('torso', 'M42 77 Q60 73 78 77 Q85 78 85 86 L84 124 L36 124 L35 86 Q35 78 42 77 Z', paint(top, o.topPattern));

  switch (o.body) {
    case 'shirt-pants':
      body.push(pants, torso);
      break;
    case 'tunic-pants':
      body.push(pants, piece('tunic', 'M42 77 Q60 73 78 77 Q85 78 85 86 L89 160 Q60 166 31 160 L35 86 Q35 78 42 77 Z', paint(top, o.pattern ?? o.topPattern)));
      break;
    case 'robe':
      body.push(
        piece('robe', 'M42 77 Q60 73 78 77 Q85 78 85 86 L91 199 Q60 205 29 199 L35 86 Q35 78 42 77 Z', paint(top, o.pattern)),
        <path key="robe-line" d="M60 84 V201" stroke={DETAIL} strokeWidth="2" />,
      );
      break;
    case 'dress': {
      const f = o.flare ?? 0.5;
      body.push(
        piece('skirt', `M39 116 H81 L${81 + 16 * f} 199 Q60 206 ${39 - 16 * f} 199 Z`, paint(bottom, o.pattern)),
        piece('dress-top', 'M42 77 Q60 73 78 77 Q84 78 84 86 L81 120 L39 120 L36 86 Q36 78 42 77 Z', paint(top, o.topPattern)),
      );
      break;
    }
    case 'wrap':
      body.push(
        piece('wrap', 'M37 118 H83 L85 199 Q60 203 35 199 Z', paint(bottom, o.pattern)),
        <path key="wrap-fold" d="M53 120 L49 198" stroke={DETAIL} strokeWidth="2" />,
        torso,
      );
      break;
    case 'kilt':
      body.push(stockings, piece('kilt', 'M37 118 H83 L86 158 Q60 162 34 158 Z', paint(bottom, o.pattern)), torso);
      break;
    case 'pleated':
      body.push(
        stockings,
        piece('fustanella', 'M37 118 H83 L93 162 Q60 168 27 162 Z', paint(bottom, o.pattern)),
        <path key="pleats" d="M46 120 L38 162 M53 120 L49 164 M60 120 V165 M67 120 L71 164 M74 120 L82 162" stroke={DETAIL} strokeWidth="1.6" />,
        torso,
      );
      break;
    case 'parka':
      body.push(
        pants,
        piece('parka', 'M35 80 Q60 66 85 80 L92 178 Q60 186 28 178 Z', top),
        <path key="quilt" d="M31 112 Q60 118 89 112 M30 144 Q60 150 90 144 M60 82 V180" stroke={DETAIL} strokeWidth="2" fill="none" />,
      );
      break;
  }

  // Decorated hem along the bottom edge of the garment
  if (o.hem) {
    const edges: Partial<Record<typeof o.body, [number, number, number, number, number, number]>> = {
      robe: [40 - (11 * 106) / 121, 29, 80 + (11 * 106) / 121, 91, 184, 199],
      'tunic-pants': [40 - (9 * 70) / 82, 31, 80 + (9 * 70) / 82, 89, 148, 160],
      wrap: [35.4, 35, 84.6, 85, 184, 199],
    };
    const f = o.flare ?? 0.5;
    if (o.body === 'dress') edges.dress = [39 - (16 * f * 68) / 83, 39 - 16 * f, 81 + (16 * f * 68) / 83, 81 + 16 * f, 184, 199];
    const e = edges[o.body];
    if (e) {
      const [xl0, xl1, xr0, xr1, y0, y1] = e;
      body.push(piece('hem', `M${xl0} ${y0} L${xr0} ${y0} L${xr1} ${y1} Q60 ${y1 + 6} ${xl1} ${y1} Z`, paint(o.hem.color, o.hem.pattern, o.hem.accent)));
    }
  }

  const drawOverlay = (kind: OverlayKind, color: string, pattern?: Pattern, accentColor?: string): ReactNode => {
    const fill = paint(color, pattern, accentColor);
    switch (kind) {
      case 'pallu':
        return (
          <>
            {piece('pallu', 'M85 128 L52 76 L41 81 L76 136 Z', fill)}
            <path d="M83 124 L50 74" stroke={accentColor ?? accent} strokeWidth="3" />
          </>
        );
      case 'dupatta':
        return (
          <g fill={fill}>
            <path d="M40 82 Q60 96 80 82 L82 90 Q60 104 38 90 Z" />
            <path d="M40 86 L33 148 L43 148 L46 92 Z" />
            {piece('dupatta-r', 'M80 86 L87 148 L77 148 L74 92 Z', fill)}
          </g>
        );
      case 'obi':
        return (
          <>
            {piece('obi', 'M36 104 Q36 102 38 102 H82 Q84 102 84 104 V117 Q84 119 82 119 H38 Q36 119 36 117 Z', fill)}
            <path d="M36 111 H84" stroke={accent} strokeWidth="2.2" />
          </>
        );
      case 'bow':
        return <path d="M84 103 L99 94 L97 126 L84 117 Z" fill={darker(color, 0.06)} />;
      case 'sash':
        return (
          <g fill={fill}>
            <rect x="35" y="112" width="50" height="9" rx="2" />
            <path d="M77 120 L81 148 L88 146 L84 120 Z" fill={darker(color, 0.1)} />
          </g>
        );
      case 'vest':
        return (
          <g fill={fill}>
            <path d="M42 77 L53 76 L55 124 L36 124 L35 86 Q35 79 42 77 Z" />
            <path d="M78 77 L67 76 L65 124 L84 124 L85 86 Q85 79 78 77 Z" fill={darker(color, 0.12)} />
          </g>
        );
      case 'jacket':
        return (
          <g fill={fill}>
            <path d="M41 78 L54 76 L56 134 L34 134 L34 87 Q34 80 41 78 Z" />
            <path d="M79 78 L66 76 L64 134 L86 134 L86 87 Q86 80 79 78 Z" fill={darker(color, 0.12)} />
          </g>
        );
      case 'poncho':
        return (
          <>
            {piece('poncho', 'M28 86 Q60 70 92 86 L100 138 Q60 152 20 138 Z', fill)}
            <path d="M51 78 Q60 86 69 78" fill="none" stroke={DETAIL} strokeWidth="2" />
          </>
        );
      case 'apron':
        return piece('apron', 'M47 122 H73 L76 182 Q60 186 44 182 Z', fill);
      case 'bodice':
        return (
          <>
            {piece('bodice', 'M43 92 H77 L79 121 H41 Z', fill)}
            <path d="M56 96 L64 100 L56 104 L64 108 L56 112 L64 116" stroke={accentColor ?? accent} strokeWidth="1.8" fill="none" />
          </>
        );
      case 'blanket':
        return (
          <>
            {piece('blanket', 'M30 82 Q60 68 90 82 L96 172 Q60 180 24 172 Z', fill)}
            <path d="M60 84 V176" stroke={DETAIL} strokeWidth="2.4" />
          </>
        );
      case 'shawl':
        return piece('shawl', 'M35 82 Q60 72 85 82 L91 116 Q60 128 29 116 Z', fill);
      case 'collar':
        return (
          <>
            <rect x="51" y="72" width="18" height="9" rx="2" fill={fill} />
            <path d="M60 82 Q72 88 78 104" stroke={fill} strokeWidth="2.5" fill="none" />
            <g fill={fill}>
              <circle cx="66" cy="87" r="2.2" />
              <circle cx="72" cy="94" r="2.2" />
              <circle cx="76" cy="102" r="2.2" />
            </g>
          </>
        );
      case 'vcollar':
        return <path d="M49 76 L60 101 L71 76 L66 76 L60 91 L54 76 Z" fill={fill} />;
      case 'ribbon':
        return (
          <g fill={fill}>
            <path d="M59 94 L53 134 L60 130 Z" />
            <path d="M62 94 L69 138 L63 135 Z" />
            <circle cx="61" cy="94" r="4.5" />
          </g>
        );
      case 'gazyri':
        return (
          <g fill={fill}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <rect x="43" y={86 + i * 6} width="9" height="4" rx="1.5" />
                <rect x="68" y={86 + i * 6} width="9" height="4" rx="1.5" />
              </g>
            ))}
          </g>
        );
    }
  };
  const under: OverlayKind[] = ['obi', 'bow', 'sash', 'vest', 'jacket', 'apron', 'bodice', 'collar', 'vcollar', 'ribbon', 'gazyri'];
  overlays.forEach((ov, i) => {
    const el = <g key={`ov-${i}`}>{drawOverlay(ov.kind, ov.color, ov.pattern, ov.accent)}</g>;
    (under.includes(ov.kind) ? body : bodyOver).push(el);
  });

  // ---------------------------------------------------------------- headwear in front (head space)
  if (hw) {
    const fill = paint(hw.color, hw.pattern, hw.accent, 'head');
    const hwAccent = hw.accent ?? '#e63946';
    const brim = darker(hw.color, 0.12);
    switch (hw.kind) {
      case 'kufi':
        headFront.push(<path key="hw" d="M42 37 Q42 18 60 18 Q78 18 78 37 Q60 32 42 37 Z" fill={fill} />);
        break;
      case 'fez':
        headFront.push(
          <g key="hw">
            <path d="M47 33 L50 13 H70 L73 33 Q60 36 47 33 Z" fill={fill} />
            <path d="M70 14 Q79 18 77 30" stroke={DARK} strokeWidth="1.6" fill="none" />
            <circle cx="77" cy="31" r="2.4" fill={DARK} />
          </g>,
        );
        break;
      case 'ghutra':
        headFront.push(
          <g key="hw">
            <path d="M40 42 Q41 25 60 24 Q79 25 80 42 Q60 35 40 42 Z" fill={fill} />
            <ellipse cx="60" cy="29" rx="19" ry="4.5" fill="none" stroke={DARK} strokeWidth="3" />
          </g>,
        );
        break;
      case 'headscarf':
        headFront.push(<path key="hw" d="M40 44 Q41 25 60 25 Q79 25 80 44 Q70 35 60 35 Q50 35 40 44 Z" fill={fill} />);
        break;
      case 'gele':
        headFront.push(
          <g key="hw">
            <path d="M35 38 Q32 6 58 9 Q88 0 89 32 Q74 23 60 29 Q46 23 35 38 Z" fill={fill} />
            <path d="M47 14 Q60 25 77 9 M41 25 Q56 31 72 20" stroke={DETAIL} strokeWidth="1.6" fill="none" />
          </g>,
        );
        break;
      case 'turban':
      case 'headwrap':
        headFront.push(
          <g key="hw">
            <path d="M39 40 Q36 13 60 12 Q84 13 81 40 Q72 31 60 32 Q48 31 39 40 Z" fill={fill} />
            <path d="M42 31 Q60 18 78 31 M44 23 Q60 31 76 21" stroke={DETAIL} strokeWidth="1.5" fill="none" />
            {hw.kind === 'headwrap' && <path d="M55 15 Q60 2 70 9 Q65 15 60 16 Z" fill={brim} />}
          </g>,
        );
        break;
      case 'sombrero':
        headFront.push(
          <g key="hw">
            <ellipse cx="60" cy="31" rx="41" ry="8.5" fill={brim} />
            <path d="M46 31 Q47 5 60 5 Q73 5 74 31 Z" fill={fill} />
            <path d="M47 25 H73" stroke={hwAccent} strokeWidth="3.5" />
          </g>,
        );
        break;
      case 'chullo':
        headFront.push(
          <g key="hw">
            <path d="M41 42 Q42 16 60 16 Q78 16 79 42 Z" fill={fill} />
            <path d="M41 40 L38 64 L46 62 L47 42 Z M79 40 L82 64 L74 62 L73 42 Z" fill={fill} />
            <path d="M43 30 H77 M42 36 H78" stroke={hwAccent} strokeWidth="3" />
            <circle cx="60" cy="14" r="5" fill={hwAccent} />
          </g>,
        );
        break;
      case 'bowler':
        headFront.push(
          <g key="hw">
            <ellipse cx="60" cy="27" rx="16" ry="3.6" fill={brim} />
            <path d="M49 27 Q49 11 60 11 Q71 11 71 27 Z" fill={fill} />
          </g>,
        );
        break;
      case 'beret':
        headFront.push(
          <g key="hw">
            <ellipse cx="57" cy="27" rx="22" ry="8" fill={fill} transform="rotate(-8 57 27)" />
            <circle cx="57" cy="19" r="2.3" fill={brim} />
          </g>,
        );
        break;
      case 'conical':
        headFront.push(
          <g key="hw">
            <path d="M20 38 L60 5 L100 38 Q60 47 20 38 Z" fill={fill} />
            <path d="M60 5 L47 42 M60 5 L73 42 M60 5 L34 40 M60 5 L86 40" stroke={DETAIL} strokeWidth="1" />
          </g>,
        );
        break;
      case 'papakha':
        headFront.push(
          <g key="hw">
            <path d="M41 37 V14 Q60 8 79 14 V37 Q60 41 41 37 Z" fill={fill} />
            <path d="M45 18 q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0 M45 27 q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0" stroke={DETAIL} strokeWidth="1.2" fill="none" />
          </g>,
        );
        break;
      case 'tall-cap':
        headFront.push(
          <g key="hw">
            <path d="M44 35 L48 10 Q60 4 72 10 L76 35 Q60 39 44 35 Z" fill={fill} />
            <path d="M50 17 L70 31 M70 17 L50 31" stroke={hwAccent} strokeWidth="1.6" />
          </g>,
        );
        break;
      case 'flower-crown':
        headFront.push(
          <g key="hw">
            {[
              [42, 33],
              [48, 26],
              [56, 22],
              [64, 22],
              [72, 26],
              [78, 33],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4.4" fill={[hw.color, '#ffd23f', '#2e86de', '#ff9f1c', hw.color, '#2ecc71'][i]} />
            ))}
          </g>,
        );
        break;
      case 'kokoshnik':
        headFront.push(
          <g key="hw">
            <path d="M37 41 Q35 5 60 3 Q85 5 83 41 Q72 30 60 30 Q48 30 37 41 Z" fill={fill} />
            <g fill={hwAccent}>
              {[46, 53, 60, 67, 74].map((x) => (
                <circle key={x} cx={x} cy={x === 60 ? 12 : x === 53 || x === 67 ? 14 : 19} r="2.2" />
              ))}
            </g>
          </g>,
        );
        break;
      case 'mokorotlo':
        headFront.push(
          <g key="hw">
            <path d="M28 39 L60 8 L92 39 Q60 47 28 39 Z" fill={fill} />
            <circle cx="60" cy="7" r="4.5" fill={brim} />
            <path d="M39 31 Q60 37 81 31" stroke={DETAIL} strokeWidth="1.6" fill="none" />
          </g>,
        );
        break;
      case 'flower':
        headFront.push(
          <g key="hw" transform="translate(79 30)">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-5" rx="3.6" ry="5.2" fill={hw.color} transform={`rotate(${a})`} />
            ))}
            <circle r="2.6" fill="#ffd23f" />
          </g>,
        );
        break;
      case 'topi':
        headFront.push(<path key="hw" d="M43 33 L45 16 L75 14 L77 31 Q60 35 43 33 Z" fill={fill} />);
        break;
      case 'felt-hat':
        headFront.push(
          <g key="hw">
            <ellipse cx="60" cy="29" rx="25" ry="5.5" fill={brim} />
            <path d="M46 29 Q47 11 60 11 Q73 11 74 29 Z" fill={fill} />
            <path d="M73 21 Q86 9 83 3" stroke={hwAccent} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </g>,
        );
        break;
      case 'straw-hat':
        headFront.push(
          <g key="hw">
            <ellipse cx="60" cy="29" rx="31" ry="6.5" fill={brim} />
            <path d="M46 29 Q47 13 60 13 Q73 13 74 29 Z" fill={fill} />
            <path d="M47 24.5 H73" stroke={hwAccent} strokeWidth="3" />
          </g>,
        );
        break;
      case 'hood':
        headFront.push(
          <g key="hw" fill="none">
            <ellipse cx="60" cy="47" rx="22" ry="23" stroke={darker(hw.color, 0.15)} strokeWidth="9" />
            <ellipse cx="60" cy="47" rx="22" ry="23" stroke="#f5f5f5" strokeWidth="5.5" strokeDasharray="3 2" />
          </g>,
        );
        break;
      case 'veil':
        headFront.push(<path key="hw" d="M41 37 Q60 24 79 37 L79 42 Q60 31 41 42 Z" fill={hwAccent} />);
        break;
    }
  }

  // ---------------------------------------------------------------- arms (final space)
  const arm = (d: string, hand: [number, number]) => (
    <>
      <path d={d} stroke={sleeve} strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d={d} stroke={SHADE} strokeWidth="5" strokeLinecap="round" fill="none" transform="translate(3 1)" />
      <circle cx={hand[0]} cy={hand[1]} r="7.5" fill={skin} />
      <circle cx={hand[0] + 2} cy={hand[1] + 2} r="3.5" fill={skinShade} opacity="0.5" />
    </>
  );
  const stillArm = wave === 'right' ? arm('M38 101 L28 140', [27, 146]) : arm('M82 101 L92 140', [93, 146]);
  const waveArm =
    wave === 'right' ? (
      <g className="animate-wave" style={{ transformOrigin: '82px 101px' }}>
        {arm('M82 101 L100 68', [102, 61])}
      </g>
    ) : (
      <g className="animate-wave" style={{ transformOrigin: '38px 101px', animationDelay: '0.6s' }}>
        {arm('M38 101 L20 68', [18, 61])}
      </g>
    );

  // ---------------------------------------------------------------- hair in front (final space)
  const hairFront: ReactNode[] = [];
  if (!hideHair) {
    if (hair === 'short') {
      hairFront.push(
        <path key="hair" d="M30 56 Q27 19 58 16 Q91 15 91 52 Q86 35 72 33 Q65 41 49 37 Q37 37 30 56 Z" fill={hairColor} />,
        <path key="shine" d="M43 26 Q54 20 68 22" stroke={hairLight} strokeWidth="4" strokeLinecap="round" fill="none" />,
      );
    } else if (hair === 'long') {
      hairFront.push(
        <path key="hair" d="M30 54 Q29 18 60 17 Q88 18 91 48 Q76 29 55 36 Q41 41 30 54 Z" fill={hairColor} />,
        <path key="shine" d="M44 26 Q55 21 70 23" stroke={hairLight} strokeWidth="4" strokeLinecap="round" fill="none" />,
      );
    } else {
      if (hair === 'bun') hairFront.push(<circle key="bun" cx="60" cy="14" r="12" fill={hairColor} />);
      hairFront.push(
        <path key="hair" d="M31 54 Q30 19 60 18 Q90 19 89 54 Q84 32 60 30 Q36 32 31 54 Z" fill={hairColor} />,
        <path key="shine" d="M44 25 Q56 20 70 23" stroke={hairLight} strokeWidth="4" strokeLinecap="round" fill="none" />,
      );
    }
  }

  return (
    <svg viewBox="0 -22 120 222" className="block h-full w-full overflow-visible" aria-hidden>
      <defs>{defs}</defs>
      <ellipse cx="60" cy="194" rx="38" ry="5.5" fill={DARK} opacity="0.12" />
      {back}
      <g transform={HEAD_T}>{headBack}</g>
      {/* Neck sits behind the collar */}
      <rect x="52" y="76" width="16" height="22" rx="5" fill={skinShade} />
      <g transform={BODY_T}>{body}</g>
      {stillArm}
      <g transform={BODY_T}>{bodyOver}</g>
      {waveArm}
      {/* Head */}
      {!hideHair && (
        <g fill={skin}>
          <circle cx="32" cy="58" r="6.5" />
          <circle cx="88" cy="58" r="6.5" />
        </g>
      )}
      <rect x="32" y="23" width="56" height="61" rx="25" fill={skin} />
      {/* Face */}
      <g>
        <ellipse cx="48.5" cy="55" rx="7" ry="8.5" fill="#ffffff" />
        <ellipse cx="71.5" cy="55" rx="7" ry="8.5" fill="#ffffff" />
        <circle cx="49.8" cy="57" r="4.6" fill={DARK} />
        <circle cx="70.2" cy="57" r="4.6" fill={DARK} />
        <circle cx="51.4" cy="55.2" r="1.6" fill="#ffffff" />
        <circle cx="71.8" cy="55.2" r="1.6" fill="#ffffff" />
        <path d="M42 43.5 Q48 39.5 54.5 42.5 M65.5 42.5 Q72 39.5 78 43.5" stroke={hideHair ? DARK : hairColor} strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {female && <path d="M41.6 50 L38.4 47.4 M42.4 47.4 L40.4 44.4 M78.4 50 L81.6 47.4 M77.6 47.4 L79.6 44.4" stroke={DARK} strokeWidth="2.2" strokeLinecap="round" />}
        <ellipse cx="60" cy="65" rx="3.9" ry="3" fill={skinShade} />
        <path d="M51 70 Q60 71.6 69 70 Q68 80.5 60 80.5 Q52 80.5 51 70 Z" fill="#7a2034" />
        <path d="M53 70.4 Q60 71.8 67 70.4 L66.4 73.2 Q60 74 53.6 73.2 Z" fill="#ffffff" />
        <ellipse cx="60" cy="78" rx="5" ry="2.5" fill="#ff7a8a" />
        <ellipse cx="41.5" cy="66" rx="4.6" ry="3" fill="#ff8fa3" opacity="0.4" />
        <ellipse cx="78.5" cy="66" rx="4.6" ry="3" fill="#ff8fa3" opacity="0.4" />
      </g>
      {hairFront}
      <g transform={HEAD_T}>{headFront}</g>
    </svg>
  );
}

/** "Traditional dress" card for the People section: a cartoon man and woman with garment names. */
export function TraditionalDress({ country }: { country: Country }) {
  const c = costumeFor(country);
  const caption =
    c.note ??
    (c.illustrative
      ? `Illustrative: inspired by traditional dress across ${c.regionName}.`
      : 'Simplified cartoon. Traditional dress varies by region and is mostly worn on festivals and special days.');

  return (
    <div className="toon relative overflow-hidden rounded-3xl bg-[linear-gradient(180deg,#d8f1ff_0%,#fff7e6_100%)] px-3 pb-3 pt-4">
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 bg-[#c8ec7a] [clip-path:ellipse(70%_100%_at_50%_100%)] opacity-70" />
      <div className="relative flex items-end justify-center gap-1" role="img" aria-label={`Cartoon of traditional dress in ${country.name}`}>
        {(
          [
            ['man', c.man, c.skin[0], c.hair[0], 'right', '0s'],
            ['woman', c.woman, c.skin[1], c.hair[1], 'left', '0.8s'],
          ] as const
        ).map(([who, outfit, skin, hairColor, wave, delay]) => (
          <div key={who} className="h-[236px] w-[128px] animate-float" style={{ animationDelay: delay }}>
            <Figure outfit={outfit} skin={skin} hairColor={hairColor} female={who === 'woman'} wave={wave} />
          </div>
        ))}
      </div>
      {!c.note && c.labels && (
        <div className="relative mt-2 grid grid-cols-2 gap-2 text-center">
          {(['man', 'woman'] as const).map((who) => (
            <div key={who} className="toon-sm rounded-2xl bg-white px-2 py-1.5">
              <div className="text-[10.5px] font-black uppercase tracking-wide text-ink/50">{who === 'man' ? '👨 Men' : '👩 Women'}</div>
              <div className="text-[13px] font-extrabold leading-tight text-ink">{c.labels?.[who] ?? 'Traditional dress'}</div>
            </div>
          ))}
        </div>
      )}
      <p className="relative mt-2.5 text-center text-[11.5px] font-semibold leading-snug text-slate-500">{caption}</p>
    </div>
  );
}
