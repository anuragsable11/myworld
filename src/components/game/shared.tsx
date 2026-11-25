import { useMemo, type CSSProperties } from 'react';
import clsx from 'clsx';

/** Pieces the games share: Globy's speech bubble and the confetti that falls on a win. */

export const SPARK_COLOURS = ['#ffd23f', '#ff7ab6', '#4cb8f5', '#7ed957', '#a78bfa', '#ff7a59'];

/**
 * Globy's speech bubble, like a message on iPhone; the words pop in one after another as it talks.
 * `small` is for cards beside the map, where there is less room.
 */
export function Bubble({ text, small }: { text: string; small?: boolean }) {
  const words = text.split(' ');
  return (
    <p
      className={clsx(
        'relative min-w-0 flex-1 animate-pop rounded-[20px] bg-white leading-snug text-label shadow-[0_1px_2px_rgb(0_0_0/0.06)]',
        small ? 'mb-4 px-3.5 py-2 text-[15px]' : 'mb-7 px-4 py-2.5 text-[17px]',
      )}
    >
      <span aria-hidden className="absolute -left-[5px] bottom-3 size-3 rotate-45 rounded-[2px] bg-white" />
      <span className="relative">
        {words.map((word, i) => (
          <span key={i}>
            {i > 0 && ' '}
            <span className="inline-block animate-word" style={{ animationDelay: `${110 + i * 55}ms` }}>
              {word}
            </span>
          </span>
        ))}
      </span>
    </p>
  );
}

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 2.2 + Math.random() * 1.6,
        size: 7 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 140,
        spin: 360 + Math.random() * 720,
        colour: SPARK_COLOURS[i % SPARK_COLOURS.length],
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti-fall rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.6,
              background: p.colour,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
