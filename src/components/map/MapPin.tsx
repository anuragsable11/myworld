import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { Country } from '../../types';
import type { PinHandle } from './types';

/**
 * Map marker carrying the selected country's flag, in the style of Apple Maps: a white disc with a
 * small point and a soft shadow. Positioned imperatively by the active map view (point at the
 * country); it drops in once the camera arrives. Remount it (key by country) to replay the drop.
 */
export const MapPin = forwardRef<PinHandle, { country: Country; landingMs?: number }>(function MapPin({ country, landingMs = 850 }, ref) {
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

  return (
    <div ref={el} aria-hidden className="pointer-events-none absolute left-0 top-0 z-[5] opacity-0 transition-opacity duration-200">
      <span className="absolute -left-3 -top-1.5 h-3 w-6 animate-pin-shadow rounded-[50%] bg-black/25 blur-[2px]" style={{ animationDelay: `${landingMs}ms` }} />
      <div className="absolute bottom-0 left-0 -translate-x-1/2">
        <div className="flex origin-bottom animate-pin-drop flex-col items-center" style={{ animationDelay: `${landingMs}ms` }}>
          <div className="grid size-[46px] place-items-center rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_4px_14px_rgb(0_0_0/0.28)]">
            {flagFailed ? (
              <span className="grid size-[38px] place-items-center text-[22px] leading-none">{country.flag.emoji ?? '🏳️'}</span>
            ) : (
              <img
                src={country.flag.svg}
                alt=""
                className="size-[38px] rounded-full object-cover shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.1)]"
                draggable={false}
                onError={() => setFlagFailed(true)}
              />
            )}
          </div>
          {/* The point, in the same white as the disc */}
          <svg viewBox="0 0 14 9" className="-mt-px block w-3.5 drop-shadow-[0_2px_2px_rgb(0_0_0/0.18)]">
            <path d="M0 0 H14 L8.2 8 Q7 9.4 5.8 8 Z" fill="#ffffff" />
          </svg>
        </div>
      </div>
    </div>
  );
});
