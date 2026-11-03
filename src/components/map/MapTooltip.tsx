import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { Country } from '../../types';
import { formatPopulation } from '../../lib/format';
import { Flag } from '../ui/Flag';
import type { HoverInfo } from './types';

export interface TooltipHandle {
  update: (info: HoverInfo | null) => void;
}

/** Owns hover state so pointer movement re-renders only this element, never the map. */
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
  const flipX = info.x > containerWidth - 280;

  return (
    <div
      ref={elRef}
      className="pointer-events-none absolute z-20 max-w-64 animate-fade-in rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur-md"
      style={{
        left: info.x,
        top: info.y,
        transform: `translate(${flipX ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
      }}
    >
      <div className="flex items-center gap-2.5">
        {country && <Flag country={country} className="h-[15px] w-[22px] shrink-0 rounded-[3px] ring-1 ring-white/10" />}
        <span className="truncate text-[13.5px] font-semibold text-mist-50">{country?.name ?? info.name}</span>
      </div>
      {country && (
        <div className="mt-0.5 truncate pl-[32px] text-[11.5px] text-mist-400">
          {[country.capitals[0]?.name, country.population ? formatPopulation(country.population) : country.region]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
    </div>
  );
});
