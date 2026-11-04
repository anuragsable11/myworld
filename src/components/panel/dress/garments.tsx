import type { ReactNode } from 'react';
import type { OverlayKind, Outfit, Pattern } from '../../../data/costumes';
import { DARK, DETAIL, darker, type Painter } from './paint';

/**
 * Everything a figure's parts need to agree on. Figures are drawn in a 120-unit-wide space with
 * the head between y 17 and 84, shoulders at y 90, the waist at `waistY` and the floor at y 204.
 */
export interface Fig {
  o: Outfit;
  female: boolean;
  skin: string;
  /** Pattern and trim colour. */
  accent: string;
  /** Half-widths of the shoulders and waist. */
  sh: number;
  wa: number;
  waistY: number;
  /** The viewer's side of the arm that waves: -1 left, 1 right. */
  waveSide: -1 | 1;
  p: Painter;
}

export interface GarmentLayers {
  /** Behind the whole figure. */
  back: ReactNode[];
  /** Shoes, trousers and stockings. */
  legs: ReactNode[];
  /** Garments, and the overlays worn under the arms. */
  body: ReactNode[];
  /** Shawls, ponchos and scarves, worn over the arms. */
  drape: ReactNode[];
  /** Paint for the arms. */
  sleeve: string;
  cuff: string;
  /** Paint for puffed sleeves, if the outfit has them. */
  puff: string | undefined;
}

/** Overlays drawn over the arms: wraps, and the vest, whose armholes the arms come out of. */
const DRAPES = new Set<OverlayKind>(['pallu', 'dupatta', 'poncho', 'blanket', 'shawl', 'vest']);

export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

/** A shirt, blouse, tunic or robe from the neckline down to `bottom`, where it is `half` wide on each side. */
function torso({ sh }: Fig, bottom: number, half: number) {
  const l = 60 - sh;
  const r = 60 + sh;
  return `M52 89 Q60 95 68 89 L${r - 7} 90.5 Q${r} 92 ${r} 100 L${60 + half} ${bottom} Q60 ${bottom + 3} ${60 - half} ${bottom} L${l} 100 Q${l} 92 ${l + 7} 90.5 Z`;
}

/** Half-width at height y of a garment drawn with torso(). */
const torsoHalf =
  ({ sh }: Fig, bottom: number, half: number) =>
  (y: number) =>
    sh + (half - sh) * Math.min(1, Math.max(0, (y - 100) / (bottom - 100)));

export function drawGarments(f: Fig): GarmentLayers {
  const { o, p, sh, wa, waistY, female, accent } = f;
  const back: ReactNode[] = [];
  const legs: ReactNode[] = [];
  const body: ReactNode[] = [];
  const drape: ReactNode[] = [];
  const top = o.top;
  const bottom = o.bottom ?? o.top;
  const overlays = o.overlays ?? [];
  const feet = female ? [50, 70] : [48, 72];

  // ---------------------------------------------------------------- shoes and legs
  // Stockings go into the shoes; trouser legs fall over them.
  const shoes = o.shoes ?? '#4b4370';
  const stockings: ReactNode[] = [];
  feet.forEach((x, i) => {
    const out = i ? 1.2 : -1.2;
    legs.push(
      p.piece(`shoe${i}`, ellipse(x + out, 200, 9.6, 5.4), shoes),
      <ellipse key={`shoe-shine${i}`} cx={x + out - 2.6} cy="197.4" rx="3.4" ry="1.3" fill="#ffffff" opacity="0.3" />,
    );
  });
  const pants = () => {
    const l = 60 - wa + 1;
    const r = 60 + wa - 1;
    const bulge = female ? 4 : 1.5;
    const d = `M${l} 132 H${r} Q${r + bulge} 166 ${r - 2} 197 H63.5 L60 152 L56.5 197 H${l + 2} Q${l - bulge} 166 ${l} 132 Z`;
    legs.push(p.piece('pants', d, p.fill(bottom)));
  };
  const wearStockings = () =>
    feet.forEach((x, i) => stockings.push(p.piece(`stocking${i}`, roundRect(x - 6.5, 158, 13, 40, 5), o.legs ?? f.skin)));

  // ---------------------------------------------------------------- main garment
  const topFill = p.fill(top, o.topPattern, accent);
  /** Half-width of the outermost garment at height y. */
  let profile = torsoHalf(f, 140, wa);
  /** The garment a decorated hem runs along, and the height of its bottom edge. */
  let hemmed: { d: string; bottom: number; half: number } | undefined;
  let sleevePattern = o.topPattern;

  const shirt = (end: number) => {
    body.push(p.piece('shirt', torso(f, end, wa), topFill));
    return torsoHalf(f, end, wa);
  };
  const skirt = (d: string, kind: string, fill: string) => body.push(p.piece(kind, d, fill));

  switch (o.body) {
    case 'shirt-pants':
      pants();
      profile = shirt(140);
      break;
    case 'tunic-pants': {
      pants();
      sleevePattern = o.pattern ?? o.topPattern;
      const d = torso(f, 172, wa + 5);
      body.push(p.piece('tunic', d, p.fill(top, sleevePattern, accent)));
      hemmed = { d, bottom: 172, half: wa + 5 };
      profile = torsoHalf(f, 172, wa + 5);
      // Button placket
      const button = o.accent ?? darker(top, 0.3);
      body.push(
        <g key="placket">
          <path d="M60 93 V121" stroke={DETAIL} strokeWidth="1.4" />
          {[100, 108, 116].map((y) => (
            <circle key={y} cx="60" cy={y} r="1.5" fill={button} />
          ))}
        </g>,
      );
      break;
    }
    case 'robe': {
      sleevePattern = o.pattern;
      const d = torso(f, 197, wa + 9);
      body.push(p.piece('robe', d, p.fill(top, o.pattern, accent)), <path key="robe-seam" d="M60 95 V199" stroke={DETAIL} strokeWidth="1.5" />);
      hemmed = { d, bottom: 197, half: wa + 9 };
      profile = torsoHalf(f, 197, wa + 9);
      break;
    }
    case 'dress': {
      const high = o.waist === 'high';
      const start = high ? 110 : waistY - 4;
      const half0 = high ? sh - 1.5 : wa + 1;
      const half1 = wa + 4 + 18 * (o.flare ?? 0.5);
      const d = `M${60 - half0} ${start} H${60 + half0} L${60 + half1} 196 Q60 201 ${60 - half1} 196 Z`;
      skirt(d, 'skirt', p.fill(bottom, o.pattern, accent));
      hemmed = { d, bottom: 196, half: half1 };
      const bodiceHalf = high ? sh - 1.5 : wa;
      body.push(p.piece('dress-top', torso(f, start + 4, bodiceHalf), topFill));
      const upper = torsoHalf(f, start + 4, bodiceHalf);
      profile = (y) => (y < start ? upper(y) : half0 + ((half1 - half0) * (y - start)) / (196 - start));
      break;
    }
    case 'wrap': {
      const d = `M${60 - wa - 1} 130 H${60 + wa + 1} L${60 + wa + 2.5} 197 Q60 200.5 ${60 - wa - 2.5} 197 Z`;
      skirt(d, 'wrap', p.fill(bottom, o.pattern, accent));
      hemmed = { d, bottom: 197, half: wa + 2.5 };
      body.push(<path key="wrap-fold" d="M55 132 Q52.5 162 50.5 198" stroke={DETAIL} strokeWidth="1.6" fill="none" />);
      profile = shirt(138);
      break;
    }
    case 'kilt': {
      wearStockings();
      skirt(`M${60 - wa - 1} 128 H${60 + wa + 1} L${60 + wa + 4} 170 Q60 173.5 ${60 - wa - 4} 170 Z`, 'kilt', p.fill(bottom, o.pattern, accent));
      body.push(<path key="kilt-pleats" d="M47 131 L45.5 171 M53.5 131 L53 172.5 M66.5 131 L67 172.5 M73 131 L74.5 171" stroke={DETAIL} strokeWidth="1.3" />);
      profile = shirt(136);
      if (!female) {
        // Sporran: the pouch worn on the front of a kilt
        body.push(
          <g key="sporran">
            <path d="M52.5 139 H67.5 L66.5 152 Q60 158 53.5 152 Z" fill="#f4efe6" />
            <path d="M52.5 139 H67.5 V143 H52.5 Z" fill="#6b4226" />
            <path d="M57 146 V154 M63 146 V154" stroke={DARK} strokeWidth="1.6" strokeLinecap="round" />
          </g>,
        );
      }
      break;
    }
    case 'pleated': {
      wearStockings();
      const out = wa + 13;
      skirt(`M${60 - wa - 1} 128 H${60 + wa + 1} L${60 + out} 172 Q60 177 ${60 - out} 172 Z`, 'fustanella', p.fill(bottom, o.pattern, accent));
      const pleats = [-3, -2, -1, 1, 2, 3].map((k) => `M${60 + (k * (wa + 1)) / 3.5} 130 L${60 + (k * out) / 3.5} 174`).join(' ');
      body.push(<path key="pleats" d={pleats} stroke={DETAIL} strokeWidth="1.3" />);
      profile = shirt(136);
      break;
    }
    case 'parka': {
      pants();
      const d = `M${60 - sh + 4} 89.5 Q60 85 ${60 + sh - 4} 89.5 Q${60 + sh + 5} 92 ${60 + sh + 5} 102 L${60 + wa + 9} 182 Q60 188 ${60 - wa - 9} 182 L${60 - sh - 5} 102 Q${60 - sh - 5} 92 ${60 - sh + 4} 89.5 Z`;
      body.push(p.piece('parka', d, topFill));
      const half = (y: number) => sh + 5 + ((wa + 4 - sh) * (y - 102)) / 80;
      const quilt = [118, 142, 166].map((y) => `M${60 - half(y)} ${y} Q60 ${y + 5} ${60 + half(y)} ${y}`).join(' ');
      body.push(<path key="quilt" d={`${quilt} M60 92 V185`} stroke={DETAIL} strokeWidth="1.8" fill="none" />);
      profile = half;
      break;
    }
  }

  // A decorated border along the bottom of the skirt, robe, tunic or wrap
  if (o.hem && hemmed) {
    const { d, bottom: y, half } = hemmed;
    const band = `M${60 - half - 6} ${y - 12} Q60 ${y - 7} ${60 + half + 6} ${y - 12} V215 H${60 - half - 6} Z`;
    body.splice(1, 0, <g key="hem" clipPath={p.clip(d)}>{p.piece('hem-band', band, p.fill(o.hem.color, o.hem.pattern, o.hem.accent))}</g>);
  }

  // ---------------------------------------------------------------- overlays
  const drawOverlay = (kind: OverlayKind, color: string, pattern?: Pattern, trim?: string): ReactNode => {
    const fill = p.fill(color, pattern, trim);
    const s = f.waveSide;
    switch (kind) {
      case 'obi': {
        const y0 = female ? 107 : 115;
        const h = Math.max(profile(y0), profile(y0 + 17)) + 0.8;
        return (
          <>
            {p.piece('obi', roundRect(60 - h, y0, 2 * h, 17, 2.5), fill)}
            <path d={`M${60 - h} ${y0 + 8.5} H${60 + h}`} stroke={accent} strokeWidth="2.2" />
          </>
        );
      }
      case 'bow': {
        // Tied at the back: only its wings show beside the waist.
        const y0 = female ? 104 : 112;
        const x = 60 + s * (profile(y0 + 8) - 2);
        return <path d={`M${x} ${y0 + 3} L${x + s * 16} ${y0 - 7} Q${x + s * 22} ${y0 + 10} ${x + s * 16} ${y0 + 27} L${x} ${y0 + 17} Z`} fill={darker(color, 0.06)} />;
      }
      case 'sash': {
        const y0 = waistY - 7;
        const h = profile(y0 + 4) + 0.8;
        const x = 60 + s * (h - 10);
        return (
          <>
            {p.piece('sash', roundRect(60 - h, y0, 2 * h, 9, 2), fill)}
            {p.piece('sash-tail', `M${x} ${y0 + 6} L${x + s * 1.5} ${y0 + 33} L${x + s * 8.5} ${y0 + 31} L${x + s * 7} ${y0 + 6} Z`, p.fill(darker(color, 0.1), pattern, trim))}
          </>
        );
      }
      case 'vest':
      case 'jacket': {
        const yb = kind === 'jacket' ? waistY + 8 : waistY;
        const hb = profile(yb) + 0.6;
        const inner = kind === 'jacket' ? 5 : 6.5;
        const panel = (dir: -1 | 1) =>
          `M${60 + dir * (sh - 7)} 90.5 L${60 + dir * inner} 89.6 Q${60 + dir * (inner + 2)} 112 ${60 + dir * (inner + 3)} ${yb} L${60 + dir * hb} ${yb} L${60 + dir * sh} 100 Q${60 + dir * sh} 92 ${60 + dir * (sh - 7)} 90.5 Z`;
        return (
          <>
            {p.piece(`${kind}-l`, panel(-1), fill)}
            {p.piece(`${kind}-r`, panel(1), fill)}
            {trim && (
              <path
                d={`M${60 - inner} 89.6 Q${60 - inner - 2} 112 ${60 - inner - 3} ${yb} M${60 + inner} 89.6 Q${60 + inner + 2} 112 ${60 + inner + 3} ${yb}`}
                stroke={trim}
                strokeWidth="1.8"
                fill="none"
              />
            )}
          </>
        );
      }
      case 'apron': {
        const y0 = waistY - 1;
        return (
          <>
            {p.piece('apron', `M48 ${y0} H72 L74.5 181 Q60 185.5 45.5 181 Z`, fill)}
            <path d={`M${60 - profile(y0) - 0.6} ${y0 + 1} H${60 + profile(y0) + 0.6}`} stroke={darker(color, 0.14)} strokeWidth="3.2" />
          </>
        );
      }
      case 'bodice': {
        const y0 = 103;
        const y1 = waistY + 1;
        const h0 = profile(y0) + 0.3;
        const h1 = profile(y1 - 2) + 0.3;
        return (
          <>
            {p.piece('bodice', `M${60 - h0} ${y0} Q60 ${y0 - 4} ${60 + h0} ${y0} L${60 + h1} ${y1} Q60 ${y1 + 3} ${60 - h1} ${y1} Z`, fill)}
            {/* Criss-cross lacing */}
            <path
              d="M57.4 106 L62.6 110.6 M62.6 106 L57.4 110.6 M57.4 112.2 L62.6 116.8 M62.6 112.2 L57.4 116.8 M57.4 118.4 L62.6 123 M62.6 118.4 L57.4 123"
              stroke={trim ?? accent}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </>
        );
      }
      case 'collar':
        return (
          <>
            <path d="M51.5 86.5 Q60 84 68.5 86.5 L69 93 Q60 95.5 51 93 Z" fill={fill} />
            <path d={`M60 93.5 Q70 96 ${60 + sh - 3} 107`} stroke={fill} strokeWidth="2.2" fill="none" />
            {[
              [66, 95.6],
              [71.6, 98.8],
              [76.6, 102.8],
            ].map(([x, y]) => (
              <g key={x}>
                <path d={`M${x - 2.6} ${y} H${x + 2.6}`} stroke={fill} strokeWidth="1.4" strokeLinecap="round" />
                <circle cx={x} cy={y} r="1.6" fill={fill} />
              </g>
            ))}
          </>
        );
      case 'vcollar': {
        // A kimono collar, crossed down to the sash
        const yb = (female ? 107 : 115) + 1;
        return <path d={`M50.5 88.6 L60 ${yb} L69.5 88.6 L64.6 88.6 L60 ${yb - 11} L55.4 88.6 Z`} fill={fill} />;
      }
      case 'ribbon':
        // The long ribbons that tie a hanbok jacket
        return (
          <g fill={fill}>
            <path d="M62 104 Q71 96 75 103.5 Q70 108 62 104 Z" />
            <path d="M61.5 105 L56.5 146 L60.5 145 L64.5 106 Z" />
            <path d="M63.5 105 L69.5 142 L73 140 L65.5 105 Z" />
            <circle cx="62.6" cy="104.6" r="3.4" />
          </g>
        );
      case 'gazyri':
        // Rows of cartridge holders across the chest of a chokha
        return (
          <g fill={fill}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <rect x={60 - sh + 7} y={99 + i * 6} width="10" height="4" rx="1.6" />
                <rect x={60 + sh - 17} y={99 + i * 6} width="10" height="4" rx="1.6" />
              </g>
            ))}
          </g>
        );
      case 'pallu':
        // The loose end of a sari: over the wearer's left shoulder and across to the other hip
        return (
          <>
            {p.piece('pallu', `M${60 + sh - 12} 89 L${60 + sh + 3} 95 Q68 118 ${60 - wa + 10} ${waistY + 10} L${60 - wa - 2} ${waistY + 1} Q58 110 ${60 + sh - 12} 89 Z`, fill)}
            <path d={`M${60 + sh + 2} 97 Q67 120 ${60 - wa + 9} ${waistY + 8}`} stroke={trim ?? accent} strokeWidth="2.4" fill="none" />
          </>
        );
      case 'dupatta': {
        const l = 60 - sh;
        const r = 60 + sh;
        return (
          <>
            {p.piece('dupatta', `M${l + 2} 91 Q60 113 ${r - 2} 91 L${r + 1.5} 98.5 Q60 123 ${l - 1.5} 98.5 Z`, fill)}
            {p.piece('dupatta-l', `M${l - 1.5} 96 L${l - 5.5} 156 Q${l} 159.5 ${l + 5.5} 156 L${l + 5.5} 100 Z`, fill)}
            {p.piece('dupatta-r', `M${r + 1.5} 96 L${r + 5.5} 156 Q${r} 159.5 ${r - 5.5} 156 L${r - 5.5} 100 Z`, fill)}
          </>
        );
      }
      case 'poncho':
        return (
          <>
            {p.piece('poncho', `M50.5 88.5 Q60 95 69.5 88.5 L${60 + sh + 10} 103 L${60 + sh + 13} 152 Q60 160 ${60 - sh - 13} 152 L${60 - sh - 10} 103 Z`, fill)}
            <path d="M53.5 92 Q60 99 66.5 92" stroke={DETAIL} strokeWidth="2" fill="none" />
            <path d={`M${60 - sh - 12} 154.5 Q60 162.5 ${60 + sh + 12} 154.5`} stroke={darker(color, 0.15)} strokeWidth="4" strokeDasharray="1.4 2" fill="none" />
          </>
        );
      case 'blanket':
        return (
          <>
            {p.piece('blanket', `M${60 - sh - 6} 97 Q${60 - sh - 4} 88 51 88 Q60 94 69 88 Q${60 + sh + 4} 88 ${60 + sh + 6} 97 L${60 + sh + 10} 172 Q60 179 ${60 - sh - 10} 172 Z`, fill)}
            <path d="M67 92 Q63 132 65 176" stroke={DETAIL} strokeWidth="2" fill="none" />
            <circle cx="67" cy="99" r="2.4" fill="#ffd23f" />
          </>
        );
      case 'shawl':
        return (
          <>
            {p.piece('shawl', `M${60 - sh - 6} 99 Q${60 - sh - 4} 89 51 88.5 Q60 94 69 88.5 Q${60 + sh + 4} 89 ${60 + sh + 6} 99 L${60 + sh + 8} 121 Q60 135 ${60 - sh - 8} 121 Z`, fill)}
            {trim && <path d={`M${60 - sh - 7.6} 117.6 Q60 131 ${60 + sh + 7.6} 117.6`} stroke={trim} strokeWidth="2.6" fill="none" />}
          </>
        );
    }
  };

  overlays.forEach((ov, i) => {
    const el = <g key={`ov-${i}`}>{drawOverlay(ov.kind, ov.color, ov.pattern, ov.accent)}</g>;
    if (ov.kind === 'bow') back.push(el);
    else (DRAPES.has(ov.kind) ? drape : body).push(el);
  });

  const jacket = overlays.find((x) => x.kind === 'jacket');
  // Blouses under a laced bodice have puffed sleeves too
  const puff = o.sleeves === 'puff' || (female && overlays.some((x) => x.kind === 'bodice'));
  return {
    back,
    legs: [...stockings, ...legs],
    body,
    drape,
    sleeve: jacket ? p.fill(jacket.color, jacket.pattern, jacket.accent) : p.fill(top, sleevePattern, accent),
    cuff: darker(jacket?.color ?? top, 0.14),
    puff: puff ? topFill : undefined,
  };
}
