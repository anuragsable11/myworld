import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Country } from '../../types';
import type { PinHandle } from './types';

const CONFETTI = ['#ffd23f', '#ff7a90', '#7ee2a8', '#7cc8ff', '#c3b1ff', '#ffbd7a'];

/**
 * Cartoon map pin carrying the selected country's flag. Positioned imperatively by the active
 * map view (tip at the country); it drops in once the camera arrives, then bobs, with a confetti pop.
 * Remount it (key by country) to replay the drop.
 */
export const MapPin = forwardRef<PinHandle, { country: Country }>(function MapPin({ country }, ref) {
  const el = useRef<HTMLDivElement>(null);
  // Offline, the flag image may not be cached; the flag emoji stands in.
  const [flagFailed, setFlagFailed] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      move: (x, y) => {
        const node = el.current;
        if (!node) return;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        node.style.opacity = '1';
      },
      hide: () => {
        if (el.current) el.current.style.opacity = '0';
      },
    }),
    [],
  );

  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2 + Math.sin(i * 7.3) * 0.3;
        const distance = 48 + ((i * 37) % 30);
        return {
          color: CONFETTI[i % CONFETTI.length],
          round: i % 3 === 0,
          style: {
            '--dx': `${Math.cos(angle) * distance}px`,
            '--dy': `${Math.sin(angle) * distance - 18}px`,
            '--rot': `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
          } as CSSProperties,
        };
      }),
    [],
  );

  return (
    <div ref={el} aria-hidden className="pointer-events-none absolute left-0 top-0 z-[5] opacity-0 transition-opacity duration-200">
      <span className="absolute -left-3.5 -top-2 h-4 w-7 animate-pin-shadow rounded-[50%] bg-ink/25" />
      {confetti.map((c, i) => (
        <span
          key={i}
          className={`absolute -left-1 -top-[46px] size-2 animate-confetti border border-ink/40 ${c.round ? 'rounded-full' : 'rounded-[2px]'}`}
          style={{ ...c.style, background: c.color }}
        />
      ))}
      <div className="absolute bottom-[-3px] left-0 w-14 -translate-x-1/2">
        <div className="origin-bottom animate-pin-drop">
          <div className="relative animate-pin-bob">
            <svg viewBox="0 0 56 70" className="block w-14 drop-shadow-[2px_3px_0_rgba(30,27,75,0.35)]">
              <path
                d="M28 67 C22 55 5 43 5 27 A23 23 0 1 1 51 27 C51 43 34 55 28 67 Z"
                fill="#ff6b81"
                stroke="#1e1b4b"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <circle cx="28" cy="27" r="17.5" fill="#ffffff" stroke="#1e1b4b" strokeWidth="2.5" />
              <ellipse cx="16" cy="14" rx="5" ry="3" fill="#ffffff" opacity="0.7" transform="rotate(-35 16 14)" />
            </svg>
            {flagFailed ? (
              <span className="absolute left-[13px] top-[12px] grid size-[30px] place-items-center text-[19px] leading-none">
                {country.flag.emoji ?? '🏳️'}
              </span>
            ) : (
              <img
                src={country.flag.svg}
                alt=""
                className="absolute left-[13px] top-[12px] size-[30px] rounded-full object-cover"
                draggable={false}
                onError={() => setFlagFailed(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
