import { memo, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import type { Country } from '../../types';
import { groupLetter } from '../../lib/format';
import { scrollWithin } from '../../lib/scroll';
import { isSovereign } from '../../hooks/queries';
import { Flag } from '../ui/Flag';

interface CountryListProps {
  id: string;
  countries: Country[];
  grouped: boolean;
  selectedId: string | null;
  activeId?: string;
  onSelect: (id: string) => void;
  emptyMessage: string;
}

export const CountryList = memo(function CountryList({
  id,
  countries,
  grouped,
  selectedId,
  activeId,
  onSelect,
  emptyMessage,
}: CountryListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    if (!grouped) return [{ letter: '', items: countries }];
    const out: { letter: string; items: Country[] }[] = [];
    for (const c of countries) {
      const letter = groupLetter(c.name);
      if (out.at(-1)?.letter !== letter) out.push({ letter, items: [] });
      out.at(-1)!.items.push(c);
    }
    return out;
  }, [countries, grouped]);

  // Keep the selected (or keyboard-active) row in view.
  useEffect(() => {
    const target = activeId ?? selectedId;
    if (!target) return;
    const container = scrollRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-code="${target}"]`);
    if (container && el) scrollWithin(container, el, { offset: grouped ? 36 : 0 });
  }, [selectedId, activeId, grouped]);

  if (!countries.length) {
    return <p className="px-6 py-10 text-center text-[13px] text-mist-500">{emptyMessage}</p>;
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain pb-3">
      <ul id={id} role="listbox" aria-label="Countries" className="px-2">
        {groups.map((g) => (
          <li key={g.letter || 'results'} role="presentation">
            {g.letter && (
              <div
                role="presentation"
                className="sticky top-0 z-10 bg-ink-900/95 px-3 pb-1 pt-3 font-display text-[13px] font-semibold text-brass-300/90 backdrop-blur"
              >
                {g.letter}
              </div>
            )}
            <ul role="presentation">
              {g.items.map((c) => {
                const selected = c.cca3 === selectedId;
                return (
                  <li
                    key={c.cca3}
                    id={`country-${c.cca3}`}
                    data-code={c.cca3}
                    role="option"
                    aria-selected={selected}
                    onClick={() => onSelect(c.cca3)}
                    className={clsx(
                      'group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                      selected ? 'bg-brass-400/[0.11]' : c.cca3 === activeId ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brass-400" />}
                    <Flag country={c} className="h-[16px] w-[24px] shrink-0 rounded-[3px] ring-1 ring-white/10" />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block truncate text-[13.5px]', selected ? 'font-medium text-brass-200' : 'text-mist-100')}>
                        {c.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-mist-500">
                        {c.capitals[0]?.name ?? c.subregion ?? c.region}
                      </span>
                    </span>
                    {!isSovereign(c) && (
                      <span className="shrink-0 rounded border border-white/[0.07] px-1.5 py-px text-[10px] uppercase tracking-wide text-mist-500">
                        {c.status === 'disputed' ? 'Disputed' : 'Territory'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
});
