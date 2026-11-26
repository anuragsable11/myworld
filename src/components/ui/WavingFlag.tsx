import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Country } from '../../types';
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';

/**
 * A flag flying in a light breeze. The picture is cut into narrow upright strips; each rides the
 * wave a little later than the one before it and leans with the wave's slope, so the strips join
 * up into one rippling cloth, held still at the pole and free at the far end. The light and shade
 * of its folds travel across it with the wave.
 *
 * Only transforms move, on strips the graphics chip animates by itself (the Web Animations API,
 * with the wave worked out at a couple of dozen moments and glided between), so it costs the page
 * nothing while it flies. Out of sight it hangs still, and people who ask their system for less
 * motion get the flag as a plain picture.
 */

/** A whole wave passes in this long, in ms. */
const PERIOD_MS = 2600;
/** How many waves fit along the flag. */
const WAVES = 1.1;
/** The moments of each wave that are worked out exactly. */
const SAMPLES = 24;
/**
 * How many strips one wave is cut into. Each strip is straight, so they have to be this narrow
 * for their edges to read as a curve.
 */
const STRIPS_PER_WAVE = 12;

/** The cloth's height at a point of the wave: one long swell with a smaller, quicker flutter on top. */
const swell = (phase: number) => Math.sin(phase) + 0.26 * Math.sin(2 * phase + 0.9);
/** …and how steeply it is rising there. */
const swellSlope = (phase: number) => Math.cos(phase) + 0.52 * Math.cos(2 * phase + 0.9);
/** The steepest the swell ever gets. */
const STEEPEST = 1.5;

interface Strip {
  /** Its left edge and width, in px. */
  x: number;
  width: number;
  /** The point it leans about: the middle of the cloth it shows (it overlaps the next strip a little). */
  pivot: number;
  wave: Keyframe[];
}

/**
 * Cuts `span` px of cloth into strips and works out each one's ride over a wave `amplitude` px high.
 * A flag on a `pole` is held at its left edge; a round badge ripples all the way across.
 */
function cloth(span: number, amplitude: number, pole: boolean): Strip[] {
  const k = (2 * Math.PI * WAVES) / span;
  const count = Math.max(1, Math.round(WAVES * STRIPS_PER_WAVE));
  const pitch = span / count;
  return Array.from({ length: count }, (_, i) => {
    const x = i * pitch;
    const own = Math.min(pitch, span - x);
    const mid = x + own / 2;
    const along = mid / span;
    // How much of the wave it takes part in: nearly none at the pole, all of it at the far end.
    const reach = pole ? 0.08 + 0.92 * Math.pow(along, 0.9) : 0.8 + 0.2 * along;
    const reachSlope = pole ? (0.83 * Math.pow(along, -0.1)) / span : 0.2 / span;
    const wave: Keyframe[] = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const phase = (2 * Math.PI * s) / SAMPLES - k * mid;
      const y = amplitude * reach * swell(phase);
      const slope = amplitude * (reachSlope * swell(phase) - k * reach * swellSlope(phase));
      wave.push({ transform: `translateY(${y.toFixed(2)}px) skewY(${((Math.atan(slope) * 180) / Math.PI).toFixed(2)}deg)` });
    }
    // A pixel of overlap with the next strip, so no seam shows between them.
    return { x, width: Math.min(own + 1, span - x), pivot: own / 2, wave };
  });
}

/**
 * The folds' light and shade over a stretch of cloth `length` px long that starts `from` px along
 * the flag, as a picture: shadow where the cloth leans away from the light, a little brightness
 * where it leans towards it.
 */
function folds(from: number, length: number, wavelength: number, depth: number): string {
  const step = wavelength / 12;
  const stops: string[] = [];
  for (let u = 0; u < length + step; u += step) {
    const at = Math.min(u, length);
    const lean = -swellSlope((-2 * Math.PI * (from + at)) / wavelength) / STEEPEST;
    const colour = lean > 0 ? `rgb(30 27 75 / ${(depth * lean).toFixed(3)})` : `rgb(255 255 255 / ${(depth * 0.7 * -lean).toFixed(3)})`;
    stops.push(`${colour} ${at.toFixed(2)}px`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

interface WavingFlagProps {
  country: Pick<Country, 'name' | 'flag'>;
  /** How tall the flag is, in px (or how wide across, for a round one)… */
  height: number;
  /** …and the widest it may be; a longer flag is drawn less tall instead. */
  maxWidth?: number;
  /** The rounding of its corners, in px. */
  radius?: number;
  /** A round badge filled by the flag, as on the map pin, instead of the whole flag. */
  round?: boolean;
  /** Tapping it sends a gust of wind through it. */
  gusty?: boolean;
  className?: string;
}

export function WavingFlag({ country, height, maxWidth = height * 2, radius = 8, round = false, gusty = false, className }: WavingFlagProps) {
  const still = usePrefersReducedMotion();
  // A bitmap first: every strip draws it again, which costs nothing for a bitmap and a good deal
  // for a detailed drawing (some coats of arms run to thousands of shapes). The drawing is the
  // fallback, as it is the one kept for offline use.
  const sources = useMemo(() => [country.flag.png.replace(/\/w\d+\//, '/w320/'), country.flag.svg], [country.flag.png, country.flag.svg]);
  const [picture, setPicture] = useState<{ of: string; attempt: number; ratio: number | null }>({ of: sources[0], attempt: 0, ratio: null });
  if (picture.of !== sources[0]) setPicture({ of: sources[0], attempt: 0, ratio: null });
  const src = sources[picture.attempt] as string | undefined;
  const { ratio } = picture;

  const shape = useMemo(() => {
    if (!ratio) return null;
    if (round) {
      // The picture covers the circle with a little to spare, so its edges never ride into view.
      const margin = 4;
      let h = height + 2 * margin;
      let w = h * ratio;
      if (w < height + 2) {
        w = height + 2;
        h = w / ratio;
      }
      return { width: height, height, amplitude: 1.5, image: { left: (height - w) / 2, top: (height - h) / 2, width: w, height: h }, strips: cloth(height, 1.5, false) };
    }
    const width = Math.round(Math.min(maxWidth, height * ratio));
    const tall = Math.round(width / ratio);
    const amplitude = Math.max(1.2, Math.min(4.2, tall * 0.05));
    return { width, height: tall, amplitude, image: { left: 0, top: 0, width, height: tall }, strips: cloth(width, amplitude, true) };
  }, [ratio, round, height, maxWidth]);

  const root = useRef<HTMLElement | null>(null);
  const blowing = useRef<Animation[]>([]);
  const calm = useRef<number[]>([]);
  const wavelength = shape ? shape.width / WAVES : 0;
  useEffect(() => {
    const el = root.current;
    if (!el || !shape || still || typeof el.animate !== 'function') return;
    const running: Animation[] = [];
    el.querySelectorAll<HTMLElement>('[data-strip]').forEach((strip) => {
      running.push(strip.animate(shape.strips[Number(strip.dataset.strip)].wave, { duration: PERIOD_MS, iterations: Infinity }));
    });
    // The folds' light and shade drift along with the wave, one wavelength for each wave that passes.
    el.querySelectorAll<HTMLElement>('[data-folds]').forEach((fold) => {
      running.push(fold.animate([{ transform: 'translateX(0px)' }, { transform: `translateX(${wavelength.toFixed(2)}px)` }], { duration: PERIOD_MS, iterations: Infinity }));
    });
    blowing.current = running;
    // Out of sight, it hangs still.
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => running.forEach((a) => (entry.isIntersecting ? a.play() : a.pause())))
        : null;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      calm.current.forEach((timer) => window.clearTimeout(timer));
      running.forEach((a) => a.cancel());
      blowing.current = [];
    };
  }, [shape, still, wavelength]);

  /** A gust: the flag flaps hard for a moment, then the breeze settles again. */
  const gust = () => {
    haptics.tap();
    sounds.swish();
    calm.current.forEach((timer) => window.clearTimeout(timer));
    const blow = (rate: number) => blowing.current.forEach((a) => a.updatePlaybackRate(rate));
    blow(3);
    calm.current = [
      [700, 2.2],
      [1200, 1.5],
      [1700, 1],
    ].map(([after, rate]) => window.setTimeout(() => blow(rate), after));
  };

  const label = country.flag.alt ?? `Flag of ${country.name}`;
  const size = round ? { width: height, height } : undefined;

  // No picture could be loaded (offline, and never seen before): the flag emoji stands in.
  if (!src) {
    return (
      <span
        role="img"
        aria-label={label}
        className={clsx('inline-grid place-items-center leading-none', round ? 'rounded-full' : 'bg-control', className)}
        style={{ width: round ? height : Math.round(height * 1.5), height, fontSize: Math.round(height * (round ? 0.58 : 0.6)), borderRadius: round ? undefined : radius }}
      >
        {country.flag.emoji ?? '🏳️'}
      </span>
    );
  }

  // Until the picture has loaded (its shape isn't known before), and for anyone who wants less motion: the plain picture.
  if (!shape || still) {
    return (
      <img
        src={src}
        alt={label}
        draggable={false}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          const measured = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1.5;
          setPicture((p) => (p.of === sources[0] ? { ...p, ratio: measured } : p));
        }}
        onError={() => setPicture((p) => (p.of === sources[0] ? { ...p, attempt: p.attempt + 1, ratio: null } : p))}
        className={clsx(
          'inline-block align-top',
          round
            ? 'rounded-full object-cover shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.1)]'
            : 'w-auto bg-white object-contain shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_6px_18px_rgb(0_0_0/0.14)]',
          className,
        )}
        style={round ? size : { height, maxWidth, borderRadius: radius }}
      />
    );
  }

  const { image } = shape;
  const drawn = { width: image.width, height: image.height, backgroundImage: `url("${src}")`, backgroundSize: '100% 100%' };
  const strips = shape.strips.map((s, i) => (
    <span key={i} data-strip={i} className="absolute top-0 overflow-hidden" style={{ left: s.x, width: s.width, height: shape.height, transformOrigin: `${s.pivot}px 50%` }}>
      <span
        className="absolute bg-white"
        style={{ ...drawn, left: image.left - s.x, top: image.top, borderRadius: round ? undefined : radius, boxShadow: round ? undefined : 'inset 0 0 0 0.5px rgb(0 0 0 / 0.12)' }}
      />
    </span>
  ));

  const classes = clsx(
    'relative inline-block align-top',
    // Safari needs the hint to clip moving layers to a circle.
    round && 'overflow-hidden rounded-full [isolation:isolate] [transform:translateZ(0)]',
    className,
  );
  // How far the cloth rides up and down, and a little more for its lean: what lies under it or over
  // it keeps this far inside its top and bottom edges.
  const ride = Math.ceil(shape.amplitude) + 3;
  // A still copy of the flag lies under the strips, in case a hair of what is behind shows between
  // two of them on a screen whose pixels don't line up with the page's: then it is the flag's own colours.
  const under = round ? (
    <span aria-hidden className="absolute bg-white" style={{ ...drawn, left: image.left, top: image.top }} />
  ) : (
    // Rounded like the flag, so its corners stay inside the cloth's corners too.
    <span aria-hidden className="absolute inset-x-0 overflow-hidden" style={{ top: ride, bottom: ride, borderRadius: radius }}>
      <span className="absolute left-0 bg-white" style={{ ...drawn, top: -ride }} />
    </span>
  );
  // The folds' light and shade: one long picture of them, sliding along over the whole flag. It is
  // one layer over all the strips rather than a part of each (which left a hairline where two strips
  // met, on screens scaled to 125% or 150%), so it can't ride up and down with them: it stays inside
  // the cloth's edges and fades out towards them, and it fades towards the pole, where the cloth is still.
  const spare = 3;
  const shade = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 overflow-hidden"
      style={
        round
          ? { top: 0, bottom: 0 }
          : {
              top: ride,
              bottom: ride,
              maskImage: 'linear-gradient(90deg, rgb(0 0 0 / 0.1), #000 80%), linear-gradient(180deg, transparent, #000 24%, #000 76%, transparent)',
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }
      }
    >
      <span
        data-folds
        className="absolute inset-y-0"
        // A wavelength longer than the flag, since it slides that far, and a little more at each end.
        style={{
          left: -wavelength - spare,
          width: shape.width + wavelength + 2 * spare,
          backgroundImage: folds(-wavelength - spare, shape.width + wavelength + 2 * spare, wavelength, round ? 0.2 : 0.26),
        }}
      />
    </span>
  );
  const body = (
    <>
      {/* Its shadow on the card: cast by a shape a little smaller than the flag, so the cloth always covers it as it rides. */}
      {!round && <span aria-hidden className="absolute shadow-[0_6px_18px_rgb(0_0_0/0.16)]" style={{ inset: ride + 1, borderRadius: radius }} />}
      {under}
      {strips}
      {shade}
      {round && <span aria-hidden className="absolute inset-0 rounded-full shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.1)]" />}
    </>
  );
  const box = { width: shape.width, height: shape.height };

  const setRoot = (el: HTMLElement | null) => {
    root.current = el;
  };

  return gusty ? (
    <button
      ref={setRoot}
      type="button"
      onClick={gust}
      aria-label={`${label}. Tap for a gust of wind.`}
      title="Give it a gust of wind"
      className={clsx(classes, 'cursor-pointer')}
      style={box}
    >
      {body}
    </button>
  ) : (
    <span ref={setRoot} role="img" aria-label={label} className={classes} style={box}>
      {body}
    </span>
  );
}
