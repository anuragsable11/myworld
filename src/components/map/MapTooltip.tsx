import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Country } from '../../types';
import { formatPopulation } from '../../lib/format';
import { Flag } from '../ui/Flag';
import type { HoverInfo } from './types';

export interface TooltipHandle {
  update: (info: HoverInfo | null) => void;
}

/** Speech-bubble tooltip. Owns hover state so pointer movement re-renders only this element, never the map. */
export const MapTooltip = forwardRef<TooltipHandle, { byId: Map<string, Country> | undefined }>(function MapTooltip(
  { byId },
  ref,
) {
  const [info, setInfo] = useState<HoverInfo | null>(null);
  const elRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ update: setInfo }), []);
  if (!info) return null;

  const country = info.id ? byId?.get(info.id) : undefined;
  const containerWidth = elRef.current?.parentElement?.clientWidth ?? window.innerWidth;
  const flipX = info.x > containerWidth - 290;

  return (
    <div
      ref={elRef}
      className="pointer-events-none absolute z-20"
      style={{
        left: info.x,
        top: info.y,
        transform: `translate(${flipX ? 'calc(-100% - 20px)' : '20px'}, -50%)`,
      }}
    >
      <div className="glass relative max-w-64 animate-pop rounded-[16px] px-3.5 py-2.5">
        {/* A small pointer towards the cursor */}
        <span
          className={clsx(
            'absolute top-1/2 size-3 -translate-y-1/2 rotate-45 rounded-[2px] bg-white/80',
            flipX ? '-right-[5px]' : '-left-[5px]',
          )}
        />
        <div className="relative flex items-center gap-2.5">
          {country && <Flag country={country} className="h-[18px] w-[27px] shrink-0 rounded-[4px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />}
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-label">{country?.name ?? info.name}</span>
        </div>
        {country && (
          <div className="relative mt-0.5 truncate pl-[37px] text-[12px] text-secondary">
            {[country.capitals[0]?.name, country.population ? formatPopulation(country.population) : country.region]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
});
