import { memo, useEffect, useState } from 'react';
import clsx from 'clsx';
import type { Insets } from './types';

/**
 * Background sky behind the map, in the calm manner of iOS Weather: a soft gradient, a warm glow
 * where the sun would be, and a few hazy clouds drifting by. Purely decorative.
 */

const CLOUDS = [
  { top: '8%', width: 300, height: 70, duration: 150, delay: -30 },
  { top: '30%', width: 220, height: 54, duration: 190, delay: -110 },
  { top: '56%', width: 340, height: 80, duration: 170, delay: -70 },
  { top: '78%', width: 260, height: 60, duration: 210, delay: -160 },
];

export const CartoonSky = memo(function CartoonSky({
  insets,
  compact,
  paused,
}: {
  insets: Insets;
  compact: boolean;
  /** Covered by a sheet or menu: hold the clouds still. */
  paused: boolean;
}) {
  // Pausing restyles the whole sky, so it waits until the sheet or menu has finished sliding (and
  // the sky waits as long to start again), rather than costing the slide its first frames.
  const [still, setStill] = useState(paused);
  useEffect(() => {
    const timer = window.setTimeout(() => setStill(paused), 500);
    return () => window.clearTimeout(timer);
  }, [paused]);
  const scale = compact ? 0.65 : 1;
  return (
    <div
      aria-hidden
      className={clsx(
        'pointer-events-none absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#8fc8ff_0%,#bcdfff_30%,#e3f1ff_62%,#f5f8fc_100%)]',
        still && 'sky-paused',
      )}
    >
      {/* Sunlight from the upper right */}
      <div
        className="absolute rounded-full bg-[radial-gradient(circle,rgb(255_246_220/0.95)_0%,rgb(255_240_200/0.45)_30%,rgb(255_240_200/0)_68%)] transition-[right,top] duration-500"
        style={{
          width: 640 * scale,
          height: 640 * scale,
          right: insets.right - 260 * scale,
          top: insets.top - 300 * scale,
        }}
      />
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="absolute left-0 animate-cloud"
          style={{ top: c.top, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
        >
          <div
            className="rounded-full bg-white/75 blur-2xl"
            style={{ width: c.width * scale, height: c.height * scale }}
          />
        </div>
      ))}
    </div>
  );
});
