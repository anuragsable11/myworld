import { memo, useEffect, useState } from 'react';
import clsx from 'clsx';
import type { Insets } from './types';

/** Background scenery: a sky gradient, a smiling sun, drifting clouds and twinkling sparkles. Purely decorative. */

const CLOUDS = [
  { top: '9%', scale: 1, duration: 110, delay: -20 },
  { top: '27%', scale: 0.62, duration: 140, delay: -75 },
  { top: '52%', scale: 0.85, duration: 125, delay: -48 },
  { top: '74%', scale: 0.55, duration: 160, delay: -120 },
  { top: '88%', scale: 0.75, duration: 135, delay: -95 },
];

const SPARKLES = [
  { left: '18%', top: '18%', size: 18, delay: 0 },
  { left: '64%', top: '12%', size: 14, delay: 0.8 },
  { left: '82%', top: '64%', size: 16, delay: 1.6 },
  { left: '36%', top: '82%', size: 12, delay: 0.4 },
  { left: '8%', top: '58%', size: 14, delay: 1.2 },
  { left: '52%', top: '92%', size: 10, delay: 2 },
];

function Cloud() {
  const shapes = (
    <>
      <circle cx="42" cy="50" r="22" />
      <circle cx="72" cy="36" r="28" />
      <circle cx="104" cy="42" r="23" />
      <circle cx="128" cy="54" r="16" />
      <rect x="26" y="50" width="116" height="22" rx="11" />
    </>
  );
  return (
    <svg viewBox="0 0 168 84" className="block w-44">
      <g fill="#1e1b4b" stroke="#1e1b4b" strokeWidth="6" strokeLinejoin="round">
        {shapes}
      </g>
      <g fill="#ffffff">{shapes}</g>
      <path d="M36 66 H132" stroke="#d9efff" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function Sun() {
  return (
    <div className="relative size-32 animate-float">
      <svg viewBox="-64 -64 128 128" className="absolute inset-0 animate-spin-slow" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M-6 -40 L0 -58 L6 -40 Z"
            transform={`rotate(${i * 30})`}
            fill="#ffd23f"
            stroke="#1e1b4b"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <svg viewBox="-64 -64 128 128" className="absolute inset-0" aria-hidden>
        <circle r="33" fill="#ffd23f" stroke="#1e1b4b" strokeWidth="3.5" />
        <circle cx="-12" cy="-12" r="8" fill="#fff3b0" />
        <ellipse cx="-11" cy="-3" rx="3.4" ry="5" fill="#1e1b4b" />
        <ellipse cx="11" cy="-3" rx="3.4" ry="5" fill="#1e1b4b" />
        <circle cx="-19" cy="8" r="5" fill="#ff8fa3" opacity="0.85" />
        <circle cx="19" cy="8" r="5" fill="#ff8fa3" opacity="0.85" />
        <path d="M-12 9 Q0 21 12 9" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Sparkle({ size }: { size: number }) {
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} aria-hidden>
      <path d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6 Z" fill="#ffffff" stroke="#1e1b4b" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export const CartoonSky = memo(function CartoonSky({
  insets,
  compact,
  paused,
}: {
  insets: Insets;
  compact: boolean;
  /** Covered by a sheet or menu: hold the clouds and sparkles still. */
  paused: boolean;
}) {
  // Pausing restyles the whole sky, so it waits until the sheet or menu has finished sliding (and
  // the sky waits as long to start again), rather than costing the slide its first frames.
  const [still, setStill] = useState(paused);
  useEffect(() => {
    const timer = window.setTimeout(() => setStill(paused), 500);
    return () => window.clearTimeout(timer);
  }, [paused]);
  return (
    <div
      aria-hidden
      className={clsx(
        'pointer-events-none absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#bde8ff_0%,#dff3ff_48%,#fff4dc_100%)]',
        still && 'sky-paused',
      )}
    >
      <div className="dots-bg absolute inset-0" />
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="absolute left-0 animate-cloud"
          style={{ top: c.top, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
        >
          <div style={{ transform: `scale(${compact ? c.scale * 0.7 : c.scale})` }}>
            <Cloud />
          </div>
        </div>
      ))}
      {SPARKLES.map((s, i) => (
        <div
          key={i}
          className="absolute animate-twinkle"
          style={{ left: s.left, top: s.top, animationDelay: `${s.delay}s` }}
        >
          <Sparkle size={s.size} />
        </div>
      ))}
      <div
        className="absolute transition-[right,top] duration-500"
        style={{
          right: insets.right + (compact ? 4 : 24),
          top: insets.top + (compact ? 52 : 56),
          transform: compact ? 'scale(0.62)' : undefined,
          transformOrigin: 'top right',
        }}
      >
        <Sun />
      </div>
    </div>
  );
});
