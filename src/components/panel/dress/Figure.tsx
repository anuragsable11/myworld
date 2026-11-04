import { useId, type ReactNode } from 'react';
import type { Hair, Outfit } from '../../../data/costumes';
import { drawGarments, ellipse, type Fig } from './garments';
import { drawHeadwear, HIDES_EARS, HIDES_HAIR, OPEN_CROWN } from './headwear';
import { createPainter, DARK, darker, lighter, mix, SHADE, type Painter } from './paint';

/**
 * Original characters in a flat, chunky style: big heads, big shiny eyes, open smiles, thick
 * rounded arms, no outlines, and one flat shade on the right side of every shape. They blink,
 * bob gently and wave.
 */

export interface FigureProps {
  outfit: Outfit;
  skin: string;
  hairColor: string;
  female: boolean;
  /** The viewer's side of the arm that waves. */
  wave: 'left' | 'right';
  /** Eyes squeezed shut in a big grin. */
  happy?: boolean;
  /** Seconds to offset this figure's blinking and waving, so a pair doesn't move in step. */
  delay?: number;
}

const BUILD = {
  man: { sh: 26, wa: 23, waistY: 136 },
  woman: { sh: 23, wa: 19, waistY: 128 },
};

const HEAD = {
  man: 'M60 17 C78 17 90 28 90 46 V57 C90 74 78 84 60 84 C42 84 30 74 30 57 V46 C30 28 42 17 60 17 Z',
  woman: 'M60 18 C77 18 89 29 89 47 V56 C89 73 77 84 60 84 C43 84 31 73 31 56 V47 C31 29 43 18 60 18 Z',
};

/** Mouth outline, the band of top teeth, and the tongue's centre and radii. */
const MOUTHS = {
  man: {
    d: 'M50.6 68.4 Q60 71.4 69.4 68.4 Q68.8 79.8 60 79.8 Q51.2 79.8 50.6 68.4 Z',
    teeth: 'M48 64 H72 V70.8 Q60 74.4 48 70.8 Z',
    tongue: [79.6, 6.2, 3.6],
  },
  woman: {
    d: 'M52.4 68.8 Q60 71.2 67.6 68.8 Q67 78.6 60 78.6 Q53 78.6 52.4 68.8 Z',
    teeth: 'M50 64 H70 V71.1 Q60 74.1 50 71.1 Z',
    tongue: [78.4, 5.6, 3.3],
  },
  happy: {
    d: 'M49.8 67.8 Q60 71.4 70.2 67.8 Q69.6 81.4 60 81.4 Q50.4 81.4 49.8 67.8 Z',
    teeth: 'M48 64 H72 V71 Q60 75 48 71 Z',
    tongue: [81.2, 6.6, 4],
  },
} as const;

const EYES = [47.5, 72.5];
const EYE_Y = 54;

type Point = readonly [number, number];

// ------------------------------------------------------------------ hair

/** A hairline parted in the middle, with the hair drawn back. */
const PARTED = 'M28.5 57 C25.5 31 39 12 60 12 C81 12 94.5 31 91.5 57 C89.5 43 82 33 68.5 30 Q63 31.5 60 36 Q57 31.5 51.5 30 C38 33 30.5 43 28.5 57 Z';

function drawHair(p: Painter, kind: Hair, color: string, accent: string, female: boolean, crownFree: boolean) {
  const back: ReactNode[] = [];
  const front: ReactNode[] = [];
  const light = lighter(color, 0.24);
  const streak = (key: string, d: string, width = 3.2) => (
    <path key={key} d={d} stroke={light} strokeWidth={width} strokeLinecap="round" fill="none" />
  );
  const tie = (d: string) => <path key="tie" d={d} stroke={accent} strokeWidth="3.4" strokeLinecap="round" fill="none" />;

  switch (kind) {
    case 'short':
      if (female) {
        // Chin-length bob with a straight fringe
        back.push(p.piece('hair-back', 'M28 52 C25.5 25 40 12 60 12 C80 12 94.5 25 92 52 L93.5 80 Q90.5 87 84 85 L36 85 Q29.5 87 26.5 80 Z', color));
        front.push(
          p.piece('hair', 'M28.5 58 C25.5 31 38 12 60 12 C82 12 95.5 31 91.5 58 C90.5 46 87.5 39 83.5 36 Q60 41 36.5 36 C32.5 39 29.5 47 28.5 58 Z', color),
          streak('shine', 'M38 23 Q47 16 58 15.5'),
        );
      } else {
        // Short, with a swept fringe and a tuft on top
        front.push(
          p.piece('hair', 'M28.5 56 C25.5 31 38 10 61 10 C84 10 95.5 29 91.5 55 C89.5 45 85 38.5 77.5 35.5 Q67 41 57 33.5 Q45 40.5 34.5 42 C31.5 45.5 29.5 50.5 28.5 56 Z', color),
          <path key="tuft" d="M43 17 C44 7 54 4 61 7 C54 8 50 12 49.5 16 Z" fill={color} />,
          streak('shine', 'M40 22 Q49 14.5 62 14.5'),
        );
      }
      break;
    case 'coily': {
      // Short tight curls: a cap with a bumpy edge
      const curls: Point[] = [
        [31.5, 47],
        [34, 36.5],
        [40.5, 27.5],
        [49.5, 21],
        [60, 18.5],
        [70.5, 21],
        [79.5, 27.5],
        [86, 36.5],
        [88.5, 47],
      ];
      front.push(
        p.piece('hair', ['M29 56 C27 32 40 15 60 15 C80 15 93 32 91 56 C89 46 84 40 77 38 Q60 34 43 38 C36 40 31 46 29 56 Z', ...curls.map(([x, y]) => ellipse(x, y, 6.6, 6.6))], color),
        streak('shine', 'M38.5 28 Q41.5 24 45.5 23.5', 2.2),
        streak('shine2', 'M52 19.5 Q56 16.5 60.5 16.8', 2.2),
      );
      break;
    }
    case 'long':
      back.push(p.piece('hair-back', 'M27.5 52 C25 23 40 10 60 10 C80 10 95 23 92.5 52 L96.5 118 Q95.5 125 87 124 L33 124 Q24.5 125 23.5 118 Z', color));
      front.push(
        p.piece('hair', 'M28.5 58 C25.5 31 38 11 60 11 C82 11 95.5 30 91.5 58 C89.5 44 83 35 71 31 C64 36 50 37.5 36.5 37.5 C32.5 42 30 50 28.5 58 Z', color),
        streak('shine', 'M38 22 Q47 15 58 14.5'),
      );
      break;
    case 'bun':
      if (crownFree) {
        front.push(p.piece('bun', ellipse(60, 2.5, 10.5, 10.5), color), streak('bun-shine', 'M52.6 -1.5 Q55.6 -5.6 60.6 -6', 2.6), tie('M51.5 10 Q60 13.5 68.5 10'));
      }
      front.push(p.piece('hair', PARTED, color), streak('shine', 'M37 25 Q44 17.5 54 15.5'));
      break;
    case 'puff':
      // Curls gathered into a round puff on top
      if (crownFree) {
        const puff = Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * 2 * Math.PI;
          return ellipse(60 + 11 * Math.cos(a), -1 + 10 * Math.sin(a), 5.4, 5.4);
        });
        front.push(p.piece('puff', [ellipse(60, -1, 12, 11), ...puff], color), streak('puff-shine', 'M51 -6 Q54 -10 59 -10.5', 2.4), tie('M49.5 10.5 Q60 15 70.5 10.5'));
      }
      front.push(p.piece('hair', PARTED, color), streak('shine', 'M37 25 Q44 17.5 54 15.5'));
      break;
    case 'braid':
      // Parted, with a braid hanging over each shoulder
      front.push(p.piece('hair', PARTED, color), streak('shine', 'M37 25 Q44 17.5 54 15.5'));
      for (const side of [-1, 1]) {
        const x0 = 60 + side * 27.5;
        const links = [0, 1, 2, 3, 4, 5].map((k) => [x0 + side * k * 0.7, 63 + k * 10.4, k % 2 ? 14 : -14] as const);
        const [ex, ey] = [x0 + side * 4.2, 63 + 6 * 10.4 - 4.6];
        front.push(
          <g key={`braid${side}`} fill={color}>
            {links.map(([x, y, tilt]) => (
              <ellipse key={y} cx={x} cy={y} rx="5.8" ry="6.4" transform={`rotate(${side * tilt} ${x} ${y})`} />
            ))}
            <path d={`M${ex - 4.2} ${ey + 1.5} L${ex} ${ey + 11} L${ex + 4.2} ${ey + 1.5} Z`} />
            {links.map(([x, y]) => (
              <path key={`l${y}`} d={`M${x - 3.4} ${y + 2.6} Q${x} ${y + 5} ${x + 3.4} ${y + 2.6}`} stroke={darker(color, 0.25)} strokeWidth="1" fill="none" />
            ))}
            <ellipse cx={ex} cy={ey} rx="4.2" ry="2.4" fill={accent} />
          </g>,
        );
      }
      break;
  }
  return { back, front };
}

// ------------------------------------------------------------------ arms

interface ArmProps {
  f: Fig;
  side: -1 | 1;
  waving: boolean;
  sleeve: string;
  cuff: string;
  skin: string;
  skinShade: string;
  delay: number;
}

/** A sleeve band at the wrist end of the segment from a to b. */
function cuffBand([ax, ay]: Point, [bx, by]: Point) {
  const len = Math.hypot(bx - ax, by - ay);
  return `M${bx - ((bx - ax) / len) * 3.8} ${by - ((by - ay) / len) * 3.8} L${bx} ${by}`;
}

function drawArm({ f, side, waving, sleeve, cuff, skin, skinShade, delay }: ArmProps): ReactNode {
  const width = f.female ? 11.2 : 12.4;
  const jx = 60 + side * (f.female ? 19.5 : 22);
  const tube = (d: string) => <path d={d} stroke={sleeve} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  const shade = (d: string, dx: number, dy: number) => (
    <path d={d} stroke={SHADE} strokeWidth="4.2" strokeLinecap="round" fill="none" transform={`translate(${dx} ${dy})`} />
  );
  const band = (a: Point, b: Point) => <path d={cuffBand(a, b)} stroke={cuff} strokeWidth={width + 0.3} fill="none" />;

  if (!waving) {
    // Hanging down, with a thumb on the side facing the body
    const J: Point = [jx, 97];
    const C: Point = [jx + side * 8, 118];
    const W: Point = [jx + side * 6, 137];
    const [hx, hy] = [jx + side * 6.4, 142.6];
    const d = `M${J[0]} ${J[1]} Q${C[0]} ${C[1]} ${W[0]} ${W[1]}`;
    const tx = hx - side * 4.4;
    return (
      <g key={`arm${side}`}>
        {tube(d)}
        {shade(d, 2.6, 0)}
        {band(C, W)}
        <ellipse cx={tx} cy={hy - 1.6} rx="2.3" ry="3.5" fill={skin} transform={`rotate(${side * 25} ${tx} ${hy - 1.6})`} />
        <ellipse cx={hx} cy={hy} rx="5.6" ry="6.3" fill={skin} />
        <path d={`M${hx - 2.4} ${hy + 3.4} Q${hx} ${hy + 4.8} ${hx + 2.4} ${hy + 3.4}`} stroke={skinShade} strokeWidth="1" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  // Raised: the forearm swings from the elbow, the open palm facing us, thumb towards the body
  const J: Point = [jx, 97];
  const E: Point = [jx + side * 17, 104.5];
  const W: Point = [jx + side * 20, 83];
  const [hx, hy] = [jx + side * 20.6, 76];
  const tilt = (Math.atan2(W[0] - E[0], E[1] - W[1]) * 180) / Math.PI;
  const upper = `M${J[0]} ${J[1]} L${E[0]} ${E[1]}`;
  const fore = `M${E[0]} ${E[1]} L${W[0]} ${W[1]}`;
  return (
    <g key={`arm${side}`}>
      {tube(upper)}
      {shade(upper, 0, 2.6)}
      <g className="animate-hand-wave" style={{ transformOrigin: `${E[0]}px ${E[1]}px`, animationDelay: `${delay}s` }}>
        {tube(fore)}
        {shade(fore, 2.6, 0)}
        {band(E, W)}
        <g transform={`translate(${hx} ${hy}) rotate(${tilt})`}>
          <path d={`M${-side * 4.6} 2.4 L${-side * 9.4} -2.8`} stroke={skin} strokeWidth="4.6" strokeLinecap="round" />
          <rect x="-6" y="-8.6" width="12" height="15.2" rx="5.6" fill={skin} />
          <path d="M-2 -8.4 V-3.6 M2 -8.4 V-3.6" stroke={skinShade} strokeWidth="1.1" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}

// ------------------------------------------------------------------ face

function drawFace(p: Painter, female: boolean, happy: boolean, hairColor: string, skinShade: string, delay: number): ReactNode {
  const mouth = MOUTHS[happy ? 'happy' : female ? 'woman' : 'man'];
  const mouthClip = p.clip(mouth.d);
  const [ty, trx, try_] = mouth.tongue;
  const brows = female
    ? 'M41.6 43.2 Q47.4 39.4 53.2 41.6 M66.8 41.6 Q72.6 39.4 78.4 43.2'
    : 'M41 42.4 Q47 38.8 53.6 40.8 M66.4 40.8 Q73 38.8 79 42.4';

  const eyes = happy ? (
    <path
      d={EYES.map((x) => `M${x - 5.6} ${EYE_Y + 1.6} Q${x} ${EYE_Y - 6} ${x + 5.6} ${EYE_Y + 1.6}`).join(' ')}
      stroke={DARK}
      strokeWidth="3.2"
      strokeLinecap="round"
      fill="none"
    />
  ) : (
    <g className="animate-blink" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${delay}s` }}>
      {EYES.map((x, i) => {
        const px = x + (i ? -0.8 : 0.8);
        return (
          <g key={x}>
            <ellipse cx={x} cy={EYE_Y} rx="6.6" ry="7.6" fill="#ffffff" />
            <circle cx={px} cy={EYE_Y + 1.3} r="4.5" fill={DARK} />
            <circle cx={px + 1.6} cy={EYE_Y - 0.7} r="1.6" fill="#ffffff" />
            <circle cx={px - 1.5} cy={EYE_Y + 3.1} r="0.75" fill="#ffffff" />
          </g>
        );
      })}
      {female && (
        // Lash line over each eye, flicked out at the corner
        <path
          d={EYES.map((x, i) => {
            const out = i ? 1 : -1;
            return `M${x - 6.2} ${EYE_Y - 2.6} A6.6 7.6 0 0 1 ${x + 6.2} ${EYE_Y - 2.6} M${x + out * 6.2} ${EYE_Y - 2.6} L${x + out * 9.2} ${EYE_Y - 5.8}`;
          }).join(' ')}
          stroke={DARK}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );

  return (
    <g key="face">
      <g fill="#ff6f86" opacity={female ? 0.42 : 0.3}>
        <ellipse cx="39.2" cy="64.6" rx="4.6" ry="2.9" />
        <ellipse cx="80.8" cy="64.6" rx="4.6" ry="2.9" />
      </g>
      {eyes}
      <path d={brows} stroke={darker(hairColor, 0.1)} strokeWidth={female ? 2.6 : 3.6} strokeLinecap="round" fill="none" transform={happy ? 'translate(0 -1.6)' : undefined} />
      <ellipse cx="60" cy="63.4" rx={female ? 3.2 : 3.8} ry={female ? 2.4 : 2.8} fill={skinShade} />
      <path d={mouth.d} fill="#6b1d2e" />
      <g clipPath={mouthClip}>
        <path d={mouth.teeth} fill="#ffffff" />
        <ellipse cx="60" cy={ty} rx={trx} ry={try_} fill="#ff7486" />
      </g>
    </g>
  );
}

// ------------------------------------------------------------------ figure

export function Figure({ outfit: o, skin, hairColor, female, wave, happy = false, delay = 0 }: FigureProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const accent = o.accent ?? '#ffd23f';
  const p = createPainter(uid, accent);
  const f: Fig = { o, female, skin, accent, ...BUILD[female ? 'woman' : 'man'], waveSide: wave === 'left' ? -1 : 1, p };
  const skinShade = mix(skin, '#3b140a', 0.22);
  const kind = o.headwear?.kind;
  const showEars = !kind || !HIDES_EARS.has(kind);

  const garments = drawGarments(f);
  const headwear = drawHeadwear(f);
  const hair = kind && HIDES_HAIR.has(kind) ? { back: [], front: [] } : drawHair(p, o.hair ?? 'short', hairColor, accent, female, !kind || OPEN_CROWN.has(kind));
  const arms = ([f.waveSide === 1 ? -1 : 1, f.waveSide] as const).map((side) =>
    drawArm({ f, side, waving: side === f.waveSide, sleeve: garments.sleeve, cuff: garments.cuff, skin, skinShade, delay }),
  );
  const face = drawFace(p, female, happy, hairColor, skinShade, delay);
  const earX = female ? [31, 89] : [30, 90];
  const jx = female ? 19.5 : 22;
  const puffs =
    garments.puff &&
    p.piece(
      'puffs',
      [60 - jx, 60 + jx].map((x) => `M${x - 8.4} 100 C${x - 9.4} 89 ${x - 4.4} 85.6 ${x} 85.6 C${x + 4.4} 85.6 ${x + 9.4} 89 ${x + 8.4} 100 Q${x} 104 ${x - 8.4} 100 Z`),
      garments.puff,
    );
  // The head bobs a little on its neck; everything attached to it bobs with it.
  const bob = { className: 'animate-bob', style: { animationDelay: `${delay / 2}s` } };

  return (
    <svg viewBox="0 -16 120 228" className="block h-full w-full overflow-visible" aria-hidden>
      <defs>{p.defs}</defs>
      <ellipse cx="60" cy="204" rx="35" ry="5.2" fill={DARK} opacity="0.13" />
      {garments.back}
      <g {...bob}>
        {headwear.back}
        {hair.back}
      </g>
      <rect x="53.5" y="72" width="13" height="25" fill={skinShade} />
      {garments.legs}
      {garments.body}
      {arms}
      {puffs}
      {garments.drape}
      <g {...bob}>
        {showEars &&
          earX.map((x, i) => (
            <g key={x}>
              <ellipse cx={x} cy="58" rx="5.4" ry="7" fill={skin} />
              <ellipse cx={x + (i ? 0.9 : -0.9)} cy="58.4" rx="2.3" ry="3.7" fill={skinShade} />
            </g>
          ))}
        <path d={HEAD[female ? 'woman' : 'man']} fill={skin} />
        {face}
        {female &&
          showEars &&
          earX.map((x) => (
            <g key={`earring${x}`}>
              <circle cx={x} cy="66.6" r="2.2" fill="#ffd23f" />
              <circle cx={x - 0.6} cy="66" r="0.7" fill="#ffffff" opacity="0.8" />
            </g>
          ))}
        {hair.front}
        {headwear.front}
      </g>
    </svg>
  );
}
