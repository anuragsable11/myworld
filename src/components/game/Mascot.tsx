import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';
import { DARK, SHADE } from '../panel/dress/paint';

/**
 * Globy, the quiz host: a little round planet with big feelings, drawn in the same flat style as
 * the people in the country profiles (no outlines, a flat shade on the right, glints in the eyes).
 *
 * It breathes, blinks and looks around while it waits, talks when it has something to say, squashes
 * and stretches into each new expression, cries a little at a wrong answer, catches fire on a streak
 * and puts on sunglasses on a long one.
 *
 * Kept light for phones: animations inside an SVG are redrawn by the main thread on every frame, so
 * everything that moves for long (the body, the flames, sparkles, tears and sweat) is an HTML layer
 * the graphics chip can animate on its own, and blinks and glances are brief one-off animations
 * rather than endless ones.
 */

export type Mood = 'idle' | 'happy' | 'sad' | 'think' | 'shock' | 'party';
export type Look = 'left' | 'right' | 'up' | 'down';

const OCEAN = '#4cb8f5';
const OCEAN_DARK = '#2f95db';
const LAND = '#7ed957';
const SHOE = '#ff7a59';
const MOUTH = '#6b1d2e';
const TONGUE = '#ff7486';
const HAND = '#f7fbff';

const EYE_Y = 76;
const EYES = [55, 85];

type Point = readonly [number, number];
/** An arm: a curve from the shoulder through `via` to the hand. */
type Arm = { via: Point; hand: Point };

const SHOULDERS: [Point, Point] = [
  [24, 94],
  [116, 94],
];

const ARMS: Record<'down' | 'up' | 'sad' | 'chin' | 'cheek', [Arm, Arm]> = {
  down: [
    { via: [13, 101], hand: [14, 114] },
    { via: [127, 101], hand: [126, 114] },
  ],
  up: [
    { via: [9, 88], hand: [11, 62] },
    { via: [131, 88], hand: [129, 62] },
  ],
  sad: [
    { via: [19, 108], hand: [23, 122] },
    { via: [121, 108], hand: [117, 122] },
  ],
  chin: [
    { via: [13, 101], hand: [14, 114] },
    { via: [114, 126], hand: [88, 115] },
  ],
  cheek: [
    { via: [12, 110], hand: [36, 99] },
    { via: [128, 110], hand: [104, 99] },
  ],
};

const POSE: Record<Mood, keyof typeof ARMS> = { idle: 'down', happy: 'up', party: 'up', sad: 'sad', think: 'chin', shock: 'cheek' };

const BROWS: Record<Mood, string> = {
  idle: 'M45 60 Q55 55 64 59 M76 59 Q85 55 95 60',
  happy: 'M45 57 Q55 50 64 55 M76 55 Q85 50 95 57',
  party: 'M45 57 Q55 50 64 55 M76 55 Q85 50 95 57',
  sad: 'M45 62 Q54 60 63 55 M77 55 Q86 60 95 62',
  think: 'M45 56 Q55 50 64 55 M76 60 Q85 59 95 60',
  shock: 'M45 54 Q55 45 64 51 M76 51 Q85 45 95 54',
};

/** Where the pupils rest, per mood, and where a glance moves them. */
const GAZE: Partial<Record<Mood, Point>> = { idle: [0.8, 2], think: [-2.6, -3.6], sad: [0, 3.8] };
const GLANCE: Record<Look, Point> = { left: [-3.6, 1], right: [3.6, 1], up: [0, -3.8], down: [0, 4] };

/** Whole-body motion, per mood. */
const MOTION: Record<Mood, string> = {
  idle: 'animate-float',
  think: 'animate-float',
  happy: 'animate-hop',
  party: 'animate-dance',
  sad: 'animate-shake',
  shock: 'animate-tremble',
};

const OPEN_MOUTH = 'M57 98 Q70 101 83 98 Q81 114 70 114 Q59 114 57 98 Z';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Eyes({ mood, look }: { mood: Mood; look?: Look | null }) {
  const lidsRef = useRef<SVGGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);
  // Waiting with nothing to look at, it looks around now and then.
  const wander = !look && mood === 'idle';
  const open = mood !== 'happy' && mood !== 'party';
  const staring = mood === 'shock';

  // A blink every few seconds, each a short animation of its own.
  useEffect(() => {
    if (!open || staring || reducedMotion()) return;
    let timer = 0;
    const blink = () => {
      lidsRef.current?.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.1)', offset: 0.45 }, { transform: 'scaleY(1)' }], { duration: 170, easing: 'ease-in-out' });
      timer = window.setTimeout(blink, 2600 + Math.random() * 3200);
    };
    timer = window.setTimeout(blink, 1200 + Math.random() * 2400);
    return () => window.clearTimeout(timer);
  }, [open, staring]);

  // And a glance to one side now and then.
  useEffect(() => {
    if (!wander || reducedMotion()) return;
    let timer = 0;
    const glance = () => {
      const side = Math.random() < 0.5 ? -3.4 : 3.4;
      const away = `translate(${side}px, 0.6px)`;
      pupilsRef.current?.animate(
        [{ transform: 'translate(0, 0)' }, { transform: away, offset: 0.2 }, { transform: away, offset: 0.8 }, { transform: 'translate(0, 0)' }],
        { duration: 1500, easing: 'ease-in-out' },
      );
      timer = window.setTimeout(glance, 4200 + Math.random() * 4000);
    };
    timer = window.setTimeout(glance, 2400 + Math.random() * 2000);
    return () => window.clearTimeout(timer);
  }, [wander]);

  if (!open) {
    // Squeezed shut in a big grin: ^ ^
    return <path d={EYES.map((x) => `M${x - 7.5} ${EYE_Y + 2} Q${x} ${EYE_Y - 8} ${x + 7.5} ${EYE_Y + 2}`).join(' ')} stroke={DARK} strokeWidth="3.8" strokeLinecap="round" fill="none" />;
  }
  const shocked = staring;
  const [rx, ry] = GAZE[mood] ?? [0, 0];
  const [gx, gy] = look ? GLANCE[look] : [0, 0];
  const pupils = (
    <g ref={pupilsRef} style={{ transform: `translate(${gx}px, ${gy}px)`, transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
      {EYES.map((x) => (
        <g key={x}>
          <circle cx={x + rx} cy={EYE_Y + ry} r={shocked ? 4.3 : 6.2} fill={DARK} />
          <circle cx={x + rx + 2.4} cy={EYE_Y + ry - 2.6} r={shocked ? 1.6 : 2.4} fill="#ffffff" />
          <circle cx={x + rx - 2} cy={EYE_Y + ry + 2.8} r="1" fill="#ffffff" />
        </g>
      ))}
    </g>
  );
  const eyes = (
    <>
      {EYES.map((x) => (
        <ellipse key={x} cx={x} cy={EYE_Y} rx={shocked ? 12 : 10.5} ry={shocked ? 14.5 : 12.5} fill="#ffffff" />
      ))}
      {pupils}
      {mood === 'sad' &&
        // Heavy lids, drooping towards the outer corners
        EYES.map((x, i) => {
          const lid = i === 0 ? [EYE_Y - 3, EYE_Y - 8] : [EYE_Y - 8, EYE_Y - 3];
          return <path key={x} d={`M${x - 12} ${lid[0]} L${x + 12} ${lid[1]} L${x + 12} ${EYE_Y - 16} L${x - 12} ${EYE_Y - 16} Z`} fill={OCEAN_DARK} />;
        })}
    </>
  );
  return (
    <g ref={lidsRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {eyes}
    </g>
  );
}

function Mouth({ mood, clip, talking }: { mood: Mood; clip: string; talking: boolean }) {
  switch (mood) {
    case 'happy':
    case 'party':
      return (
        <g>
          <path d={OPEN_MOUTH} fill={MOUTH} />
          <g clipPath={`url(#${clip})`}>
            <rect x="55" y="96" width="30" height="5.2" fill="#ffffff" />
            <ellipse cx="70" cy="113" rx="8.5" ry="5.2" fill={TONGUE} />
          </g>
        </g>
      );
    case 'shock':
      return (
        <g>
          <ellipse cx="70" cy="106" rx="6.5" ry="8.5" fill={MOUTH} />
          <ellipse cx="70" cy="111.5" rx="4" ry="2.4" fill={TONGUE} />
        </g>
      );
    case 'sad':
      return <path d="M61 108 Q70 100 79 108" stroke={DARK} strokeWidth="3.6" strokeLinecap="round" fill="none" />;
    default: {
      const closed = mood === 'think' ? 'M64 104 Q71 102 77 105' : 'M60 100 Q70 108 80 100';
      return (
        <g>
          <path d={closed} stroke={DARK} strokeWidth="3.6" strokeLinecap="round" fill="none" />
          {talking && (
            // Opens and closes a few times, as if saying the speech bubble.
            <g className="animate-talk">
              <ellipse cx="70" cy="103" rx="7" ry="5.6" fill={MOUTH} />
              <ellipse cx="70" cy="106" rx="4.2" ry="2.2" fill={TONGUE} />
            </g>
          )}
        </g>
      );
    }
  }
}

/**
 * A small picture laid over Globy at a spot given in its own drawing's units (140 × 160), as an HTML
 * layer so its animation runs off the main thread.
 */
function Layer({
  x,
  y,
  width,
  viewBox,
  className,
  style,
  children,
}: {
  x: number;
  y: number;
  width: number;
  viewBox: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <svg
      aria-hidden
      viewBox={viewBox}
      className={clsx('pointer-events-none absolute block h-auto overflow-visible', className)}
      style={{ left: `${(x / 140) * 100}%`, top: `${(y / 160) * 100}%`, width: `${(width / 140) * 100}%`, ...style }}
    >
      {children}
    </svg>
  );
}

const STAR = 'M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z';

function Sparkles() {
  return (
    <>
      <Layer x={13} y={31} width={14} viewBox="-7 -7 14 14" className="animate-twinkle">
        <path d={STAR} fill="#ffd23f" />
      </Layer>
      <Layer x={113} y={21} width={18} viewBox="-7 -7 14 14" className="animate-twinkle" style={{ animationDelay: '0.7s' }}>
        <path d={STAR} fill="#ffd23f" />
      </Layer>
    </>
  );
}

const FLAME = (
  <>
    <path d="M0 -30 C9 -16 17 -9 15 4 C13 14 7 19 0 19 C-7 19 -13 14 -15 4 C-17 -9 -9 -16 0 -30 Z" fill="#ff8a3d" />
    <path d="M0 -14 C5 -6 9 -2 8 5 C7 11 4 13 0 13 C-4 13 -7 11 -8 5 C-9 -2 -5 -6 0 -14 Z" fill="#ffd23f" />
  </>
);

/** Flames licking up from behind: a hot streak. */
function Flames() {
  return (
    <>
      {(
        [
          [48.75, -8.75, 42.5, 0, 0],
          [17, 15, 34, -28, 0.15],
          [89, 15, 34, 28, 0.3],
        ] as const
      ).map(([x, y, width, tilt, delay]) => (
        <Layer
          key={x}
          x={x}
          y={y}
          width={width}
          viewBox="-17 -31 34 51"
          className="animate-flicker"
          style={{ rotate: `${tilt}deg`, transformOrigin: '50% 100%', animationDelay: `${delay}s` }}
        >
          {FLAME}
        </Layer>
      ))}
    </>
  );
}

function Sunglasses() {
  const lens = (x: number) => `M${x - 13} 68 Q${x - 13} 66 ${x - 11} 66 L${x + 11} 66 Q${x + 13} 66 ${x + 13} 68 L${x + 12} 79 Q${x + 11} 87 ${x + 3} 87 L${x - 3} 87 Q${x - 11} 87 ${x - 12} 79 Z`;
  return (
    <g>
      <path d="M42 70 L27 65 M98 70 L113 65 M67 71 Q70 68 73 71" stroke="#1b1530" strokeWidth="3" strokeLinecap="round" fill="none" />
      {EYES.map((x) => (
        <g key={x}>
          <path d={lens(x)} fill="#1b1530" />
          <path d={`M${x - 7} 70 L${x - 2} 78 M${x - 1} 70 L${x + 2} 74`} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
        </g>
      ))}
    </g>
  );
}

export function Mascot({
  mood,
  className,
  talking = false,
  look,
  cool = false,
  fire = false,
}: {
  mood: Mood;
  className?: string;
  /** Moves its mouth for a moment, as if saying the speech bubble. */
  talking?: boolean;
  /** Where to glance; otherwise it looks around now and then. */
  look?: Look | null;
  /** Sunglasses on: a long streak. */
  cool?: boolean;
  /** Flames behind it: a hot streak. */
  fire?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bodyClip = `globy-body-${uid}`;
  const shadeMask = `globy-shade-${uid}`;
  const mouthClip = `globy-mouth-${uid}`;
  const arms = ARMS[POSE[mood]];
  const shades = cool && (mood === 'happy' || mood === 'party' || mood === 'idle');

  return (
    <div className={clsx('relative', className)}>
      <div className={clsx('origin-bottom', MOTION[mood])}>
        {/* Squashes and stretches into each new expression */}
        <div className="origin-bottom animate-squish">
          <div className={clsx('relative origin-bottom', (mood === 'idle' || mood === 'think') && 'animate-breathe')}>
            {fire && <Flames />}
            <svg viewBox="0 0 140 160" className="relative block h-auto w-full overflow-visible" aria-hidden>
              <defs>
                <clipPath id={bodyClip}>
                  <circle cx="70" cy="82" r="50" />
                </clipPath>
                <mask id={shadeMask}>
                  <rect width="140" height="160" fill="#ffffff" />
                  <circle cx="60" cy="72" r="52" fill="#000000" />
                </mask>
                <clipPath id={mouthClip}>
                  <path d={OPEN_MOUTH} />
                </clipPath>
              </defs>

              <ellipse cx="70" cy="151" rx="38" ry="5.5" fill={DARK} opacity="0.13" />

              {/* Sneakers peeking out below */}
              {[54, 86].map((x) => (
                <g key={x}>
                  <ellipse cx={x} cy="136" rx="14" ry="8" fill={SHOE} />
                  <path d={`M${x - 12} 139 Q${x} 145 ${x + 12} 139`} stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.9" />
                </g>
              ))}

              {/* The planet */}
              <circle cx="70" cy="82" r="50" fill={OCEAN} />
              <g clipPath={`url(#${bodyClip})`}>
                <path d="M22 70 C24 52 38 38 56 34 C60 39 55 45 48 47 C40 49 38 57 31 63 C28 66 25 69 22 70 Z" fill={LAND} />
                <path d="M113 66 C121 73 122 90 117 103 C110 100 104 95 106 87 C107 79 106 72 113 66 Z" fill={LAND} />
                <path d="M34 112 C42 106 54 109 58 116 C61 123 52 128 44 126 C38 124 34 119 34 112 Z" fill={LAND} />
                <path d="M84 122 C88 117 98 117 101 121 C102 125 95 128 89 127 C86 126 84 124 84 122 Z" fill={LAND} />
                <ellipse cx="96" cy="44" rx="8" ry="4.5" fill={LAND} transform="rotate(-20 96 44)" />
                <circle cx="70" cy="82" r="50" fill={SHADE} mask={`url(#${shadeMask})`} />
              </g>
              <ellipse cx="45" cy="50" rx="11" ry="5.5" fill="#ffffff" opacity="0.5" transform="rotate(-35 45 50)" />

              {/* Face */}
              <g fill="#ff6f86" opacity={mood === 'happy' || mood === 'party' ? 0.55 : 0.35}>
                <ellipse cx="40" cy="94" rx="7" ry="4.4" />
                <ellipse cx="100" cy="94" rx="7" ry="4.4" />
              </g>
              <Eyes mood={mood} look={look} />
              {shades && <Sunglasses />}
              <path d={BROWS[mood]} stroke={DARK} strokeWidth="3.6" strokeLinecap="round" fill="none" />
              <Mouth mood={mood} clip={mouthClip} talking={talking} />

              {/* Arms, in front so hands can reach the face */}
              {arms.map(({ via, hand }, i) => {
                const [sx, sy] = SHOULDERS[i];
                return (
                  <g key={i}>
                    <path d={`M${sx} ${sy} Q${via[0]} ${via[1]} ${hand[0]} ${hand[1]}`} stroke={OCEAN_DARK} strokeWidth="9" strokeLinecap="round" fill="none" />
                    <circle cx={hand[0]} cy={hand[1]} r="7" fill={HAND} />
                    <path d={`M${hand[0] + 1} ${hand[1] - 6.9} A7 7 0 0 1 ${hand[0] + 1} ${hand[1] + 6.9}`} fill={SHADE} />
                  </g>
                );
              })}

              {/* Extras */}
              {mood === 'party' && (
                <g transform="rotate(-14 70 36)">
                  <path d="M56 38 L70 6 L84 38 Z" fill="#ffd23f" />
                  <path d="M63 22 L77 22 L79.2 27 L60.8 27 Z M59.1 31 L80.9 31 L83.1 36 L56.9 36 Z" fill="#ff7ab6" />
                  <ellipse cx="70" cy="38" rx="15" ry="3.6" fill="#ff7ab6" />
                  <circle cx="70" cy="6" r="5" fill="#ffffff" />
                </g>
              )}
            </svg>
            {(mood === 'happy' || mood === 'party') && <Sparkles />}
            {mood === 'shock' && (
              <Layer x={104} y={50} width={12} viewBox="104 50 12 19" className="animate-drip">
                <path d="M110 50 C114 56 116 60 116 63 A6 6 0 0 1 104 63 C104 60 106 56 110 50 Z" fill="#bfe9ff" />
                <circle cx="107.6" cy="61" r="1.5" fill="#ffffff" />
              </Layer>
            )}
            {mood === 'sad' && (
              <Layer x={41} y={84} width={8} viewBox="41 84 8 12.5" className="animate-tear">
                <path d="M45 84 C47.5 88 49 90.5 49 92.5 A4 4 0 0 1 41 92.5 C41 90.5 42.5 88 45 84 Z" fill="#8fd8ff" />
                <circle cx="43.6" cy="91.6" r="1.1" fill="#ffffff" />
              </Layer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
