import { memo, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { CircleCheck } from 'lucide-react';
import type { Country } from '../../types';
import { discovered, subscribeDiscoveries } from '../../lib/discoveries';
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
  const explored = useSyncExternalStore(subscribeDiscoveries, discovered);

  const groups = useMemo(() => {
    if (!grouped) return [{ letter: '', items: countries }];
    const out: { letter: string; items: Country[] }[] = [];
    for (const c of countries) {
      const letter = groupLetter(c.name);
      if (out[out.length - 1]?.letter !== letter) out.push({ letter, items: [] });
      out[out.length - 1].items.push(c);
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
    return <p className="px-6 py-10 text-center text-[15px] text-secondary">{emptyMessage}</p>;
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain pb-3">
      <ul id={id} role="listbox" aria-label="Countries" className="px-2">
        {groups.map((g) => (
          <li key={g.letter || 'results'} role="presentation">
            {g.letter && (
              // An iOS section header, frosted so rows scrolling underneath blur away behind it.
              <div role="presentation" className="sticky top-0 z-10 bg-white/10 px-3 pb-1 pt-3 text-[13px] font-semibold text-secondary backdrop-blur-md">
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
                      // Selected rows are filled with the tint colour, as in an iPad sidebar.
                      'group relative flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-[7px] transition-colors duration-150',
                      selected
                        ? 'bg-tint text-white shadow-[0_2px_10px_rgb(0_122_255/0.3)]'
                        : c.cca3 === activeId
                          ? 'bg-control-strong'
                          : 'hover:bg-control active:bg-control-strong',
                    )}
                  >
                    <Flag country={c} className="h-[20px] w-[30px] shrink-0 rounded-[4px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className={clsx('truncate text-[15px] font-medium tracking-[-0.01em]', selected ? 'text-white' : 'text-label')}>
                          {c.name}
                        </span>
                        {/* Ticked once opened: a collection to fill in. */}
                        {explored.has(c.cca3) && (
                          <>
                            <CircleCheck aria-hidden className={clsx('size-3.5 shrink-0', selected ? 'text-white/90' : 'text-tint')} strokeWidth={2.4} />
                            <span className="sr-only">, explored</span>
                          </>
                        )}
                      </span>
                      <span className={clsx('block truncate text-[13px]', selected ? 'text-white/80' : 'text-secondary')}>
                        {c.capitals[0]?.name ?? c.subregion ?? c.region}
                      </span>
                    </span>
                    {!isSovereign(c) && (
                      <span
                        className={clsx(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          selected ? 'bg-white/25 text-white' : 'bg-control text-secondary',
                        )}
                      >
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
