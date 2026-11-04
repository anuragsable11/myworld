import type { ReactNode } from 'react';
import type { HeadwearKind } from '../../../data/costumes';
import { ellipse, type Fig } from './garments';
import { DARK, DETAIL, darker } from './paint';

/** Headwear that covers the hair entirely. */
export const HIDES_HAIR = new Set<HeadwearKind>(['headscarf', 'ghutra', 'hood', 'turban', 'headwrap', 'gele']);
/** Headwear that covers the ears. */
export const HIDES_EARS = new Set<HeadwearKind>(['headscarf', 'ghutra', 'hood', 'chullo']);
/** Headwear that leaves the crown free, so a bun still shows. */
export const OPEN_CROWN = new Set<HeadwearKind>(['flower', 'flower-crown', 'veil']);

const shine = (key: string, d: string, width = 2.6) => (
  <path key={key} d={d} stroke="#ffffff" strokeOpacity="0.38" strokeWidth={width} strokeLinecap="round" fill="none" />
);

/** Points spread along the top arc of an ellipse, from angle a0 to a1 (degrees, 0 = right, -90 = top). */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const;
  });

export function drawHeadwear(f: Fig): { back: ReactNode[]; front: ReactNode[] } {
  const back: ReactNode[] = [];
  const front: ReactNode[] = [];
  const hw = f.o.headwear;
  if (!hw) return { back, front };
  const { p } = f;
  const fill = p.fill(hw.color, hw.pattern, hw.accent);
  const accent = hw.accent ?? '#e63946';
  const brim = p.fill(darker(hw.color, 0.12), hw.pattern, hw.accent);

  switch (hw.kind) {
    case 'kufi':
      front.push(
        p.piece('kufi', 'M32.5 36 C31.5 17 44 8.5 60 8.5 C76 8.5 88.5 17 87.5 36 C76 30.5 44 30.5 32.5 36 Z', fill),
        <path key="kufi-band" d="M33 35.2 C44 30 76 30 87 35.2" stroke={darker(hw.color, 0.16)} strokeWidth="2.4" fill="none" />,
        shine('kufi-shine', 'M41 19 Q49 12.5 58 12'),
      );
      break;
    case 'fez':
      front.push(
        p.piece('fez', 'M40.5 33 L44.5 1 Q60 -2.6 75.5 1 L79.5 33 Q60 37 40.5 33 Z', fill),
        <ellipse key="fez-top" cx="60" cy="0.9" rx="15.4" ry="2.4" fill={darker(hw.color, 0.12)} />,
        <path key="fez-cord" d="M60 0.5 Q71 0 76.5 12" stroke={DARK} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
        <path key="fez-tassel" d="M74.2 11.5 H79 L80.6 24 Q76.6 26 72.6 24 Z" fill={DARK} />,
        shine('fez-shine', 'M47.5 7 L46 26'),
      );
      break;
    case 'ghutra':
      // A cloth over the head, falling past the face onto the shoulders, held by a black cord ring
      front.push(
        p.piece(
          'ghutra',
          'M20.5 110 C23.5 82 25.5 54 27.5 39 C29.5 20 43.5 9.5 60 9.5 C76.5 9.5 90.5 20 92.5 39 C94.5 54 96.5 82 99.5 110 Q90.5 115 81 111.5 C84 92 90.5 72 89.5 53 C88.5 43 84 37.5 78 35 Q60 29.5 42 35 C36 37.5 31.5 43 30.5 53 C29.5 72 36 92 39 111.5 Q29.5 115 20.5 110 Z',
          fill,
        ),
        <path key="ghutra-folds" d="M32.5 64 Q31 86 30 108 M87.5 64 Q89 86 90 108" stroke={DETAIL} strokeWidth="1.4" fill="none" />,
        // The agal's two cords, across the front of the head
        <path key="agal" d="M32.6 19.5 Q60 31 87.4 19.5 M33 24.6 Q60 36 87 24.6" stroke={DARK} strokeWidth="3.4" strokeLinecap="round" fill="none" />,
      );
      break;
    case 'headscarf':
      front.push(
        p.piece(
          'headscarf',
          'M60 9 C82 9 96 24 95 48 C95 70 93 92 101 113 Q60 127 19 113 C27 92 25 70 25 48 C24 24 38 9 60 9 Z M60 30.5 C76.5 30.5 87.5 40 87.5 54.5 C87.5 73 76 84.6 60 84.6 C44 84.6 32.5 73 32.5 54.5 C32.5 40 43.5 30.5 60 30.5 Z',
          fill,
          { fillRule: 'evenodd' },
        ),
        <path key="headscarf-folds" d="M38 98 Q60 108 82 98 M46 91 Q60 97 74 91" stroke={DETAIL} strokeWidth="1.5" fill="none" />,
        shine('headscarf-shine', 'M35 26 Q44 15 56 13', 3),
      );
      break;
    case 'hood': {
      back.push(p.piece('hood', 'M60 5 C85 5 100 23 99 52 C98.5 78 88 96 60 97 C32 96 21.5 78 21 52 C20 23 35 5 60 5 Z', p.fill(darker(hw.color, 0.06))));
      // Fur trim: a ring of puffs around the face
      const puffs = arc(60, 53, 30.5, 36, -90, 270 - 360 / 22, 22);
      front.push(
        <g key="fur">
          {puffs.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5.4" fill={i % 2 ? '#f7f3ea' : '#ece6d8'} />
          ))}
        </g>,
      );
      break;
    }
    case 'turban':
    case 'headwrap':
      front.push(
        p.piece('wrap', 'M28 43 C24 16 40 3 60 3 C80 3 96 16 92 43 C84 34.5 72 31.5 60 32.5 C48 31.5 36 34.5 28 43 Z', fill),
        <path key="wrap-folds" d="M33 31 Q56 13 85 22 M31 21.5 Q55 26 74 6.5 M50 4.5 Q66 18 89 30" stroke={DETAIL} strokeWidth="1.5" fill="none" />,
        shine('wrap-shine', 'M37 15 Q45 8 55 6.5'),
      );
      if (hw.kind === 'headwrap') {
        front.push(
          <g key="knot" fill={brim}>
            <path d="M60 7 C51 -6 40 -1 46.5 8.5 Z M60 7 C69 -6 80 -1 73.5 8.5 Z" />
            <circle cx="60" cy="6.5" r="3.8" />
          </g>,
        );
      }
      break;
    case 'gele':
      // A tall, sculpted head tie
      front.push(
        p.piece('gele', 'M27 43 C19 22 27 -3 46 -1 C52 -11 70 -12 78 -3 C95 -1 101 20 93 43 C84 32 72 29.5 60 31.5 C48 29.5 36 32 27 43 Z', fill),
        <path key="gele-folds" d="M38 6 Q50 20 45 32 M58 -6 Q63 12 58.5 30 M77 0 Q70 18 75 32" stroke={DETAIL} strokeWidth="1.5" fill="none" />,
        shine('gele-shine', 'M33 19 Q36 7 46 4'),
      );
      break;
    case 'sombrero':
      front.push(
        p.piece('sombrero-brim', ellipse(60, 30, 45, 9.6), brim),
        <ellipse key="sombrero-rim" cx="60" cy="30" rx="43.4" ry="8.6" fill="none" stroke={accent} strokeWidth="1.4" strokeDasharray="3 2.4" />,
        p.piece('sombrero', 'M45 31 C44.5 6 51 -9 60 -9 C69 -9 75.5 6 75 31 Q60 34 45 31 Z', fill),
        <path key="sombrero-band" d="M45.3 23.5 Q60 26.5 74.7 23.5" stroke={accent} strokeWidth="4" fill="none" />,
        shine('sombrero-shine', 'M50.5 17 Q50.5 4 56 -3'),
      );
      break;
    case 'chullo':
      // Knitted Andean hat with ear flaps
      front.push(
        p.piece('chullo-flaps', 'M31.5 38 L29.5 67 Q34 70.5 38.5 67 L40 41 Z M88.5 38 L90.5 67 Q86 70.5 81.5 67 L80 41 Z', fill),
        <path key="chullo-ties" d="M34 69 V82 M86 69 V82" stroke={hw.color} strokeWidth="2" />,
        <circle key="chullo-tassel-l" cx="34" cy="83" r="2.4" fill={accent} />,
        <circle key="chullo-tassel-r" cx="86" cy="83" r="2.4" fill={accent} />,
        p.piece('chullo', 'M31.5 41 C29.5 15 44 7 60 7 C76 7 90.5 15 88.5 41 Z', fill),
        <path key="chullo-stripes" d="M33 25.5 Q60 19 87 25.5 M32 33.5 Q60 27 88 33.5" stroke={accent} strokeWidth="3.2" fill="none" />,
        <circle key="chullo-pompom" cx="60" cy="5.5" r="5.6" fill={accent} />,
        shine('chullo-shine', 'M39 17 Q47 11 56 10.5'),
      );
      break;
    case 'bowler':
      // Perched high on the head
      front.push(
        p.piece('bowler-brim', ellipse(60, 24.5, 17.5, 4.2), brim),
        p.piece('bowler', 'M46.8 24.5 C46.8 6.5 52 0 60 0 C68 0 73.2 6.5 73.2 24.5 Z', fill),
        ...(hw.accent ? [<path key="bowler-band" d="M47 20 H73" stroke={accent} strokeWidth="2.6" />] : []),
        shine('bowler-shine', 'M51 15 Q51.5 6 55.5 3'),
      );
      break;
    case 'beret':
      front.push(
        <g key="beret" transform="rotate(-8 57 19)">
          {p.piece('beret-cap', ellipse(57, 19, 27.5, 10.5), fill)}
          {shine('beret-shine', 'M38 15 Q47 10 58 9.5')}
        </g>,
        <path key="beret-band" d="M33.5 25.5 Q58 34 83.5 23" stroke={darker(hw.color, 0.2)} strokeWidth="1.8" fill="none" />,
        <path key="beret-nub" d="M56.5 9.6 L57.6 5.6" stroke={darker(hw.color, 0.12)} strokeWidth="2.6" strokeLinecap="round" />,
      );
      break;
    case 'conical':
      // Palm-leaf cone hat (non la)
      front.push(
        p.piece('conical', 'M13.5 38 L60 -7 L106.5 38 Q60 48.5 13.5 38 Z', fill),
        <path key="conical-ribs" d="M60 -7 L45.5 42.5 M60 -7 L74.5 42.5 M60 -7 L31.5 40.5 M60 -7 L88.5 40.5 M60 -7 L60 43.6" stroke={DETAIL} strokeWidth="0.9" />,
        <path key="conical-rim" d="M13.5 38 Q60 48.5 106.5 38" stroke={darker(hw.color, 0.18)} strokeWidth="1.8" fill="none" />,
        shine('conical-shine', 'M53 3 L32 28'),
      );
      break;
    case 'papakha': {
      // Tall sheepskin hat
      const curls = [8, 15.5, 23, 30]
        .map((y, row) => `M${37 + (row % 2) * 3} ${y}${' q3.2 3.2 6.4 0'.repeat(7 - (row % 2))}`)
        .join(' ');
      front.push(
        p.piece('papakha', 'M32.5 34 L34.5 2.5 Q60 -4.5 85.5 2.5 L87.5 34 Q60 39 32.5 34 Z', fill),
        <path key="papakha-curls" d={curls} stroke={DETAIL} strokeWidth="1.3" fill="none" />,
      );
      break;
    }
    case 'tall-cap':
      front.push(
        p.piece('tall-cap', 'M38.5 34 L42.5 1.5 Q60 -5.5 77.5 1.5 L81.5 34 Q60 38.5 38.5 34 Z', fill),
        <path key="tall-cap-band" d="M39 28.6 Q60 33.2 81 28.6" stroke={accent} strokeWidth="3.4" fill="none" />,
        <circle key="tall-cap-knot" cx="60" cy="-2.6" r="3.4" fill={accent} />,
        shine('tall-cap-shine', 'M46 7 L44.5 23'),
      );
      break;
    case 'flower-crown': {
      // Flower wreath with ribbons down the back
      back.push(
        <g key="ribbons" strokeWidth="2.6" strokeLinecap="round" fill="none">
          <path d="M78 36 L87 106" stroke="#ff6b81" />
          <path d="M82 33 L95 100" stroke="#2e86de" />
          <path d="M74 38 L79 110" stroke="#ffd23f" />
        </g>,
      );
      const colors = [hw.color, '#ffd23f', '#2e86de', '#ff9f1c', hw.color, '#2ecc71', '#c3b1ff'];
      const spots = arc(60, 37, 27.5, 21, -180, 0, 7);
      front.push(
        <g key="crown">
          {arc(60, 37, 27.5, 21, -165, -15, 6).map(([x, y], i) => (
            <ellipse key={`leaf${i}`} cx={x} cy={y} rx="3.6" ry="1.8" fill="#2e9e5b" transform={`rotate(${i * 30 - 75} ${x} ${y})`} />
          ))}
          {spots.map(([x, y], i) => (
            <g key={i} fill={colors[i]}>
              {[0, 72, 144, 216, 288].map((a) => (
                <circle key={a} cx={x + 2.7 * Math.cos((a * Math.PI) / 180)} cy={y + 2.7 * Math.sin((a * Math.PI) / 180)} r="2.4" />
              ))}
              <circle cx={x} cy={y} r="1.7" fill="#fff8dc" />
            </g>
          ))}
        </g>,
      );
      break;
    }
    case 'kokoshnik':
      // Tall crescent headdress, studded with pearls
      front.push(
        p.piece('kokoshnik', 'M30.5 41 C28.5 5 44 -9 60 -9 C76 -9 91.5 5 89.5 41 C80 30.5 70 28.5 60 28.5 C50 28.5 40 30.5 30.5 41 Z', fill),
        <path key="kokoshnik-band" d="M31.5 38.5 C40 30 50 28 60 28 C70 28 80 30 88.5 38.5" stroke={accent} strokeWidth="2.2" fill="none" />,
        <g key="pearls" fill={accent}>
          {arc(60, 22, 24, 26, -160, -20, 9).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.9" />
          ))}
          <circle cx="60" cy="10" r="3.8" />
        </g>,
        <circle key="kokoshnik-jewel" cx="60" cy="10" r="1.6" fill="#ffffff" opacity="0.7" />,
      );
      break;
    case 'mokorotlo':
      // Basotho woven cone hat with its knob of loops
      front.push(
        p.piece('mokorotlo', 'M23.5 41 L60 -1 L96.5 41 Q60 51.5 23.5 41 Z', fill),
        <path key="mokorotlo-bands" d="M32.5 31.5 Q60 39.5 87.5 31.5 M43.5 19 Q60 24.5 76.5 19" stroke={DETAIL} strokeWidth="1.6" fill="none" />,
        <path key="mokorotlo-knob" d="M60 0 C53 -5 55 -12.5 60 -12.5 C65 -12.5 67 -5 60 0 Z" fill={brim} />,
        <path key="mokorotlo-loops" d="M55.6 -6.5 Q60 -1.5 64.4 -6.5" stroke={DETAIL} strokeWidth="1.2" fill="none" />,
        shine('mokorotlo-shine', 'M52 10 L36 30'),
      );
      break;
    case 'flower':
      // A big flower tucked behind the ear
      front.push(
        <g key="flower" transform="translate(83 31)">
          <ellipse cx="-6.5" cy="5" rx="4.2" ry="2.2" fill="#2e9e5b" transform="rotate(30 -6.5 5)" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="3.7" ry="5.4" fill={hw.color} transform={`rotate(${a})`} />
          ))}
          <circle r="2.8" fill="#ffd23f" />
        </g>,
      );
      break;
    case 'topi':
      front.push(
        p.piece('topi', 'M37 35 L38.5 11 Q58 5 81.5 9.5 L83 33 Q60 38.5 37 35 Z', fill),
        <path key="topi-edge" d="M38.5 11 Q58 5 81.5 9.5" stroke={darker(hw.color, 0.2)} strokeWidth="1.6" fill="none" />,
      );
      break;
    case 'felt-hat':
      front.push(
        p.piece('felt-brim', ellipse(60, 27.5, 26.5, 5.6), brim),
        p.piece('felt-crown', 'M45 28 C44.5 12 50 4.5 60 4.5 C70 4.5 75.5 12 75 28 Z', fill),
        <path key="felt-dent" d="M54.5 5.5 Q60 10.5 65.5 5.5" stroke={DETAIL} strokeWidth="1.4" fill="none" />,
        <path key="felt-band" d="M45.3 22.5 Q60 25.5 74.7 22.5" stroke={darker(hw.color, 0.25)} strokeWidth="3" fill="none" />,
        shine('felt-shine', 'M49.5 18 Q50 10 54 7.5'),
      );
      // A feather in the band, in the accent colour (a hat without one has no accent of its own)
      if (hw.accent && hw.accent !== hw.color) {
        front.push(<path key="feather" d="M73 21 Q86 8 82.5 -3 Q88.5 3 85.5 11" stroke={hw.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />);
      }
      break;
    case 'straw-hat':
      front.push(
        p.piece('straw-brim', ellipse(60, 28.5, 33.5, 7), brim),
        <ellipse key="straw-weave" cx="60" cy="28.5" rx="25" ry="4.6" fill="none" stroke={DETAIL} strokeWidth="1" />,
        p.piece('straw-crown', 'M46 29 C45.5 13.5 51 8 60 8 C69 8 74.5 13.5 74 29 Z', fill),
        <path key="straw-band" d="M46.3 23.5 Q60 26.5 73.7 23.5" stroke={accent} strokeWidth="3.4" fill="none" />,
        shine('straw-shine', 'M50.5 18.5 Q51 12 55 10'),
      );
      break;
    case 'lace-cap':
      // A white lace cap with upturned wings, as worn with Dutch costume
      front.push(
        p.piece('lace-wings', ['M34 46 C24 41 16 31 12.5 17 C22.5 23.5 30.5 29.5 37 34 Z', 'M86 46 C96 41 104 31 107.5 17 C97.5 23.5 89.5 29.5 83 34 Z'], fill),
        p.piece('lace-cap', 'M32.5 41 C30.5 18 44 4 60 -1 C76 4 89.5 18 87.5 41 C78 33.5 70 31 60 31 C50 31 42 33.5 32.5 41 Z', fill),
        <g key="lace" fill={DETAIL}>
          {arc(60, 44, 27, 12.5, -165, -15, 11).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.1" />
          ))}
        </g>,
        shine('lace-shine', 'M40 22 Q47 11 57 6'),
      );
      break;
    case 'veil':
      back.push(<path key="veil" d="M36.5 27 Q60 17 83.5 27 L95 130 Q60 138 25 130 Z" fill={hw.color} opacity="0.9" />);
      front.push(
        p.piece('veil-band', 'M32.5 33.5 Q60 19 87.5 33.5 L87.5 38.5 Q60 25 32.5 38.5 Z', p.fill(accent)),
        <g key="veil-coins" fill="#ffffff" opacity="0.75">
          {arc(60, 36, 27.5, 7, -150, -30, 6).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.9" />
          ))}
        </g>,
      );
      break;
  }
  return { back, front };
}
